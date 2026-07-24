import { tableClientFor, TABLE_NAMES } from '../data/tableStore'

/**
 * Monthly JSON dump of the Table Storage data (REQ-009 §backup).
 *
 *   DATA_TABLES_URL=<account url> node dist/tools/dump.js [--out <dir>]
 *
 * Writes one timestamped JSON file per table (plus the counters) into --out
 * (default `./dump`), for the owner to keep in their own custody. Reads only —
 * it never writes to the tables — and authenticates exactly like the app
 * (connection string for Azurite, DefaultAzureCredential in the cloud), so
 * whoever runs it needs table-data read access on the account.
 *
 * The dump contains personal data (names, contact details, addresses): treat
 * the files like the database itself — private storage, no repos, no sharing.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const arg = (name: string): string | undefined => {
    const index = process.argv.indexOf(`--${name}`)
    return index >= 0 ? process.argv[index + 1] : undefined
}

const run = async (): Promise<void> => {
    const outDir = arg('out') ?? 'dump'
    const stamp = new Date().toISOString().slice(0, 10)
    mkdirSync(outDir, { recursive: true })

    // TABLE_NAMES already includes the counters, so a restore can continue
    // the id sequences.
    const tables = TABLE_NAMES
    let total = 0

    for (const table of tables) {
        const client = tableClientFor(table)
        const rows: Record<string, unknown>[] = []
        try {
            for await (const entity of client.listEntities()) {
                // odata metadata is noise in a backup; the data fields matter.
                const { odataMetadata, ...fields } = entity as Record<
                    string,
                    unknown
                > & { odataMetadata?: unknown }
                void odataMetadata
                rows.push(fields)
            }
        } catch (error) {
            const status = (error as { statusCode?: number }).statusCode
            if (status === 404) {
                console.warn(`- ${table}: table missing, skipped`)
                continue
            }
            throw error
        }

        const file = join(outDir, `${stamp}-${table}.json`)
        writeFileSync(file, JSON.stringify(rows, null, 2))
        console.log(`- ${table}: ${rows.length} rows -> ${file}`)
        total += rows.length
    }

    console.log(`Dumped ${total} rows across ${tables.length} tables.`)
}

run().catch((error) => {
    console.error(error)
    process.exit(1)
})

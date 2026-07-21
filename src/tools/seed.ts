import { RestError } from '@azure/data-tables'
import { TableStore, tableClientFor, TABLE_NAMES } from '../data/tableStore'
import { buildSeedForEnv, seededEnvironments } from '../data/seed'

/**
 * One-off seeder for the Table Storage store (REQ-009 phase 4).
 *
 *   DATA_TABLES_URL=<account url> node dist/tools/seed.js --env dev [--force]
 *
 * Writes the per-environment synthetic dataset into the tables and initialises
 * the id counters to the highest seeded id, so later creates continue the
 * sequence. Refuses to touch a store that already has students unless --force
 * is given — the cloud path is meant to run exactly once, never on every boot.
 *
 * Prod is deliberately NOT seeded (decision 2026-07-17: prod starts empty and
 * the teacher enters the real roster); this tool exists for dev and local
 * Azurite. The in-memory adapter keeps self-seeding for tests and `func start`.
 */

const arg = (name: string): string | undefined => {
    const index = process.argv.indexOf(`--${name}`)
    return index >= 0 ? process.argv[index + 1] : undefined
}
const has = (name: string): boolean => process.argv.includes(`--${name}`)

const ensureTables = async (): Promise<void> => {
    for (const name of TABLE_NAMES) {
        await tableClientFor(name)
            .createTable()
            .catch((error) => {
                if (!(error instanceof RestError) || error.statusCode !== 409) {
                    throw error
                }
            })
    }
}

const setCounter = async (
    name: 'student' | 'session' | 'testimonial',
    value: number
): Promise<void> => {
    await tableClientFor('counters').upsertEntity(
        { partitionKey: 'counter', rowKey: name, value },
        'Replace'
    )
}

const main = async (): Promise<void> => {
    const env = arg('env') ?? 'dev'
    if (!seededEnvironments.includes(env)) {
        throw new Error(
            `Unknown --env "${env}" (known: ${seededEnvironments.join(', ')}).`
        )
    }
    process.env.ENVIRONMENT = env

    await ensureTables()
    const store = new TableStore()

    // Prod goes live empty (decision 2026-07-17): --empty creates the tables
    // and zeroes the counters, writing no synthetic data. The first real
    // student then gets id 1.
    if (has('empty')) {
        await setCounter('student', 0)
        await setCounter('session', 0)
        await setCounter('testimonial', 0)
        console.log(
            `Provisioned ${env}: empty tables, counters at 0 (no seed data).`
        )
        return
    }

    const existing = await store.listStudents()
    if (existing.length > 0 && !has('force')) {
        console.error(
            `Refusing to seed: ${existing.length} students already present. ` +
                `Pass --force to overwrite.`
        )
        process.exit(1)
    }

    const seed = buildSeedForEnv(env)
    for (const student of seed.students) {
        await store.putStudent(student)
    }
    for (const session of seed.sessions) {
        await store.putSession(session)
    }
    for (const testimonial of seed.testimonials) {
        await store.putTestimonial(testimonial)
    }

    const maxStudentId = seed.students.reduce((max, s) => Math.max(max, s.id), 0)
    const maxSessionId = seed.sessions.reduce((max, s) => Math.max(max, s.id), 0)
    const maxTestimonialId = seed.testimonials.reduce(
        (max, t) => Math.max(max, t.id),
        0
    )
    await setCounter('student', maxStudentId)
    await setCounter('session', maxSessionId)
    await setCounter('testimonial', maxTestimonialId)

    console.log(
        `Seeded ${env}: ${seed.students.length} students, ` +
            `${seed.sessions.length} sessions, ` +
            `${seed.testimonials.length} testimonials. ` +
            `Counters → student ${maxStudentId}, session ${maxSessionId}, ` +
            `testimonial ${maxTestimonialId}.`
    )
}

main().catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
})

import { DataStore } from './dataStore'
import { MemoryStore } from './memoryStore'
import { TableStore } from './tableStore'
import { defaultEnv, seededEnvironments, seedYear } from './seed'

/** The active environment, from the ENVIRONMENT app setting (dev/prod). */
export const environmentName: string =
    process.env.ENVIRONMENT &&
    seededEnvironments.includes(process.env.ENVIRONMENT)
        ? process.env.ENVIRONMENT
        : defaultEnv

/** The year the seeded timetable covers, and therefore the billable months. */
export const billingYear = seedYear

/**
 * Chooses the persistence adapter from the DATA_STORE app setting (REQ-009):
 *
 *   unset | "memory"  → in-memory, self-seeding (local dev, tests, today's
 *                       deployed behaviour). NOT durable.
 *   "tables"          → Azure Table Storage (phase 2) — durable, per-env.
 *
 * The zero-breakage rollout: the flag stays "memory" while the table plumbing
 * is provisioned, then flips per environment once its tables are seeded.
 */
const createDataStore = (): DataStore => {
    const kind = process.env.DATA_STORE ?? 'memory'
    switch (kind) {
        case 'memory':
            return new MemoryStore(environmentName)
        case 'tables':
            return new TableStore()
        default:
            throw new Error(
                `Unknown DATA_STORE "${kind}" (expected "memory" or "tables").`
            )
    }
}

/** The single data store the whole API reads and writes through. */
export const dataStore: DataStore = createDataStore()

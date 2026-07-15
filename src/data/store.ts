import { Student } from '../models/student'
import { PaymentSettlement } from '../models/payment'
import { ScheduledSession } from '../models/session'
import {
    buildSeedForEnv,
    defaultEnv,
    seededEnvironments,
    seedYear,
} from './seed'

/** The active environment, from the ENVIRONMENT app setting (dev/test/prod). */
export const environmentName: string =
    process.env.ENVIRONMENT &&
    seededEnvironments.includes(process.env.ENVIRONMENT)
        ? process.env.ENVIRONMENT
        : defaultEnv

/** The year the seeded timetable covers, and therefore the billable months. */
export const billingYear = seedYear

/**
 * A simple in-memory data store seeded with per-environment sample data.
 *
 * The dataset (and its volume) is selected by the ENVIRONMENT app setting, so
 * dev/test/prod each serve distinct data. State persists for the lifetime of a
 * worker process only — it is NOT durable and resets on restart / scale-out. It
 * exists so the API is runnable out of the box; swap this module for a real
 * repository (Cosmos DB, SQL, Table Storage) without touching the services or
 * functions that depend on it.
 *
 * Note what is *not* here: what a student owes. That is derived from the classes
 * that took place, never stored, so it cannot drift out of step with the
 * timetable. Only what the teacher recorded — `settlements` — is kept.
 */
class InMemoryStore {
    students: Student[]
    sessions: ScheduledSession[]
    settlements: PaymentSettlement[]

    constructor() {
        const seed = buildSeedForEnv(environmentName)
        this.students = seed.students
        this.sessions = seed.sessions
        this.settlements = []
    }

    /** Returns the next available numeric student id. */
    nextStudentId(): number {
        return this.students.reduce((max, s) => Math.max(max, s.id), 0) + 1
    }

    /** Returns the next available numeric session id. */
    nextSessionId(): number {
        return this.sessions.reduce((max, s) => Math.max(max, s.id), 0) + 1
    }
}

export const store = new InMemoryStore()

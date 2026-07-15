import { Student } from '../models/student'
import { PaymentRecord } from '../models/payment'
import { ScheduledSession } from '../models/session'
import { buildSeedForEnv, buildSeedPayments, defaultEnv, seededEnvironments } from './seed'

/** The active environment, from the ENVIRONMENT app setting (dev/test/prod). */
export const environmentName: string =
    process.env.ENVIRONMENT && seededEnvironments.includes(process.env.ENVIRONMENT)
        ? process.env.ENVIRONMENT
        : defaultEnv

/**
 * A simple in-memory data store seeded with per-environment sample data.
 *
 * The dataset (and its volume) is selected by the ENVIRONMENT app setting, so
 * dev/test/prod each serve distinct data. State persists for the lifetime of a
 * worker process only — it is NOT durable and resets on restart / scale-out. It
 * exists so the API is runnable out of the box; swap this module for a real
 * repository (Cosmos DB, SQL, Table Storage) without touching the services or
 * functions that depend on it.
 */
class InMemoryStore {
    students: Student[]
    payments: PaymentRecord[]
    sessions: ScheduledSession[]

    constructor() {
        // Fix the payment year rather than reading the clock so seed data is
        // deterministic across restarts.
        const seedYear = 2026
        const seed = buildSeedForEnv(environmentName)
        this.students = seed.students
        this.sessions = seed.sessions
        this.payments = buildSeedPayments(this.students, seedYear)
    }

    /** Returns the next available numeric student id. */
    nextStudentId(): number {
        return this.students.reduce((max, s) => Math.max(max, s.id), 0) + 1
    }

    /** Returns the next available numeric payment id. */
    nextPaymentId(): number {
        return this.payments.reduce((max, p) => Math.max(max, p.id), 0) + 1
    }

    /** Returns the next available numeric session id. */
    nextSessionId(): number {
        return this.sessions.reduce((max, s) => Math.max(max, s.id), 0) + 1
    }
}

export const store = new InMemoryStore()

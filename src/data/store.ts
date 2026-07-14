import { Student } from '../models/student'
import { PaymentRecord } from '../models/payment'
import { buildSeedPayments, seedStudents } from './seed'

/**
 * A simple in-memory data store seeded with sample data.
 *
 * State persists for the lifetime of a worker process only — it is NOT durable
 * and resets on restart / scale-out. It exists so the API is runnable out of the
 * box; swap this module for a real repository (Cosmos DB, SQL, Table Storage)
 * without touching the services or functions that depend on it.
 */
class InMemoryStore {
    students: Student[]
    payments: PaymentRecord[]

    constructor() {
        // The frontend seeds payments for the current calendar year. We fix a
        // year here rather than reading the clock so seed data is deterministic.
        const seedYear = 2026
        this.students = seedStudents.map((student) => ({ ...student }))
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
}

export const store = new InMemoryStore()

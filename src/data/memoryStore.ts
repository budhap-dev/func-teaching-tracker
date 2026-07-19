import { Student } from '../models/student'
import { ScheduledSession } from '../models/session'
import { PaymentSettlement } from '../models/payment'
import { DataStore } from './dataStore'
import { buildSeedForEnv } from './seed'

/**
 * The in-memory adapter — the original store, behind the {@link DataStore}
 * seam. Seeded per environment at construction; state lasts only for the
 * lifetime of a worker process, so it is NOT durable and resets on restart or
 * scale-out. It stays the default for local `func start` and the test suite,
 * and the reference the table adapter is checked against.
 *
 * Every method returns a Promise to match the interface, but resolves
 * synchronously — there is no network here.
 */
export class MemoryStore implements DataStore {
    private students: Student[]
    private sessions: ScheduledSession[]
    private settlements: PaymentSettlement[]

    constructor(environmentName: string) {
        const seed = buildSeedForEnv(environmentName)
        this.students = seed.students
        this.sessions = seed.sessions
        this.settlements = []
    }

    // --- Students ---
    async listStudents(): Promise<Student[]> {
        return this.students
    }

    async getStudent(id: number): Promise<Student | undefined> {
        return this.students.find((student) => student.id === id)
    }

    async putStudent(student: Student): Promise<void> {
        const index = this.students.findIndex((item) => item.id === student.id)
        if (index >= 0) {
            this.students[index] = student
        } else {
            this.students.push(student)
        }
    }

    async nextStudentId(): Promise<number> {
        return this.students.reduce((max, s) => Math.max(max, s.id), 0) + 1
    }

    async deleteStudentCascade(id: number): Promise<void> {
        this.students = this.students.filter((student) => student.id !== id)
        this.sessions = this.sessions.filter(
            (session) => session.studentId !== id
        )
        this.settlements = this.settlements.filter(
            (settlement) => settlement.studentId !== id
        )
    }

    // --- Sessions ---
    async listSessions(): Promise<ScheduledSession[]> {
        return this.sessions
    }

    async getSession(id: number): Promise<ScheduledSession | undefined> {
        return this.sessions.find((session) => session.id === id)
    }

    async listSessionsByGroup(groupId: string): Promise<ScheduledSession[]> {
        return this.sessions.filter((session) => session.groupId === groupId)
    }

    async putSession(session: ScheduledSession): Promise<void> {
        const index = this.sessions.findIndex((item) => item.id === session.id)
        if (index >= 0) {
            this.sessions[index] = session
        } else {
            this.sessions.push(session)
        }
    }

    async nextSessionIds(count: number): Promise<number[]> {
        const base =
            this.sessions.reduce((max, s) => Math.max(max, s.id), 0) + 1
        return Array.from({ length: count }, (_, index) => base + index)
    }

    // --- Settlements ---
    async listSettlements(): Promise<PaymentSettlement[]> {
        return this.settlements
    }

    async getSettlement(
        studentId: number,
        month: string
    ): Promise<PaymentSettlement | undefined> {
        return this.settlements.find(
            (item) => item.studentId === studentId && item.month === month
        )
    }

    async putSettlement(settlement: PaymentSettlement): Promise<void> {
        const existing = this.settlements.find(
            (item) =>
                item.studentId === settlement.studentId &&
                item.month === settlement.month
        )
        if (existing) {
            existing.amountPaid = settlement.amountPaid
            existing.notes = settlement.notes
        } else {
            this.settlements.push(settlement)
        }
    }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Student } from '../models/student'
import type { ScheduledSession } from '../models/session'
import type { PaymentSettlement } from '../models/payment'

/**
 * The service reads the store singleton, so the tests swap it for a mutable
 * fake seeded per test. Dates are chosen inside the 2026 billing year but far
 * enough in the past/future to be stable regardless of the real "today"
 * (sessions in January are always held, December 31 always future-or-today).
 */
const fake = {
    students: [] as Student[],
    sessions: [] as ScheduledSession[],
    settlements: [] as PaymentSettlement[],
}

vi.mock('../data/store', () => ({
    billingYear: 2026,
    environmentName: 'test',
    dataStore: {
        listStudents: async () => fake.students,
        listSessions: async () => fake.sessions,
        listSettlements: async () => fake.settlements,
        getStudent: async (id: number) =>
            fake.students.find((student) => student.id === id),
        getSettlement: async (studentId: number, month: string) =>
            fake.settlements.find(
                (item) => item.studentId === studentId && item.month === month
            ),
        putSettlement: async (settlement: PaymentSettlement) => {
            fake.settlements = [
                ...fake.settlements.filter(
                    (item) =>
                        !(
                            item.studentId === settlement.studentId &&
                            item.month === settlement.month
                        )
                ),
                settlement,
            ]
        },
    },
}))

import {
    isPaymentStatus,
    listPayments,
    listPaymentsByMonth,
    savePayments,
    validatePaymentInput,
} from './paymentService'

const student = (overrides: Partial<Student> = {}): Student => ({
    id: 1,
    studentId: 'STU-0001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    dob: '2010-01-01',
    subjects: ['Maths'],
    school: 'Crownwood High',
    year: '10',
    progress: 70,
    mode: 'Online',
    fees: 50,
    notes: '',
    parentName: '',
    contactNumber: '',
    address: '',
    ...overrides,
})

const session = (
    overrides: Partial<ScheduledSession> = {}
): ScheduledSession => ({
    id: 100,
    studentId: 1,
    studentName: 'Ada Lovelace',
    year: '10',
    subject: 'Maths',
    date: '2026-01-10',
    time: '16:00',
    durationMinutes: 60,
    notes: '',
    status: 'Scheduled',
    ...overrides,
})

beforeEach(() => {
    fake.students = []
    fake.sessions = []
    fake.settlements = []
})

describe('per-session billing', () => {
    it('bills fee × held classes, itemised oldest-first with the fees tallying', async () => {
        fake.students = [student({ fees: 50 })]
        fake.sessions = [
            session({ id: 101, date: '2026-01-20', durationMinutes: 90 }),
            session({ id: 102, date: '2026-01-06', durationMinutes: 60 }),
        ]

        const [january] = await listPayments({ month: '2026-01' })

        expect(january.amountDue).toBe(100)
        expect(january.sessionsHeld).toBe(2)
        expect(january.totalDurationMinutes).toBe(150)
        // Line items are oldest first and sum to the amount due.
        expect(january.sessions.map((line) => line.date)).toEqual([
            '2026-01-06',
            '2026-01-20',
        ])
        expect(
            january.sessions.reduce((total, line) => total + line.fee, 0)
        ).toBe(january.amountDue)
    })

    it('never bills a cancelled or future class', async () => {
        fake.students = [student()]
        fake.sessions = [
            session({ id: 101, date: '2026-01-06' }),
            session({ id: 102, date: '2026-01-13', status: 'Cancelled' }),
            // Always in the future for any test run inside 2026.
            session({ id: 103, date: '2026-12-31' }),
        ]

        const [january] = await listPayments({ month: '2026-01' })
        const [december] = await listPayments({ month: '2026-12' })

        expect(january.sessionsHeld).toBe(1)
        expect(january.amountDue).toBe(50)
        expect(december.amountDue).toBe(0)
    })

    it('owes nothing in a month with no classes', async () => {
        fake.students = [student()]

        const [january] = await listPayments({ month: '2026-01' })

        expect(january.amountDue).toBe(0)
        expect(january.status).toBe('Pending')
        expect(january.sessions).toEqual([])
    })
})

describe('monthly and no-fee billing', () => {
    it('bills a monthly student the flat fee with fee-0 line items', async () => {
        fake.students = [student({ feeType: 'monthly', fees: 400 })]
        fake.sessions = [
            session({ id: 101, date: '2026-01-06', durationMinutes: 120 }),
            session({ id: 102, date: '2026-01-13', durationMinutes: 60 }),
        ]

        const [january] = await listPayments({ month: '2026-01' })

        // The flat retainer, regardless of the class count...
        expect(january.amountDue).toBe(400)
        expect(january.totalDurationMinutes).toBe(180)
        // ...with the classes listed but not re-charged.
        expect(january.sessions).toHaveLength(2)
        expect(january.sessions.every((line) => line.fee === 0)).toBe(true)
    })

    it('never bills a no-fee student and never itemises them', async () => {
        fake.students = [student({ feeType: 'none', fees: 50 })]
        fake.sessions = [session({ date: '2026-01-06' })]

        const [january] = await listPayments({ month: '2026-01' })

        expect(january.amountDue).toBe(0)
        expect(january.sessions).toEqual([])
        expect(january.sessionsHeld).toBe(1)
    })
})

describe('settlements and status', () => {
    it('derives Paid / Partial / Pending from what was received', async () => {
        fake.students = [
            student({ id: 1 }),
            student({ id: 2, studentId: 'STU-0002', firstName: 'Grace' }),
            student({ id: 3, studentId: 'STU-0003', firstName: 'Alan' }),
        ]
        fake.sessions = [1, 2, 3].map((studentId, index) =>
            session({ id: 100 + index, studentId, date: '2026-01-06' })
        )
        fake.settlements = [
            { studentId: 1, month: '2026-01', amountPaid: 50, notes: '' },
            { studentId: 2, month: '2026-01', amountPaid: 20, notes: 'part' },
        ]

        const records = await listPayments({ month: '2026-01' })
        const byId = new Map(records.map((r) => [r.studentId, r]))

        expect(byId.get(1)!.status).toBe('Paid')
        expect(byId.get(1)!.outstanding).toBe(0)
        expect(byId.get(2)!.status).toBe('Partial')
        expect(byId.get(2)!.outstanding).toBe(30)
        expect(byId.get(2)!.notes).toBe('part')
        expect(byId.get(3)!.status).toBe('Pending')
    })

    it('filters by studentId and status', async () => {
        fake.students = [
            student({ id: 1 }),
            student({ id: 2, studentId: 'STU-0002' }),
        ]
        fake.sessions = [session({ studentId: 1, date: '2026-01-06' })]
        fake.settlements = [
            { studentId: 1, month: '2026-01', amountPaid: 50, notes: '' },
        ]

        const paid = await listPayments({ status: 'Paid' })
        expect(paid).toHaveLength(1)
        expect(paid[0].studentId).toBe(1)

        const mine = await listPayments({ studentId: 2 })
        expect(mine).toHaveLength(12)
        expect(mine.every((record) => record.studentId === 2)).toBe(true)
    })
})

describe('listPaymentsByMonth', () => {
    it('groups records into ascending months with summed totals', async () => {
        fake.students = [
            student({ id: 1, fees: 50 }),
            student({ id: 2, studentId: 'STU-0002', fees: 30 }),
        ]
        fake.sessions = [
            session({ id: 101, studentId: 1, date: '2026-01-06' }),
            session({ id: 102, studentId: 2, date: '2026-01-13' }),
            session({ id: 103, studentId: 2, date: '2026-02-03' }),
        ]
        fake.settlements = [
            { studentId: 1, month: '2026-01', amountPaid: 20, notes: '' },
        ]

        const groups = await listPaymentsByMonth()

        expect(groups.map((group) => group.month)).toEqual(
            Array.from(
                { length: 12 },
                (_, index) => `2026-${String(index + 1).padStart(2, '0')}`
            )
        )
        const january = groups[0]
        expect(january.totalDue).toBe(80)
        expect(january.totalReceived).toBe(20)
        expect(january.totalOutstanding).toBe(60)
        expect(january.sessionsHeld).toBe(2)
        expect(groups[1].totalDue).toBe(30)
    })
})

describe('savePayments', () => {
    it('stores the typed amount and returns the server-derived record', async () => {
        fake.students = [student({ fees: 50 })]
        fake.sessions = [session({ date: '2026-01-06' })]

        const [saved] = await savePayments([
            { studentId: 1, month: '2026-01', amountPaid: 20, notes: 'half' },
        ])

        expect(saved.amountPaid).toBe(20)
        expect(saved.status).toBe('Partial')
        expect(saved.notes).toBe('half')
        expect(fake.settlements).toHaveLength(1)
    })

    it('settles in full when amountPaid is omitted — exactly what the classes came to', async () => {
        fake.students = [student({ fees: 50 })]
        fake.sessions = [
            session({ id: 101, date: '2026-01-06' }),
            session({ id: 102, date: '2026-01-13' }),
        ]

        const [saved] = await savePayments([{ studentId: 1, month: '2026-01' }])

        expect(saved.amountPaid).toBe(100)
        expect(saved.status).toBe('Paid')
    })

    it('keeps the existing note when the update does not carry one', async () => {
        fake.students = [student({ fees: 50 })]
        fake.sessions = [session({ date: '2026-01-06' })]
        fake.settlements = [
            { studentId: 1, month: '2026-01', amountPaid: 10, notes: 'keep me' },
        ]

        const [saved] = await savePayments([
            { studentId: 1, month: '2026-01', amountPaid: 25 },
        ])

        expect(saved.notes).toBe('keep me')
        expect(saved.amountPaid).toBe(25)
    })
})

describe('validatePaymentInput', () => {
    beforeEach(() => {
        fake.students = [student()]
    })

    it.each([
        [undefined, 'must be a payment object'],
        [{ month: '2026-01' }, 'studentId is required'],
        [{ studentId: 99, month: '2026-01' }, 'not a known student'],
        [{ studentId: 1 }, 'month is required'],
        [{ studentId: 1, month: '01-2026' }, 'YYYY-MM format'],
        [{ studentId: 1, month: '2025-01' }, 'must be a month of 2026'],
        [{ studentId: 1, month: '2026-01', amountPaid: -5 }, 'non-negative'],
    ])('rejects %j', async (input, message) => {
        expect(
            await validatePaymentInput(
                input as Parameters<typeof validatePaymentInput>[0],
                0
            )
        ).toContain(message)
    })

    it('accepts a valid payload, with or without amountPaid', async () => {
        expect(
            await validatePaymentInput({ studentId: 1, month: '2026-03' }, 0)
        ).toBeUndefined()
        expect(
            await validatePaymentInput(
                { studentId: 1, month: '2026-03', amountPaid: 0 },
                0
            )
        ).toBeUndefined()
    })
})

describe('isPaymentStatus', () => {
    it('accepts the three statuses and rejects anything else', () => {
        expect(isPaymentStatus('Paid')).toBe(true)
        expect(isPaymentStatus('Partial')).toBe(true)
        expect(isPaymentStatus('Pending')).toBe(true)
        expect(isPaymentStatus('Overdue')).toBe(false)
    })
})

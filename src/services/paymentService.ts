import { billingYear, store } from '../data/store'
import {
    derivePaymentStatus,
    MonthlyPaymentGroup,
    PaymentInput,
    PaymentQuery,
    PaymentRecord,
    paymentStatuses,
    PaymentStatus,
    PaymentSettlement,
} from '../models/payment'
import { wasHeld } from '../models/session'
import { Student } from '../models/student'

/** Today as YYYY-MM-DD. Isolated here so tests can stub one function. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10)

/** The twelve billable months of the seed year, e.g. 2026-01 … 2026-12. */
const billableMonths = (): string[] =>
    Array.from(
        { length: 12 },
        (_, index) => `${billingYear}-${String(index + 1).padStart(2, '0')}`
    )

/** Classes for a student in a month that actually took place by `today`. */
const sessionsHeldIn = (
    studentId: number,
    month: string,
    today: string
): number =>
    store.sessions.filter(
        (session) =>
            session.studentId === studentId &&
            session.date.startsWith(month) &&
            wasHeld(session, today)
    ).length

const findSettlement = (
    studentId: number,
    month: string
): PaymentSettlement | undefined =>
    store.settlements.find(
        (item) => item.studentId === studentId && item.month === month
    )

/**
 * Builds a student's bill for one month from the classes that took place.
 * Nothing here is stored: change the timetable and the bill follows.
 */
const buildRecord = (
    student: Student,
    month: string,
    monthIndex: number,
    today: string
): PaymentRecord => {
    const sessionsHeld = sessionsHeldIn(student.id, month, today)
    const amountDue = sessionsHeld * student.fees
    const settlement = findSettlement(student.id, month)
    const amountPaid = settlement?.amountPaid ?? 0

    return {
        id: student.id * 100 + monthIndex,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        month,
        feePerSession: student.fees,
        sessionsHeld,
        amountDue,
        amountPaid,
        outstanding: Math.max(amountDue - amountPaid, 0),
        status: derivePaymentStatus(amountDue, amountPaid),
        notes: settlement?.notes ?? '',
    }
}

/** Returns payment records, optionally filtered by studentId, month or status. */
export const listPayments = (query: PaymentQuery = {}): PaymentRecord[] => {
    const today = todayIso()
    const months = billableMonths()

    return store.students
        .flatMap((student) =>
            months.map((month, monthIndex) =>
                buildRecord(student, month, monthIndex, today)
            )
        )
        .filter((record) => {
            if (
                query.studentId !== undefined &&
                record.studentId !== query.studentId
            ) {
                return false
            }
            if (query.month !== undefined && record.month !== query.month) {
                return false
            }
            if (query.status !== undefined && record.status !== query.status) {
                return false
            }
            return true
        })
}

/** Groups payment records by month (ascending), with per-month totals. */
export const listPaymentsByMonth = (
    query: PaymentQuery = {}
): MonthlyPaymentGroup[] => {
    const byMonth = new Map<string, PaymentRecord[]>()

    listPayments(query).forEach((record) => {
        const existing = byMonth.get(record.month)
        if (existing) {
            existing.push(record)
        } else {
            byMonth.set(record.month, [record])
        }
    })

    return [...byMonth.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, records]) => {
            const sum = (pick: (record: PaymentRecord) => number) =>
                records.reduce((total, record) => total + pick(record), 0)
            const totalDue = sum((record) => record.amountDue)
            const totalReceived = sum((record) => record.amountPaid)
            return {
                month,
                totalDue,
                totalReceived,
                totalOutstanding: Math.max(totalDue - totalReceived, 0),
                sessionsHeld: sum((record) => record.sessionsHeld),
                records,
            }
        })
}

/**
 * Records a payment against a student's month.
 * Omitting `amountPaid` settles the month in full — "mark as paid".
 */
export const savePayments = (inputs: PaymentInput[]): PaymentRecord[] =>
    inputs.map((input) => {
        const today = todayIso()
        const monthIndex = billableMonths().indexOf(input.month)
        const student = store.students.find(
            (item) => item.id === input.studentId
        )!

        // Settling in full means paying exactly what the classes taught so far
        // come to — never a figure typed in the hope it matches.
        const amountDue = sessionsHeldIn(input.studentId, input.month, today) * student.fees
        const amountPaid = input.amountPaid ?? amountDue

        const existing = findSettlement(input.studentId, input.month)
        if (existing) {
            existing.amountPaid = amountPaid
            if (input.notes !== undefined) {
                existing.notes = input.notes
            }
        } else {
            store.settlements.push({
                studentId: input.studentId,
                month: input.month,
                amountPaid,
                notes: input.notes ?? '',
            })
        }

        return buildRecord(student, input.month, monthIndex, today)
    })

/** Validates a raw save payload, returning an error string when invalid. */
export const validatePaymentInput = (
    input: Partial<PaymentInput>,
    index: number
): string | undefined => {
    const at = `payments[${index}]`
    if (!input || typeof input !== 'object') {
        return `${at} must be a payment object.`
    }
    if (typeof input.studentId !== 'number') {
        return `${at}.studentId is required and must be a number.`
    }
    if (!store.students.some((student) => student.id === input.studentId)) {
        return `${at}.studentId ${input.studentId} is not a known student.`
    }
    if (!input.month || !/^\d{4}-\d{2}$/.test(input.month)) {
        return `${at}.month is required and must be in YYYY-MM format.`
    }
    if (!billableMonths().includes(input.month)) {
        return `${at}.month must be a month of ${billingYear}.`
    }
    if (
        input.amountPaid !== undefined &&
        (typeof input.amountPaid !== 'number' || input.amountPaid < 0)
    ) {
        return `${at}.amountPaid must be a non-negative number.`
    }
    return undefined
}

/** Exported for the status query filter. */
export const isPaymentStatus = (value: string): value is PaymentStatus =>
    paymentStatuses.includes(value as PaymentStatus)

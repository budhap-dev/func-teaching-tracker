import { store } from '../data/store'
import {
    MonthlyPaymentGroup,
    PaymentInput,
    PaymentQuery,
    PaymentRecord,
    paymentStatuses,
    PaymentStatus,
} from '../models/payment'
import { getStudentById } from './studentService'

/** Returns payment records, optionally filtered by studentId, month, or status. */
export const listPayments = (query: PaymentQuery = {}): PaymentRecord[] =>
    store.payments.filter((record) => {
        if (query.studentId !== undefined && record.studentId !== query.studentId) {
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

/**
 * Groups payment records by month (ascending), with per-month totals.
 * Accepts the same filters as {@link listPayments}.
 */
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
            const totalExpected = records.reduce(
                (sum, record) => sum + record.monthlyFee,
                0
            )
            const totalReceived = records.reduce(
                (sum, record) => sum + record.amountPaid,
                0
            )
            return {
                month,
                totalExpected,
                totalReceived,
                totalOutstanding: totalExpected - totalReceived,
                records,
            }
        })
}

/**
 * Creates or updates one or more payment records.
 * A record is matched by explicit `id`, otherwise by (studentId, month) — the
 * natural key of a monthly payment — so repeated saves for the same month update
 * in place rather than duplicating.
 */
export const savePayments = (inputs: PaymentInput[]): PaymentRecord[] =>
    inputs.map(saveOne)

const saveOne = (input: PaymentInput): PaymentRecord => {
    const existing = findExisting(input)
    const derivedName =
        input.studentName ?? deriveStudentName(input.studentId) ?? ''

    if (existing) {
        if (input.month !== undefined) existing.month = input.month
        if (input.monthlyFee !== undefined) existing.monthlyFee = input.monthlyFee
        if (input.amountPaid !== undefined) existing.amountPaid = input.amountPaid
        if (input.status !== undefined) existing.status = input.status
        if (input.notes !== undefined) existing.notes = input.notes
        if (input.studentName !== undefined) existing.studentName = input.studentName
        return existing
    }

    const record: PaymentRecord = {
        id: store.nextPaymentId(),
        studentId: input.studentId,
        studentName: derivedName,
        month: input.month,
        monthlyFee: input.monthlyFee ?? 0,
        amountPaid: input.amountPaid ?? 0,
        status: input.status ?? 'Pending',
        notes: input.notes ?? '',
    }
    store.payments.push(record)
    return record
}

const findExisting = (input: PaymentInput): PaymentRecord | undefined => {
    if (typeof input.id === 'number') {
        return store.payments.find((record) => record.id === input.id)
    }
    return store.payments.find(
        (record) =>
            record.studentId === input.studentId && record.month === input.month
    )
}

const deriveStudentName = (studentId: number): string | undefined => {
    const student = getStudentById(studentId)
    return student ? `${student.firstName} ${student.lastName}` : undefined
}

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
    if (!input.month || !/^\d{4}-\d{2}$/.test(input.month)) {
        return `${at}.month is required and must be in YYYY-MM format.`
    }
    if (
        input.status !== undefined &&
        !paymentStatuses.includes(input.status as PaymentStatus)
    ) {
        return `${at}.status must be one of: ${paymentStatuses.join(', ')}.`
    }
    if (
        input.amountPaid !== undefined &&
        (typeof input.amountPaid !== 'number' || input.amountPaid < 0)
    ) {
        return `${at}.amountPaid must be a non-negative number.`
    }
    if (
        input.monthlyFee !== undefined &&
        (typeof input.monthlyFee !== 'number' || input.monthlyFee < 0)
    ) {
        return `${at}.monthlyFee must be a non-negative number.`
    }
    return undefined
}

import type { FeeType } from './student'

export type PaymentStatus = 'Paid' | 'Partial' | 'Pending'

export const paymentStatuses: PaymentStatus[] = ['Paid', 'Partial', 'Pending']

/**
 * What the teacher has actually recorded against a student's month.
 *
 * This is the only part that is *stored*. What a student owes is never stored —
 * it is derived from the classes that took place (see {@link PaymentRecord}),
 * so it cannot drift out of step with the timetable.
 */
export interface PaymentSettlement {
    studentId: number
    month: string
    amountPaid: number
    notes: string
}

/**
 * A student's bill for one month.
 *
 * `amountDue` is derived: the per-session fee times the classes that have
 * already taken place that month (not cancelled, date not in the future). It
 * therefore grows through the month as lessons are taught, and a month with no
 * classes yet owes nothing.
 */
export interface PaymentRecord {
    id: number
    studentId: number
    studentName: string
    month: string
    /** The student's fee amount — a per-session price or a monthly retainer,
        per {@link feeType}. */
    feePerSession: number
    /** How this bill is charged; absent means `per-session`. */
    feeType?: FeeType
    /** How many classes actually took place this month. */
    sessionsHeld: number
    /** Per-session: `feePerSession × sessionsHeld`. Monthly: the flat fee. */
    amountDue: number
    amountPaid: number
    /** `amountDue − amountPaid`, never below zero. */
    outstanding: number
    status: PaymentStatus
    notes: string
}

/**
 * Payload for recording a payment.
 * Omit `amountPaid` to settle the month in full — "mark as paid".
 */
export type PaymentInput = {
    studentId: number
    month: string
    amountPaid?: number
    notes?: string
}

/** Query filters for listing payments. */
export interface PaymentQuery {
    studentId?: number
    month?: string
    status?: PaymentStatus
}

/** Payment records for one month, with totals — returned by /payments/by-month. */
export interface MonthlyPaymentGroup {
    month: string
    totalDue: number
    totalReceived: number
    totalOutstanding: number
    /** Classes taught across every student this month. */
    sessionsHeld: number
    records: PaymentRecord[]
}

/** Derives the status from what is owed against what has been paid. */
export const derivePaymentStatus = (
    amountDue: number,
    amountPaid: number
): PaymentStatus => {
    if (amountDue > 0 && amountPaid >= amountDue) {
        return 'Paid'
    }
    if (amountPaid > 0) {
        return 'Partial'
    }
    return 'Pending'
}

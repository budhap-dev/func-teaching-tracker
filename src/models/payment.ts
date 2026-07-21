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
 * One held class as a bill line item — the itemised detail behind
 * `sessionsHeld`, so the Payment Tracker can show each session that made up a
 * per-session bill and tally them to `amountDue`.
 *
 * The fee is the student's flat per-session price: every held class bills the
 * same amount regardless of `durationMinutes`, which is shown for context only.
 */
export interface SessionLine {
    /** ISO date, YYYY-MM-DD, the class took place. */
    date: string
    subject: string
    durationMinutes: number
    /** The per-session fee charged for this class. */
    fee: number
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
    /** Total minutes of the classes held this month, across every subject —
        the accumulated teaching time behind the bill. */
    totalDurationMinutes: number
    /** Per-session: `feePerSession × sessionsHeld`. Monthly: the flat fee. */
    amountDue: number
    amountPaid: number
    /** `amountDue − amountPaid`, never below zero. */
    outstanding: number
    status: PaymentStatus
    notes: string
    /**
     * The held classes behind this bill, each a line item (per-session fee
     * students only — their fees sum to `amountDue`). Empty for monthly/no-fee
     * students, whose bill isn't itemised per session.
     */
    sessions: SessionLine[]
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

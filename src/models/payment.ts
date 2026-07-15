export type PaymentStatus = 'Paid' | 'Partial' | 'Pending'

export const paymentStatuses: PaymentStatus[] = ['Paid', 'Partial', 'Pending']

/** A monthly payment record for a student. Mirrors the frontend PaymentRecord. */
export interface PaymentRecord {
    id: number
    studentId: number
    studentName: string
    month: string
    monthlyFee: number
    amountPaid: number
    status: PaymentStatus
    notes: string
}

/** Payload accepted by the save-payments endpoint. `id` is optional (upsert). */
export type PaymentInput = {
    id?: number
    studentId: number
    month: string
    monthlyFee?: number
    amountPaid?: number
    status?: PaymentStatus
    notes?: string
    studentName?: string
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
    totalExpected: number
    totalReceived: number
    totalOutstanding: number
    records: PaymentRecord[]
}

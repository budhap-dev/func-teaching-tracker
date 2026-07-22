import { billingYear, dataStore } from '../data/store'
import {
    derivePaymentStatus,
    MonthlyPaymentGroup,
    PaymentInput,
    PaymentQuery,
    PaymentRecord,
    paymentStatuses,
    PaymentStatus,
    PaymentSettlement,
    SessionLine,
} from '../models/payment'
import { ScheduledSession, wasHeld } from '../models/session'
import { Student } from '../models/student'

/** Today as YYYY-MM-DD. Isolated here so tests can stub one function. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10)

/** The twelve billable months of the seed year, e.g. 2026-01 … 2026-12. */
const billableMonths = (): string[] =>
    Array.from(
        { length: 12 },
        (_, index) => `${billingYear}-${String(index + 1).padStart(2, '0')}`
    )

/**
 * The classes a student actually held in a month, over a fetched-once snapshot
 * of sessions — the durable store is read once per request, not once per
 * (student, month) cell. The count is `.length`; the classes themselves become
 * the bill's line items.
 */
const heldSessionsFor =
    (sessions: ScheduledSession[], today: string) =>
    (studentId: number, month: string): ScheduledSession[] =>
        sessions.filter(
            (session) =>
                session.studentId === studentId &&
                session.date.startsWith(month) &&
                wasHeld(session, today)
        )

/** A settlement lookup over a fetched-once snapshot, keyed (studentId, month). */
const settlementLookup = (settlements: PaymentSettlement[]) => {
    const byKey = new Map(
        settlements.map((item) => [`${item.studentId}_${item.month}`, item])
    )
    return (studentId: number, month: string): PaymentSettlement | undefined =>
        byKey.get(`${studentId}_${month}`)
}

/**
 * Builds a student's bill for one month from the classes that took place.
 * Nothing here is stored: change the timetable and the bill follows.
 */
const buildRecord = (
    student: Student,
    month: string,
    monthIndex: number,
    heldSessions: ScheduledSession[],
    settlement: PaymentSettlement | undefined
): PaymentRecord => {
    const feeType = student.feeType ?? 'per-session'
    const sessionsHeld = heldSessions.length
    const totalDurationMinutes = heldSessions.reduce(
        (total, session) => total + session.durationMinutes,
        0
    )
    // A no-fee student is never billed; a monthly student pays a flat retainer
    // every month; a per-session student pays for the classes that happened.
    const amountDue =
        feeType === 'none'
            ? 0
            : feeType === 'monthly'
              ? student.fees
              : sessionsHeld * student.fees
    const amountPaid = settlement?.amountPaid ?? 0

    // Itemise the bill's held classes, oldest first. A per-session line
    // carries its fee (they sum to amountDue); a monthly student's lines
    // carry fee 0 — the flat retainer covers them, so the dates are listed
    // without re-charging each class. No-fee bills aren't itemised.
    const sessions: SessionLine[] =
        feeType === 'none'
            ? []
            : [...heldSessions]
                  .sort((left, right) => left.date.localeCompare(right.date))
                  .map((session) => ({
                      date: session.date,
                      subject: session.subject,
                      durationMinutes: session.durationMinutes,
                      fee: feeType === 'monthly' ? 0 : student.fees,
                  }))

    return {
        id: student.id * 100 + monthIndex,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        month,
        feePerSession: student.fees,
        feeType,
        sessionsHeld,
        totalDurationMinutes,
        amountDue,
        amountPaid,
        outstanding: Math.max(amountDue - amountPaid, 0),
        status: derivePaymentStatus(amountDue, amountPaid),
        notes: settlement?.notes ?? '',
        sessions,
    }
}

/** Returns payment records, optionally filtered by studentId, month or status. */
export const listPayments = async (
    query: PaymentQuery = {}
): Promise<PaymentRecord[]> => {
    const today = todayIso()
    const months = billableMonths()
    const [students, sessions, settlements] = await Promise.all([
        dataStore.listStudents(),
        dataStore.listSessions(),
        dataStore.listSettlements(),
    ])
    const heldIn = heldSessionsFor(sessions, today)
    const settlementFor = settlementLookup(settlements)

    return students
        .flatMap((student) =>
            months.map((month, monthIndex) =>
                buildRecord(
                    student,
                    month,
                    monthIndex,
                    heldIn(student.id, month),
                    settlementFor(student.id, month)
                )
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
export const listPaymentsByMonth = async (
    query: PaymentQuery = {}
): Promise<MonthlyPaymentGroup[]> => {
    const byMonth = new Map<string, PaymentRecord[]>()

    for (const record of await listPayments(query)) {
        const existing = byMonth.get(record.month)
        if (existing) {
            existing.push(record)
        } else {
            byMonth.set(record.month, [record])
        }
    }

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
export const savePayments = async (
    inputs: PaymentInput[]
): Promise<PaymentRecord[]> => {
    const today = todayIso()
    const months = billableMonths()
    const heldIn = heldSessionsFor(await dataStore.listSessions(), today)

    const records: PaymentRecord[] = []
    for (const input of inputs) {
        const monthIndex = months.indexOf(input.month)
        const student = (await dataStore.getStudent(input.studentId))!
        const heldSessions = heldIn(input.studentId, input.month)

        // Settling in full means paying exactly what the classes taught so far
        // come to — never a figure typed in the hope it matches.
        const amountDue = heldSessions.length * student.fees
        const amountPaid = input.amountPaid ?? amountDue

        const existing = await dataStore.getSettlement(
            input.studentId,
            input.month
        )
        const settlement: PaymentSettlement = {
            studentId: input.studentId,
            month: input.month,
            amountPaid,
            notes: input.notes ?? existing?.notes ?? '',
        }
        await dataStore.putSettlement(settlement)

        records.push(
            buildRecord(
                student,
                input.month,
                monthIndex,
                heldSessions,
                settlement
            )
        )
    }
    return records
}

/** Validates a raw save payload, returning an error string when invalid. */
export const validatePaymentInput = async (
    input: Partial<PaymentInput>,
    index: number
): Promise<string | undefined> => {
    const at = `payments[${index}]`
    if (!input || typeof input !== 'object') {
        return `${at} must be a payment object.`
    }
    if (typeof input.studentId !== 'number') {
        return `${at}.studentId is required and must be a number.`
    }
    const students = await dataStore.listStudents()
    if (!students.some((student) => student.id === input.studentId)) {
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

/**
 * Whether a class is still on.
 *
 * Deliberately only two states. Whether a class was *held* is derived — it is
 * `Scheduled` with a date in the past — rather than a third state the teacher
 * ticks after every lesson. Only the exception needs an action.
 */
export type SessionStatus = 'Scheduled' | 'Cancelled'

export const sessionStatuses: SessionStatus[] = ['Scheduled', 'Cancelled']

/** A scheduled class for a student. */
export interface ScheduledSession {
    id: number
    studentId: number
    studentName: string
    year: string
    subject: string
    /** ISO date, YYYY-MM-DD. */
    date: string
    /** 24h time, HH:MM. */
    time: string
    notes: string
    status: SessionStatus
}

/** Payload accepted by the create-session endpoint. */
export interface SessionInput {
    studentId: number
    studentName?: string
    year?: string
    subject: string
    date: string
    time: string
    notes?: string
}

/** Payload accepted by the update-session endpoint. */
export interface SessionUpdate {
    status: SessionStatus
}

/**
 * True when a class counts as taught: not cancelled, and its date has passed.
 * `today` is passed in rather than read from the clock so callers (and tests)
 * decide what "now" means.
 */
export const wasHeld = (session: ScheduledSession, today: string): boolean =>
    session.status !== 'Cancelled' && session.date <= today

/**
 * Whether a class is still on.
 *
 * Deliberately only two states. Whether a class was *held* is derived — it is
 * `Scheduled` with a date in the past — rather than a third state the teacher
 * ticks after every lesson. Only the exception needs an action.
 */
export type SessionStatus = 'Scheduled' | 'Cancelled'

export const sessionStatuses: SessionStatus[] = ['Scheduled', 'Cancelled']

/** How long a class runs, in minutes. */
export const validDurations = [30, 60, 90, 120] as const

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
    /** Length of the class in minutes (30 / 60 / 90 / 120). */
    durationMinutes: number
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
    durationMinutes?: number
    notes?: string
}

/**
 * Payload accepted by the update-session endpoint. Every field is optional: a
 * request may cancel/restore a class (`status`), edit its details, or both.
 * At least one field must be present.
 */
export interface SessionUpdate {
    studentId?: number
    studentName?: string
    year?: string
    subject?: string
    date?: string
    time?: string
    durationMinutes?: number
    notes?: string
    status?: SessionStatus
}

/**
 * True when a class counts as taught: not cancelled, and its date has passed.
 * `today` is passed in rather than read from the clock so callers (and tests)
 * decide what "now" means.
 */
export const wasHeld = (session: ScheduledSession, today: string): boolean =>
    session.status !== 'Cancelled' && session.date <= today

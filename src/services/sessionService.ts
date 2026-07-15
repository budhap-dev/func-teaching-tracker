import { store } from '../data/store'
import {
    ScheduledSession,
    SessionInput,
    sessionStatuses,
    SessionUpdate,
} from '../models/session'
import { getStudentById } from './studentService'

/** Returns scheduled sessions, optionally filtered by student, date-ordered. */
export const listSessions = (studentId?: number): ScheduledSession[] =>
    store.sessions
        .filter(
            (session) => studentId === undefined || session.studentId === studentId
        )
        .sort((left, right) =>
            `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`)
        )

/** Creates a scheduled session, filling studentName/year from the student. */
export const createSession = (input: SessionInput): ScheduledSession => {
    const student = getStudentById(input.studentId)
    const session: ScheduledSession = {
        id: store.nextSessionId(),
        studentId: input.studentId,
        studentName:
            input.studentName ??
            (student ? `${student.firstName} ${student.lastName}` : ''),
        year: input.year ?? student?.year ?? '',
        subject: input.subject,
        date: input.date,
        time: input.time,
        notes: input.notes ?? '',
        status: 'Scheduled',
    }
    store.sessions.push(session)
    return session
}

/** Returns a single session by id, or `undefined`. */
export const getSessionById = (id: number): ScheduledSession | undefined =>
    store.sessions.find((session) => session.id === id)

/**
 * Cancels or un-cancels a class. Cancelling never deletes the record — the
 * class stays visible, marked, so there is still a note of what was planned.
 */
export const updateSessionStatus = (
    id: number,
    update: SessionUpdate
): ScheduledSession | undefined => {
    const session = getSessionById(id)
    if (!session) {
        return undefined
    }
    session.status = update.status
    return session
}

/** Validates a raw status update, returning an error string when invalid. */
export const validateSessionUpdate = (
    update: Partial<SessionUpdate> | undefined
): string | undefined => {
    if (!update || typeof update !== 'object') {
        return 'Request body must be a session update object.'
    }
    if (!update.status || !sessionStatuses.includes(update.status)) {
        return `status is required and must be one of: ${sessionStatuses.join(', ')}.`
    }
    return undefined
}

/** Validates a raw create payload, returning an error string when invalid. */
export const validateSessionInput = (
    input: Partial<SessionInput> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be a session object.'
    }
    if (typeof input.studentId !== 'number') {
        return 'studentId is required and must be a number.'
    }
    if (!input.subject?.trim()) {
        return 'subject is required.'
    }
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        return 'date is required and must be in YYYY-MM-DD format.'
    }
    if (!input.time || !/^\d{2}:\d{2}$/.test(input.time)) {
        return 'time is required and must be in HH:MM format.'
    }
    return undefined
}

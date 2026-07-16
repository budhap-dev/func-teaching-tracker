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
 * Applies a partial update to a class: its details, its status, or both. Only
 * the fields present in `update` change. Cancelling (status) never deletes the
 * record — the class stays visible, marked, so there is still a note of what
 * was planned. Changing the student refreshes the denormalised name/year from
 * the roster unless the caller supplied its own.
 */
export const updateSession = (
    id: number,
    update: SessionUpdate
): ScheduledSession | undefined => {
    const session = getSessionById(id)
    if (!session) {
        return undefined
    }

    if (update.studentId !== undefined) {
        session.studentId = update.studentId
        const student = getStudentById(update.studentId)
        session.studentName =
            update.studentName ??
            (student ? `${student.firstName} ${student.lastName}` : session.studentName)
        session.year = update.year ?? student?.year ?? session.year
    } else {
        if (update.studentName !== undefined) session.studentName = update.studentName
        if (update.year !== undefined) session.year = update.year
    }
    if (update.subject !== undefined) session.subject = update.subject
    if (update.date !== undefined) session.date = update.date
    if (update.time !== undefined) session.time = update.time
    if (update.notes !== undefined) session.notes = update.notes
    if (update.status !== undefined) session.status = update.status

    return session
}

const editableKeys: (keyof SessionUpdate)[] = [
    'studentId',
    'studentName',
    'year',
    'subject',
    'date',
    'time',
    'notes',
    'status',
]

/** Validates a raw update, returning an error string when invalid. */
export const validateSessionUpdate = (
    update: Partial<SessionUpdate> | undefined
): string | undefined => {
    if (!update || typeof update !== 'object') {
        return 'Request body must be a session update object.'
    }
    if (!editableKeys.some((key) => update[key] !== undefined)) {
        return `At least one updatable field is required: ${editableKeys.join(', ')}.`
    }
    if (update.status !== undefined && !sessionStatuses.includes(update.status)) {
        return `status must be one of: ${sessionStatuses.join(', ')}.`
    }
    if (update.studentId !== undefined && typeof update.studentId !== 'number') {
        return 'studentId must be a number.'
    }
    if (update.subject !== undefined && !update.subject.trim()) {
        return 'subject must not be empty.'
    }
    if (update.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(update.date)) {
        return 'date must be in YYYY-MM-DD format.'
    }
    if (update.time !== undefined && !/^\d{2}:\d{2}$/.test(update.time)) {
        return 'time must be in HH:MM format.'
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

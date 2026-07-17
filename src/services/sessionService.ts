import { store } from '../data/store'
import {
    ScheduledSession,
    SessionInput,
    sessionStatuses,
    SessionUpdate,
    validDurations,
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

/**
 * Creates a class — one row per attending student. A single student books a
 * solo row (no groupId, exactly as before); several book linked rows sharing
 * a groupId, which is what makes them one class on the calendar.
 */
export const createSessions = (input: SessionInput): ScheduledSession[] => {
    const studentIds =
        input.studentIds && input.studentIds.length > 0
            ? input.studentIds
            : [input.studentId as number]
    const firstId = store.nextSessionId()
    const groupId = studentIds.length > 1 ? `grp-${firstId}` : undefined

    return studentIds.map((studentId, index) => {
        const student = getStudentById(studentId)
        const session: ScheduledSession = {
            id: firstId + index,
            studentId,
            // The denormalised name/year come from the roster; the caller's
            // override only makes sense for a solo booking.
            studentName:
                (studentIds.length === 1 ? input.studentName : undefined) ??
                (student ? `${student.firstName} ${student.lastName}` : ''),
            year:
                (studentIds.length === 1 ? input.year : undefined) ??
                student?.year ??
                '',
            subject: input.subject,
            date: input.date,
            time: input.time,
            // Older clients omit it: an hour is the house default.
            durationMinutes: input.durationMinutes ?? 60,
            ...(groupId ? { groupId } : {}),
            notes: input.notes ?? '',
            status: 'Scheduled',
        }
        store.sessions.push(session)
        return session
    })
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
): ScheduledSession[] | undefined => {
    const session = getSessionById(id)
    if (!session) {
        return undefined
    }

    // The group moves as one: applyToGroup fans the same update out to every
    // linked row. Per-student changes (status without the flag) touch one row.
    const targets =
        update.applyToGroup && session.groupId
            ? store.sessions.filter(
                  (candidate) => candidate.groupId === session.groupId
              )
            : [session]

    targets.forEach((target) => applyUpdate(target, update))
    return targets
}

const applyUpdate = (session: ScheduledSession, update: SessionUpdate) => {

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
    if (update.durationMinutes !== undefined)
        session.durationMinutes = update.durationMinutes
    if (update.notes !== undefined) session.notes = update.notes
    if (update.status !== undefined) session.status = update.status
}

const isValidDuration = (value: number): boolean =>
    (validDurations as readonly number[]).includes(value)

const editableKeys: (keyof SessionUpdate)[] = [
    'studentId',
    'studentName',
    'year',
    'subject',
    'date',
    'time',
    'durationMinutes',
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
    if (
        update.durationMinutes !== undefined &&
        !isValidDuration(update.durationMinutes)
    ) {
        return `durationMinutes must be one of: ${validDurations.join(', ')}.`
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
    const hasSolo = typeof input.studentId === 'number'
    const hasGroup =
        Array.isArray(input.studentIds) &&
        input.studentIds.length > 0 &&
        input.studentIds.every((id) => typeof id === 'number')
    if (!hasSolo && !hasGroup) {
        return 'studentId (or a non-empty studentIds array) is required.'
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
    if (
        input.durationMinutes !== undefined &&
        !isValidDuration(input.durationMinutes)
    ) {
        return `durationMinutes must be one of: ${validDurations.join(', ')}.`
    }
    return undefined
}

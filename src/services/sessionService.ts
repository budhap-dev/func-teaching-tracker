import { dataStore } from '../data/store'
import {
    ScheduledSession,
    SessionInput,
    sessionStatuses,
    SessionUpdate,
    validDurations,
} from '../models/session'
import { getStudentById } from './studentService'

/** Returns scheduled sessions, optionally filtered by student, date-ordered. */
export const listSessions = async (
    studentId?: number
): Promise<ScheduledSession[]> => {
    const sessions = await dataStore.listSessions()
    return sessions
        .filter(
            (session) =>
                studentId === undefined || session.studentId === studentId
        )
        .sort((left, right) =>
            `${left.date} ${left.time}`.localeCompare(
                `${right.date} ${right.time}`
            )
        )
}

/**
 * Creates a class — one row per attending student. A single student books a
 * solo row (no groupId, exactly as before); several book linked rows sharing
 * a groupId, which is what makes them one class on the calendar.
 */
export const createSessions = async (
    input: SessionInput
): Promise<ScheduledSession[]> => {
    const studentIds =
        input.studentIds && input.studentIds.length > 0
            ? input.studentIds
            : [input.studentId as number]
    // The whole contiguous id block is reserved at once, so grp-<firstId>
    // naming survives even under a concurrent writer.
    const ids = await dataStore.nextSessionIds(studentIds.length)
    const groupId = studentIds.length > 1 ? `grp-${ids[0]}` : undefined

    const created: ScheduledSession[] = []
    for (let index = 0; index < studentIds.length; index += 1) {
        const studentId = studentIds[index]
        const student = await getStudentById(studentId)
        const session: ScheduledSession = {
            id: ids[index],
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
        await dataStore.putSession(session)
        created.push(session)
    }
    return created
}

/** Returns a single session by id, or `undefined`. */
export const getSessionById = (
    id: number
): Promise<ScheduledSession | undefined> => dataStore.getSession(id)

export type AddMemberOutcome =
    | { ok: true; rows: ScheduledSession[] }
    | {
          ok: false
          reason: 'session-not-found' | 'student-not-found' | 'already-member'
      }

/**
 * Adds a student to an existing class. A solo class is promoted to a group
 * (the original row gains a shared groupId); a group class gains one more row
 * with that same groupId and the class's date/time/subject/duration. If the
 * student was previously removed (has a cancelled row in the group) their row
 * is restored rather than duplicated. Returns every row of the group.
 */
export const addSessionMember = async (
    sessionId: number,
    studentId: number
): Promise<AddMemberOutcome> => {
    const session = await dataStore.getSession(sessionId)
    if (!session) {
        return { ok: false, reason: 'session-not-found' }
    }
    const student = await dataStore.getStudent(studentId)
    if (!student) {
        return { ok: false, reason: 'student-not-found' }
    }

    // Solo → group: give the existing row a groupId so the new member can share it.
    let groupId = session.groupId
    if (!groupId) {
        groupId = `grp-${session.id}`
        await dataStore.putSession({ ...session, groupId })
    }

    const members = await dataStore.listSessionsByGroup(groupId)
    const existing = members.find((row) => row.studentId === studentId)
    if (existing) {
        if (existing.status !== 'Cancelled') {
            return { ok: false, reason: 'already-member' }
        }
        // Previously removed — bring their row back rather than duplicate it.
        await dataStore.putSession({ ...existing, status: 'Scheduled' })
        return { ok: true, rows: await dataStore.listSessionsByGroup(groupId) }
    }

    const [newId] = await dataStore.nextSessionIds(1)
    await dataStore.putSession({
        id: newId,
        studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        year: student.year,
        subject: session.subject,
        date: session.date,
        time: session.time,
        durationMinutes: session.durationMinutes ?? 60,
        groupId,
        notes: session.notes,
        status: 'Scheduled',
    })
    return { ok: true, rows: await dataStore.listSessionsByGroup(groupId) }
}

/**
 * Applies a partial update to a class: its details, its status, or both. Only
 * the fields present in `update` change. Cancelling (status) never deletes the
 * record — the class stays visible, marked, so there is still a note of what
 * was planned. Changing the student refreshes the denormalised name/year from
 * the roster unless the caller supplied its own.
 */
export const updateSession = async (
    id: number,
    update: SessionUpdate
): Promise<ScheduledSession[] | undefined> => {
    const session = await dataStore.getSession(id)
    if (!session) {
        return undefined
    }

    // The group moves as one: applyToGroup fans the same update out to every
    // linked row. Per-student changes (status without the flag) touch one row.
    const targets =
        update.applyToGroup && session.groupId
            ? await dataStore.listSessionsByGroup(session.groupId)
            : [session]

    for (const target of targets) {
        await applyUpdate(target, update)
        await dataStore.putSession(target)
    }
    return targets
}

const applyUpdate = async (
    session: ScheduledSession,
    update: SessionUpdate
) => {
    if (update.studentId !== undefined) {
        session.studentId = update.studentId
        const student = await getStudentById(update.studentId)
        session.studentName =
            update.studentName ??
            (student
                ? `${student.firstName} ${student.lastName}`
                : session.studentName)
        session.year = update.year ?? student?.year ?? session.year
    } else {
        if (update.studentName !== undefined)
            session.studentName = update.studentName
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

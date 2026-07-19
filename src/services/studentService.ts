import { dataStore } from '../data/store'
import {
    generateStudentCode,
    Student,
    StudentInput,
    StudentMode,
} from '../models/student'

const validModes: StudentMode[] = ['Online', 'Face to Face', 'Both']

/** Returns all students. */
export const listStudents = (): Promise<Student[]> => dataStore.listStudents()

/** Returns a single student by numeric id, or `undefined` if not found. */
export const getStudentById = (id: number): Promise<Student | undefined> =>
    dataStore.getStudent(id)

export interface UpsertResult {
    student: Student
    created: boolean
}

/**
 * Creates or updates a student.
 * - When `input.id` matches an existing student, that record is patched.
 * - Otherwise a new student is created with a fresh id and student code.
 */
export const upsertStudent = async (
    input: StudentInput
): Promise<UpsertResult> => {
    const existing =
        typeof input.id === 'number'
            ? await dataStore.getStudent(input.id)
            : undefined

    if (existing) {
        const merged: Student = {
            ...existing,
            ...sanitize(input),
            id: existing.id,
        }
        reconcileProgress(merged)
        await dataStore.putStudent(merged)
        // A student's classes carry a denormalised copy of their name and year,
        // frozen at booking time. Refresh any that have drifted so a rename
        // never leaves a stale name on the dashboard or planner — and existing
        // drift heals on the next save, not only on a fresh rename.
        await refreshSessionNames(merged)
        return { student: merged, created: false }
    }

    const student: Student = {
        id: await dataStore.nextStudentId(),
        studentId: input.studentId?.trim() || generateStudentCode(),
        firstName: input.firstName,
        lastName: input.lastName,
        dob: input.dob ?? '',
        subjects: input.subjects ?? [],
        school: input.school ?? '',
        year: input.year ?? '',
        progress: input.progress ?? 0,
        progressBySubject: input.progressBySubject,
        mode: normalizeMode(input.mode),
        fees: input.fees ?? 0,
        notes: input.notes ?? '',
        parentName: input.parentName ?? '',
        contactNumber: input.contactNumber ?? '',
        address: input.address ?? '',
    }
    reconcileProgress(student)
    await dataStore.putStudent(student)
    return { student, created: true }
}

/**
 * Brings the denormalised name/year on a student's classes back in step with
 * their record. Only rows that have actually drifted are rewritten, so a save
 * that changed nothing about the name touches no sessions.
 */
const refreshSessionNames = async (student: Student): Promise<void> => {
    const fullName = `${student.firstName} ${student.lastName}`
    const sessions = await dataStore.listSessions()
    for (const session of sessions) {
        if (
            session.studentId === student.id &&
            (session.studentName !== fullName || session.year !== student.year)
        ) {
            await dataStore.putSession({
                ...session,
                studentName: fullName,
                year: student.year,
            })
        }
    }
}

/** Erases a student and all their sessions and settlements (GDPR, REQ-009). */
export const deleteStudent = async (id: number): Promise<boolean> => {
    const existing = await dataStore.getStudent(id)
    if (!existing) {
        return false
    }
    await dataStore.deleteStudentCascade(id)
    return true
}

/** Today as YYYY-MM-DD. */
const todayIso = (): string => new Date().toISOString().slice(0, 10)

export type ArchiveOutcome =
    | { ok: true; student: Student; cancelledCount: number }
    | { ok: false; reason: 'not-found' }

/**
 * Archives a student (REQ-013): they leave the active roster for Alumni but
 * keep all history. Any class still to come is **cancelled** as part of the
 * archive — a leaver stops generating bills, and the teacher does it in one
 * step rather than clearing the calendar by hand first. Cancelled classes
 * stay on the record (never deleted), so history is intact. A closing note is
 * required (enforced by the handler). Restore is the mirror; the note and the
 * cancellations both stand (restoring the student does not un-cancel classes).
 */
export const archiveStudent = async (
    id: number,
    notes: string
): Promise<ArchiveOutcome> => {
    const student = await dataStore.getStudent(id)
    if (!student) {
        return { ok: false, reason: 'not-found' }
    }
    const today = todayIso()
    const sessions = await dataStore.listSessions()
    const futureClasses = sessions.filter(
        (session) =>
            session.studentId === id &&
            session.status !== 'Cancelled' &&
            session.date > today
    )
    for (const session of futureClasses) {
        await dataStore.putSession({ ...session, status: 'Cancelled' })
    }
    const archived: Student = {
        ...student,
        isArchived: true,
        archivedOn: today,
        archiveNotes: notes,
    }
    await dataStore.putStudent(archived)
    return { ok: true, student: archived, cancelledCount: futureClasses.length }
}

/** Returns an archived student to the active roster, keeping the note. */
export const restoreStudent = async (
    id: number
): Promise<Student | undefined> => {
    const student = await dataStore.getStudent(id)
    if (!student) {
        return undefined
    }
    const restored: Student = { ...student, isArchived: false }
    await dataStore.putStudent(restored)
    return restored
}

/**
 * Keeps the per-subject map honest after any write: entries for subjects the
 * student no longer studies are dropped, an emptied map is removed entirely,
 * and the blended `progress` becomes the rounded average of what remains —
 * so every consumer of the single figure (dashboard average, snapshots)
 * keeps working without change (REQ-014).
 */
const reconcileProgress = (student: Student): void => {
    const map = student.progressBySubject
    if (!map) {
        return
    }
    Object.keys(map).forEach((subject) => {
        if (!student.subjects.includes(subject)) {
            delete map[subject]
        }
    })
    const values = Object.values(map)
    if (values.length === 0) {
        delete student.progressBySubject
        return
    }
    student.progress = Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length
    )
}

/** Validates a raw upsert payload, returning an error string when invalid. */
export const validateStudentInput = (
    input: Partial<StudentInput> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be a student object.'
    }
    if (!input.firstName?.trim()) {
        return 'firstName is required.'
    }
    if (!input.lastName?.trim()) {
        return 'lastName is required.'
    }
    if (input.mode !== undefined && !validModes.includes(input.mode)) {
        return `mode must be one of: ${validModes.join(', ')}.`
    }
    if (
        input.progress !== undefined &&
        (typeof input.progress !== 'number' ||
            input.progress < 0 ||
            input.progress > 100)
    ) {
        return 'progress must be a number between 0 and 100.'
    }
    if (input.progressBySubject !== undefined) {
        if (
            typeof input.progressBySubject !== 'object' ||
            input.progressBySubject === null ||
            Array.isArray(input.progressBySubject)
        ) {
            return 'progressBySubject must be an object of subject: number.'
        }
        const badValue = Object.values(input.progressBySubject).some(
            (value) =>
                typeof value !== 'number' || value < 0 || value > 100
        )
        if (badValue) {
            return 'progressBySubject values must be numbers between 0 and 100.'
        }
    }
    if (
        input.fees !== undefined &&
        (typeof input.fees !== 'number' || input.fees < 0)
    ) {
        return 'fees must be a non-negative number.'
    }
    return undefined
}

const normalizeMode = (mode: StudentMode | undefined): StudentMode =>
    mode && validModes.includes(mode) ? mode : 'Face to Face'

/** Strips `id` and undefined fields so a patch never clobbers with undefined. */
const sanitize = (input: StudentInput): Partial<Student> => {
    const { id: _id, ...rest } = input
    return Object.fromEntries(
        Object.entries(rest).filter(([, value]) => value !== undefined)
    ) as Partial<Student>
}

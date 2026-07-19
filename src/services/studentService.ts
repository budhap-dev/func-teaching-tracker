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

/** Erases a student and all their sessions and settlements (GDPR, REQ-009). */
export const deleteStudent = async (id: number): Promise<boolean> => {
    const existing = await dataStore.getStudent(id)
    if (!existing) {
        return false
    }
    await dataStore.deleteStudentCascade(id)
    return true
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

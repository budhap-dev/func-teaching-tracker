import { store } from '../data/store'
import {
    generateStudentCode,
    Student,
    StudentInput,
    StudentMode,
} from '../models/student'

const validModes: StudentMode[] = ['Online', 'Face to Face', 'Both']

/** Returns all students. */
export const listStudents = (): Student[] => store.students

/** Returns a single student by numeric id, or `undefined` if not found. */
export const getStudentById = (id: number): Student | undefined =>
    store.students.find((student) => student.id === id)

export interface UpsertResult {
    student: Student
    created: boolean
}

/**
 * Creates or updates a student.
 * - When `input.id` matches an existing student, that record is patched.
 * - Otherwise a new student is created with a fresh id and student code.
 */
export const upsertStudent = (input: StudentInput): UpsertResult => {
    const existing =
        typeof input.id === 'number' ? getStudentById(input.id) : undefined

    if (existing) {
        Object.assign(existing, sanitize(input), { id: existing.id })
        return { student: existing, created: false }
    }

    const student: Student = {
        id: store.nextStudentId(),
        studentId: input.studentId?.trim() || generateStudentCode(),
        firstName: input.firstName,
        lastName: input.lastName,
        dob: input.dob ?? '',
        subjects: input.subjects ?? [],
        school: input.school ?? '',
        year: input.year ?? '',
        progress: input.progress ?? 0,
        mode: normalizeMode(input.mode),
        fees: input.fees ?? 0,
        notes: input.notes ?? '',
        parentName: input.parentName ?? '',
        contactNumber: input.contactNumber ?? '',
        address: input.address ?? '',
    }
    store.students.push(student)
    return { student, created: true }
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

export type StudentMode = 'Online' | 'Face to Face'

/** A tutored student. Mirrors the shape used by the Teaching Tracker frontend. */
export interface Student {
    id: number
    studentId: string
    firstName: string
    lastName: string
    dob: string
    subjects: string[]
    school: string
    year: string
    progress: number
    mode: StudentMode
    /** Agreed monthly tuition fee for this student, in GBP. */
    fees: number
    notes: string
    parentName: string
    contactNumber: string
    address: string
}

/** Payload accepted by the upsert endpoint. `id` is optional (create vs. update). */
export type StudentInput = Partial<Omit<Student, 'id'>> & {
    id?: number
    firstName: string
    lastName: string
}

/** Generates a human-facing student code, e.g. STU-4F9K2Q. */
let studentCodeCounter = 0
export const generateStudentCode = (): string => {
    studentCodeCounter += 1
    const suffix = `${Date.now().toString(36)}${studentCodeCounter.toString(36)}`
        .toUpperCase()
        .slice(-6)
    return `STU-${suffix}`
}

export type StudentMode = 'Online' | 'Face to Face' | 'Both'

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
    /** Blended 0–100 figure. When progressBySubject exists, the API keeps
        this as the rounded average of its values. */
    progress: number
    /** Progress per studied subject (0–100). Optional: older records carry
        only the blended figure and keep working unchanged (REQ-014). */
    progressBySubject?: Record<string, number>
    mode: StudentMode
    /** Agreed price for a single session with this student, in GBP. */
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

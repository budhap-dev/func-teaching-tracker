export type StudentMode = 'Online' | 'Face to Face' | 'Both'

/** How a student's `fees` amount is billed: `per-session` (default) charges per
    class held; `monthly` is a flat retainer charged every month; `none` means
    the student is not billed at all. */
export type FeeType = 'per-session' | 'monthly' | 'none'

/** One dated entry in a student's notes log. `id` is stable for edit/delete;
    `date` is an ISO `YYYY-MM-DD` day. */
export interface DatedNote {
    id: number
    date: string
    text: string
}

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
    /** Agreed fee amount in GBP. Its meaning depends on {@link feeType}: a
        per-session price (default) or a flat monthly retainer. */
    fees: number
    /** How `fees` is billed. Optional — absent means `per-session`. */
    feeType?: FeeType
    /** Legacy single free-text note, kept for older records. Superseded by
        {@link datedNotes} in the frontend. */
    notes: string
    /** The student's dated notes log. Optional — absent on older records. */
    datedNotes?: DatedNote[]
    parentName: string
    contactNumber: string
    address: string
    /** Archived students have finished tutoring: they leave the active roster
        for the teacher-only Alumni view but keep all their history (REQ-013).
        Absent/false means active — older records are unaffected. */
    isArchived?: boolean
    /** ISO date the student was archived — the retention-window anchor. */
    archivedOn?: string
    /** The teacher's closing note, kept through archive and restore. */
    archiveNotes?: string
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

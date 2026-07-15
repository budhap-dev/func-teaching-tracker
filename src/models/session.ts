/** A scheduled class for a student. */
export interface ScheduledSession {
    id: number
    studentId: number
    studentName: string
    year: string
    subject: string
    /** ISO date, YYYY-MM-DD. */
    date: string
    /** 24h time, HH:MM. */
    time: string
    notes: string
}

/** Payload accepted by the create-session endpoint. */
export interface SessionInput {
    studentId: number
    studentName?: string
    year?: string
    subject: string
    date: string
    time: string
    notes?: string
}

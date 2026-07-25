/**
 * An enquiry from the public site (REQ-018) — a prospect, not a student.
 *
 * Anyone can submit one from the /enquire form; it lands as `New` in the
 * teacher's Leads inbox (REQ-019), who works it Contacted and, when it turns
 * into a real student, Converted. Leads hold only what the enquirer typed;
 * converting one pre-fills the add-student form rather than linking records.
 */
export type LeadStatus = 'New' | 'Contacted' | 'Converted'

export const leadStatuses: LeadStatus[] = ['New', 'Contacted', 'Converted']

export interface Lead {
    id: number
    /** The parent or guardian making the enquiry. */
    parentName: string
    /** At least one of email / phone is always present (validated on create). */
    email?: string
    phone?: string
    /** The child's school year, e.g. "10". */
    year: string
    /** Subject(s) they're asking about. */
    subjects: string[]
    /** What they want out of tutoring, in their own words. */
    goal: string
    /** Preferred lesson mode. */
    mode: 'Online' | 'Face to Face' | 'Either'
    status: LeadStatus
    /** ISO date, YYYY-MM-DD, when the enquiry arrived. */
    submittedOn: string
}

export const leadModes: Lead['mode'][] = ['Online', 'Face to Face', 'Either']

/** Payload accepted by the public enquiry endpoint. */
export interface LeadInput {
    parentName: string
    email?: string
    phone?: string
    year: string
    subjects: string[]
    goal: string
    mode: Lead['mode']
    /** Honeypot: a hidden field real people leave blank; bots fill it. */
    website?: string
}

/** Payload accepted by the teacher's status update endpoint. */
export interface LeadUpdate {
    status?: LeadStatus
}

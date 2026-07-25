import { dataStore } from '../data/store'
import {
    Lead,
    LeadInput,
    LeadUpdate,
    leadModes,
    leadStatuses,
} from '../models/lead'

// Length caps: enough for a real enquiry, not an essay (or worse) — the
// public form can't be used as free storage. Goal is the long field.
const MAX_NAME = 80
const MAX_CONTACT = 254
const MAX_YEAR = 10
const MAX_SUBJECT = 60
const MAX_SUBJECTS = 8
const MAX_GOAL = 1000

// Same deliberately-permissive shapes as the contact service: catch a
// fat-fingered value, don't adjudicate RFCs.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+()\-.\s\d]+$/

const today = (): string => new Date().toISOString().slice(0, 10)

/** Removes any HTML so a free-text field is stored and shown as plain text. */
const stripHtml = (text: string): string => text.replace(/<[^>]*>/g, '').trim()

/** Every lead, newest first — the teacher's inbox (REQ-019). */
export const listLeads = async (): Promise<Lead[]> => {
    const all = await dataStore.listLeads()
    return [...all].sort(
        (left, right) =>
            right.submittedOn.localeCompare(left.submittedOn) ||
            right.id - left.id
    )
}

/**
 * Records a new enquiry as New. A filled honeypot (`website`) marks a bot: it
 * returns null so the caller can answer 201 like a success without storing
 * anything.
 */
export const createLead = async (input: LeadInput): Promise<Lead | null> => {
    if (input.website && input.website.trim()) {
        return null
    }
    const id = await dataStore.nextLeadId()
    const email = input.email?.trim()
    const phone = input.phone?.trim()
    const lead: Lead = {
        id,
        parentName: input.parentName.trim(),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        year: input.year.trim(),
        subjects: input.subjects.map((subject) => subject.trim()),
        goal: stripHtml(input.goal),
        mode: input.mode,
        status: 'New',
        submittedOn: today(),
    }
    await dataStore.putLead(lead)
    return lead
}

/** Moves a lead through the inbox: New → Contacted → Converted (any order). */
export const setLeadStatus = async (
    id: number,
    status: Lead['status']
): Promise<Lead | undefined> => {
    const lead = await dataStore.getLead(id)
    if (!lead) {
        return undefined
    }
    const updated: Lead = { ...lead, status }
    await dataStore.putLead(updated)
    return updated
}

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0

/** Validates a public enquiry, returning an error string when invalid. */
export const validateLeadInput = (
    input: Partial<LeadInput> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be an enquiry object.'
    }
    if (!isNonEmptyString(input.parentName)) {
        return 'parentName is required.'
    }
    if (input.parentName.trim().length > MAX_NAME) {
        return `parentName must be ${MAX_NAME} characters or fewer.`
    }
    const email = typeof input.email === 'string' ? input.email.trim() : ''
    const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
    if (!email && !phone) {
        return 'A contact is required: email or phone.'
    }
    if (email) {
        if (email.length > MAX_CONTACT) {
            return `email must be ${MAX_CONTACT} characters or fewer.`
        }
        if (!EMAIL_RE.test(email)) {
            return 'email must be a valid email address.'
        }
    }
    if (phone) {
        if (phone.length > MAX_CONTACT) {
            return `phone must be ${MAX_CONTACT} characters or fewer.`
        }
        if (!PHONE_RE.test(phone) || (phone.match(/\d/g) ?? []).length < 7) {
            return 'phone must be a valid phone number.'
        }
    }
    if (!isNonEmptyString(input.year)) {
        return 'year is required.'
    }
    if (input.year.trim().length > MAX_YEAR) {
        return `year must be ${MAX_YEAR} characters or fewer.`
    }
    if (
        !Array.isArray(input.subjects) ||
        input.subjects.length === 0 ||
        !input.subjects.every(isNonEmptyString)
    ) {
        return 'subjects must be a non-empty list of subject names.'
    }
    if (input.subjects.length > MAX_SUBJECTS) {
        return `subjects must list ${MAX_SUBJECTS} or fewer.`
    }
    if (input.subjects.some((s) => s.trim().length > MAX_SUBJECT)) {
        return `each subject must be ${MAX_SUBJECT} characters or fewer.`
    }
    if (!isNonEmptyString(input.goal)) {
        return 'goal is required.'
    }
    if (input.goal.trim().length > MAX_GOAL) {
        return `goal must be ${MAX_GOAL} characters or fewer.`
    }
    if (input.mode === undefined || !leadModes.includes(input.mode)) {
        return `mode must be one of: ${leadModes.join(', ')}.`
    }
    return undefined
}

/** Validates a status update, returning an error string when invalid. */
export const validateLeadUpdate = (
    input: Partial<LeadUpdate> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be an update object.'
    }
    if (
        input.status === undefined ||
        !leadStatuses.includes(input.status)
    ) {
        return `status must be one of: ${leadStatuses.join(', ')}.`
    }
    return undefined
}

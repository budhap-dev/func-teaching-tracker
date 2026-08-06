import { dataStore } from '../data/store'
import {
    recommendationRoles,
    moderatedStatuses,
    Testimonial,
    TestimonialInput,
    testimonialRoles,
    TestimonialStatus,
    TestimonialUpdate,
} from '../models/testimonial'
import { containsProfanity } from '../shared/profanity'

// Length caps. Names and quotes are bounded so a public submit form can't be
// used to store an essay (or worse) — the quote also has any HTML stripped.
const MAX_NAME = 80
const MAX_QUOTE = 600
const MAX_SUBJECT = 60
const MAX_YEAR = 10

const today = (): string => new Date().toISOString().slice(0, 10)

/** Removes any HTML so a quote is stored and shown as plain text (no XSS). */
const stripHtml = (text: string): string => text.replace(/<[^>]*>/g, '').trim()

/** Approved reviews, newest first — the only ones ever shown publicly. */
export const listApprovedTestimonials = async (): Promise<Testimonial[]> => {
    const all = await dataStore.listTestimonials()
    return all
        .filter((testimonial) => testimonial.status === 'Approved')
        .sort((left, right) => right.submittedOn.localeCompare(left.submittedOn))
}

/** Pending reviews awaiting moderation, newest first — the teacher's queue. */
export const listPendingTestimonials = async (): Promise<Testimonial[]> => {
    const all = await dataStore.listTestimonials()
    return all
        .filter((testimonial) => testimonial.status === 'Pending')
        .sort((left, right) => right.submittedOn.localeCompare(left.submittedOn))
}

/**
 * Records a new submission as Pending. A filled honeypot (`website`) marks a
 * bot: it returns null so the caller can answer 201 like a success without
 * storing anything.
 */
export const createTestimonial = async (
    input: TestimonialInput
): Promise<Testimonial | null> => {
    if (input.website && input.website.trim()) {
        return null
    }
    const id = await dataStore.nextTestimonialId()
    const quote = stripHtml(input.quote)
    // Flag (don't block) likely-offensive text so the teacher's queue can
    // highlight it. It still lands as Pending and shows nothing publicly.
    const flagged = containsProfanity(`${input.authorName} ${quote}`)
    const testimonial: Testimonial = {
        id,
        authorName: input.authorName.trim(),
        role: input.role,
        ...(input.subject?.trim() ? { subject: input.subject.trim() } : {}),
        ...(input.year?.trim() ? { year: input.year.trim() } : {}),
        // Recommendations store no rating at all.
        ...(recommendationRoles.includes(input.role)
            ? {}
            : { rating: input.rating }),
        quote,
        status: 'Pending',
        ...(flagged ? { flagged: true } : {}),
        submittedOn: today(),
    }
    await dataStore.putTestimonial(testimonial)
    return testimonial
}

/** Moderates a review — Approved or Rejected — stamping the date. */
export const setTestimonialStatus = async (
    id: number,
    status: TestimonialStatus
): Promise<Testimonial | undefined> => {
    const testimonial = await dataStore.getTestimonial(id)
    if (!testimonial) {
        return undefined
    }
    const updated: Testimonial = { ...testimonial, status, moderatedOn: today() }
    await dataStore.putTestimonial(updated)
    return updated
}

/** Removes a review entirely (spam/abuse, or the GDPR erasure path). */
export const deleteTestimonial = async (id: number): Promise<boolean> => {
    const testimonial = await dataStore.getTestimonial(id)
    if (!testimonial) {
        return false
    }
    await dataStore.deleteTestimonial(id)
    return true
}

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0

/** Validates a public submission, returning an error string when invalid. */
export const validateTestimonialInput = (
    input: Partial<TestimonialInput> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be a testimonial object.'
    }
    if (!isNonEmptyString(input.authorName)) {
        return 'authorName is required.'
    }
    if (input.authorName.trim().length > MAX_NAME) {
        return `authorName must be ${MAX_NAME} characters or fewer.`
    }
    if (input.role === undefined || !testimonialRoles.includes(input.role)) {
        return `role must be one of: ${testimonialRoles.join(', ')}.`
    }
    // Recommendations (Professional/Personal) carry no star rating — the
    // rating rules below apply to family reviews only.
    if (recommendationRoles.includes(input.role)) {
        if (input.rating !== undefined && input.rating !== 0) {
            return 'A recommendation does not take a star rating.'
        }
    } else if (
        typeof input.rating !== 'number' ||
        !Number.isInteger(input.rating) ||
        input.rating < 1 ||
        input.rating > 5
    ) {
        return 'rating must be an integer from 1 to 5.'
    }
    if (!isNonEmptyString(input.quote)) {
        return 'quote is required.'
    }
    if (input.quote.trim().length > MAX_QUOTE) {
        return `quote must be ${MAX_QUOTE} characters or fewer.`
    }
    if (input.subject !== undefined && typeof input.subject !== 'string') {
        return 'subject must be a string.'
    }
    if (
        isNonEmptyString(input.subject) &&
        input.subject.trim().length > MAX_SUBJECT
    ) {
        return `subject must be ${MAX_SUBJECT} characters or fewer.`
    }
    if (input.year !== undefined && typeof input.year !== 'string') {
        return 'year must be a string.'
    }
    if (isNonEmptyString(input.year) && input.year.trim().length > MAX_YEAR) {
        return `year must be ${MAX_YEAR} characters or fewer.`
    }
    return undefined
}

/** Validates a moderation update. Only Approved/Rejected are settable. */
export const validateTestimonialUpdate = (
    update: Partial<TestimonialUpdate> | undefined
): string | undefined => {
    if (!update || typeof update !== 'object') {
        return 'Request body must be a testimonial update object.'
    }
    if (update.status === undefined || !moderatedStatuses.includes(update.status)) {
        return `status must be one of: ${moderatedStatuses.join(', ')}.`
    }
    return undefined
}

/**
 * A testimonial submitted by a family (REQ-027).
 *
 * Anyone can submit one from the public site; it lands as `Pending` and is
 * invisible until the teacher moderates it to `Approved`. `Rejected` ones are
 * kept (so a resubmission can be spotted) but never shown. Attribution is only
 * what the submitter typed — there is no link to a real student record, so no
 * personal data is held beyond the quote and the name they chose to give.
 */
export type TestimonialStatus = 'Pending' | 'Approved' | 'Rejected'

export const testimonialStatuses: TestimonialStatus[] = [
    'Pending',
    'Approved',
    'Rejected',
]

/** Who left the review. Parent/Student are star-rated family reviews;
    Professional/Personal are RECOMMENDATIONS — endorsements without a star
    rating, shown in their own section (owner ask, 2026-08-05). */
export type TestimonialRole =
    | 'Parent'
    | 'Student'
    | 'Professional'
    | 'Personal'

export const testimonialRoles: TestimonialRole[] = [
    'Parent',
    'Student',
    'Professional',
    'Personal',
]

/** Recommendation roles carry no star rating. */
export const recommendationRoles: TestimonialRole[] = [
    'Professional',
    'Personal',
]

/** Statuses a moderation request may set — never back to Pending. */
export const moderatedStatuses: TestimonialStatus[] = ['Approved', 'Rejected']

export interface Testimonial {
    id: number
    /** Display name the submitter gave — a first name or initials are fine. */
    authorName: string
    role: TestimonialRole
    /** Optional subject the tutoring covered, e.g. "Mathematics". */
    subject?: string
    /** Optional school year, e.g. "10". */
    year?: string
    /** Star rating, 1–5 — family reviews only; recommendations have none. */
    rating?: number
    /** The written experience — plain text only (any HTML is stripped). */
    quote: string
    status: TestimonialStatus
    /**
     * Set when a profanity screen matched the name/quote (REQ-028). It does not
     * change visibility — it only highlights the review in the teacher's queue
     * for a closer look. Absent means nothing was flagged.
     */
    flagged?: boolean
    /**
     * Chosen by the teacher to show on the public Home page (REQ-059). At most
     * MAX_FEATURED reviews carry it, and only Approved ones — moderating a
     * review to anything else clears it, so a review can never be both hidden
     * and featured. Absent means not chosen.
     */
    featured?: boolean
    /** ISO date, YYYY-MM-DD, when it was submitted. */
    submittedOn: string
    /** ISO date the teacher approved/rejected it; absent while Pending. */
    moderatedOn?: string
}

/** Payload accepted by the public submit endpoint. */
export interface TestimonialInput {
    authorName: string
    role: TestimonialRole
    subject?: string
    year?: string
    rating: number
    quote: string
    /** Honeypot: a hidden field real people leave blank; bots fill it. */
    website?: string
}

/**
 * Payload accepted by the teacher moderation endpoint. Either field may be
 * sent on its own: `status` moderates the review, `featured` chooses it for
 * Home (REQ-059). A body carrying neither is rejected.
 */
export interface TestimonialUpdate {
    status?: TestimonialStatus
    featured?: boolean
}

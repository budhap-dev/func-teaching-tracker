/**
 * The public contact details shown on the Contact page (REQ-006/008).
 *
 * A single record — there is one set of details for the whole site. Both fields
 * are optional so the teacher can take either method down: an absent field means
 * "not offered" and the public page omits that row entirely.
 */

/** The three ways a family can get in touch. Call and WhatsApp share the one
    public phone number; they are separate channels because their availability
    differs (e.g. "call evenings only" vs "WhatsApp any time"). */
export type ContactChannel = 'email' | 'call' | 'whatsapp'

export const contactChannels: ContactChannel[] = ['email', 'call', 'whatsapp']

/** A short, free-text availability note per channel — prose like "Evenings
    and weekends only", not a structured timetable. Absent means no note. */
export interface ContactAvailability {
    email?: string
    call?: string
    whatsapp?: string
}

export interface Contact {
    /** Public email address, or absent when the teacher has removed it. */
    email?: string
    /** Public phone number (also used for call/WhatsApp), or absent. */
    phone?: string
    /** When to use each channel; entries only for channels that are offered. */
    availability?: ContactAvailability
    /** The channel the teacher would rather be reached on, if any. */
    preferred?: ContactChannel
}

/** Payload accepted by the teacher update endpoint — same shape, all optional.
    An empty-string `preferred` means "no preference" (a removal). */
export interface ContactInput {
    email?: string
    phone?: string
    availability?: ContactAvailability
    preferred?: ContactChannel | ''
}

/**
 * The public contact details shown on the Contact page (REQ-006/008).
 *
 * A single record — there is one set of details for the whole site. Both fields
 * are optional so the teacher can take either method down: an absent field means
 * "not offered" and the public page omits that row entirely.
 */
export interface Contact {
    /** Public email address, or absent when the teacher has removed it. */
    email?: string
    /** Public phone number (also used for call/WhatsApp), or absent. */
    phone?: string
}

/** Payload accepted by the teacher update endpoint — same shape, both optional. */
export interface ContactInput {
    email?: string
    phone?: string
}

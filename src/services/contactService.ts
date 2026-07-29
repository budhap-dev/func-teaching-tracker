import { dataStore } from '../data/store'
import {
    Contact,
    ContactAvailability,
    ContactChannel,
    ContactInput,
    contactChannels,
} from '../models/contact'

// Bounds so the public form can't be used to store an essay in a field.
const MAX_EMAIL = 254
const MAX_PHONE = 40
// An availability note is a sentence, not a timetable essay.
const MAX_NOTE = 140

// Deliberately permissive: enough to catch a fat-fingered address, not to
// adjudicate RFC 5322. One @, something before it, a dotted domain after.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Phone as people write it: digits, spaces and the usual punctuation.
const PHONE_RE = /^[+()\-.\s\d]+$/

/** Trims a field; an empty or whitespace-only value means "remove it". */
const normalize = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

/** Removes any HTML so a note is stored and shown as plain text. */
const stripHtml = (text: string): string => text.replace(/<[^>]*>/g, '').trim()

/** The current public contact details; empty fields mean "not offered". */
export const getContact = async (): Promise<Contact> => dataStore.getContact()

/**
 * Replaces the contact details. Blank fields are dropped (the teacher removing
 * that method), so the stored record only ever holds what's actually on offer.
 * Availability notes and the preferred flag survive only for channels that are
 * offered — removing the phone takes the call/WhatsApp notes (and a
 * preference for them) down with it.
 */
export const updateContact = async (input: ContactInput): Promise<Contact> => {
    const email = normalize(input.email)
    const phone = normalize(input.phone)

    const offered = (channel: ContactChannel): boolean =>
        channel === 'email' ? Boolean(email) : Boolean(phone)

    const availability: ContactAvailability = {}
    contactChannels.forEach((channel) => {
        const raw = input.availability?.[channel]
        const note = raw === undefined ? undefined : normalize(stripHtml(raw))
        if (note && offered(channel)) {
            availability[channel] = note
        }
    })

    const preferred =
        input.preferred && offered(input.preferred) ? input.preferred : undefined

    const contact: Contact = {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(Object.keys(availability).length ? { availability } : {}),
        ...(preferred ? { preferred } : {}),
    }
    await dataStore.putContact(contact)
    return contact
}

/** Validates an update, returning an error string when invalid. */
export const validateContactInput = (
    input: Partial<ContactInput> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be a contact object.'
    }
    if (input.email !== undefined && typeof input.email !== 'string') {
        return 'email must be a string.'
    }
    if (input.phone !== undefined && typeof input.phone !== 'string') {
        return 'phone must be a string.'
    }
    // Only validate the shape of values the teacher actually kept — a blank
    // field is a removal, not an error.
    const email = normalize(input.email)
    if (email) {
        if (email.length > MAX_EMAIL) {
            return `email must be ${MAX_EMAIL} characters or fewer.`
        }
        if (!EMAIL_RE.test(email)) {
            return 'email must be a valid email address.'
        }
    }
    const phone = normalize(input.phone)
    if (phone) {
        if (phone.length > MAX_PHONE) {
            return `phone must be ${MAX_PHONE} characters or fewer.`
        }
        if (!PHONE_RE.test(phone)) {
            return 'phone must contain only digits and phone punctuation.'
        }
    }
    if (input.availability !== undefined) {
        if (
            typeof input.availability !== 'object' ||
            input.availability === null ||
            Array.isArray(input.availability)
        ) {
            return 'availability must be an object of per-channel notes.'
        }
        for (const [channel, note] of Object.entries(input.availability)) {
            if (!contactChannels.includes(channel as ContactChannel)) {
                return `availability keys must be one of: ${contactChannels.join(', ')}.`
            }
            if (note !== undefined && typeof note !== 'string') {
                return `availability.${channel} must be a string.`
            }
            if (typeof note === 'string' && note.trim().length > MAX_NOTE) {
                return `availability.${channel} must be ${MAX_NOTE} characters or fewer.`
            }
        }
    }
    if (
        input.preferred !== undefined &&
        input.preferred !== '' &&
        !contactChannels.includes(input.preferred)
    ) {
        return `preferred must be one of: ${contactChannels.join(', ')}.`
    }
    return undefined
}

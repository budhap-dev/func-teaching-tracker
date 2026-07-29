import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../models/contact'

/** Mutable fake store, reset per test. */
const fake = { contact: {} as Contact }

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        getContact: async () => fake.contact,
        putContact: async (contact: Contact) => {
            fake.contact = contact
        },
    },
}))

import {
    getContact,
    updateContact,
    validateContactInput,
} from './contactService'

beforeEach(() => {
    fake.contact = {}
})

describe('getContact / updateContact', () => {
    it('returns whatever the store holds', async () => {
        fake.contact = { email: 'a@b.co', phone: '+44 7700 900000' }
        expect(await getContact()).toEqual({
            email: 'a@b.co',
            phone: '+44 7700 900000',
        })
    })

    it('stores trimmed values and returns the saved record', async () => {
        const saved = await updateContact({
            email: '  tutor@example.com ',
            phone: ' +44 7700 900123 ',
        })

        expect(saved).toEqual({
            email: 'tutor@example.com',
            phone: '+44 7700 900123',
        })
        expect(fake.contact).toEqual(saved)
    })

    it('drops a blanked field entirely — the teacher removing that method', async () => {
        fake.contact = { email: 'a@b.co', phone: '+44 7700 900000' }

        const saved = await updateContact({ email: 'a@b.co', phone: '   ' })

        expect(saved).toEqual({ email: 'a@b.co' })
        expect(saved).not.toHaveProperty('phone')
    })

    it('can clear everything', async () => {
        fake.contact = { email: 'a@b.co' }
        expect(await updateContact({})).toEqual({})
        expect(fake.contact).toEqual({})
    })

    it('stores per-channel availability notes and the preferred channel', async () => {
        const saved = await updateContact({
            email: 'a@b.co',
            phone: '+44 7700 900000',
            availability: {
                email: ' Anytime — replies within a day ',
                call: 'Evenings and weekends only',
                whatsapp: 'As per availability',
            },
            preferred: 'whatsapp',
        })

        expect(saved).toEqual({
            email: 'a@b.co',
            phone: '+44 7700 900000',
            availability: {
                email: 'Anytime — replies within a day',
                call: 'Evenings and weekends only',
                whatsapp: 'As per availability',
            },
            preferred: 'whatsapp',
        })
    })

    it('strips HTML from notes and drops blank ones', async () => {
        const saved = await updateContact({
            email: 'a@b.co',
            availability: {
                email: 'Weekdays <script>alert(1)</script>only',
                call: '   ',
            },
        })

        // Tags go, their text stays — the same treatment as a lead's goal.
        expect(saved.availability).toEqual({ email: 'Weekdays alert(1)only' })
    })

    it('drops notes and preference for a channel that is not offered', async () => {
        // No phone: call/WhatsApp notes and the WhatsApp preference all go.
        const saved = await updateContact({
            email: 'a@b.co',
            availability: {
                email: 'Anytime',
                call: 'Evenings',
                whatsapp: 'Weekends',
            },
            preferred: 'whatsapp',
        })

        expect(saved).toEqual({
            email: 'a@b.co',
            availability: { email: 'Anytime' },
        })
    })

    it('treats an empty-string preferred as clearing the preference', async () => {
        const saved = await updateContact({
            email: 'a@b.co',
            preferred: '',
        })
        expect(saved).not.toHaveProperty('preferred')
    })
})

describe('validateContactInput', () => {
    it.each([
        [undefined, 'must be a contact object'],
        [{ email: 42 }, 'email must be a string'],
        [{ phone: 42 }, 'phone must be a string'],
        [{ email: 'not-an-email' }, 'valid email address'],
        [{ email: `${'x'.repeat(255)}@b.co` }, 'characters or fewer'],
        [{ phone: 'call me maybe' }, 'phone'],
        [{ availability: 'anytime' }, 'availability must be an object'],
        [{ availability: ['anytime'] }, 'availability must be an object'],
        [
            { availability: { fax: 'never' } },
            'availability keys must be one of',
        ],
        [
            { availability: { email: 42 } },
            'availability.email must be a string',
        ],
        [
            { availability: { call: 'x'.repeat(141) } },
            '140 characters or fewer',
        ],
        [{ preferred: 'carrier-pigeon' }, 'preferred must be one of'],
    ])('rejects %j', (raw, message) => {
        expect(
            validateContactInput(
                raw as Parameters<typeof validateContactInput>[0]
            )
        ).toContain(message)
    })

    it('accepts valid values, blanks (removals) and an empty object', () => {
        expect(
            validateContactInput({
                email: 'tutor@example.com',
                phone: '+44 (0)7700 900-123',
            })
        ).toBeUndefined()
        expect(validateContactInput({ email: '', phone: '  ' })).toBeUndefined()
        expect(validateContactInput({})).toBeUndefined()
        expect(
            validateContactInput({
                availability: { whatsapp: 'As per availability' },
                preferred: 'whatsapp',
            })
        ).toBeUndefined()
        // Clearing the preference and blank notes are removals, not errors.
        expect(
            validateContactInput({ preferred: '', availability: { call: '' } })
        ).toBeUndefined()
    })
})

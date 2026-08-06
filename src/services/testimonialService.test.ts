import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Testimonial } from '../models/testimonial'

/** Mutable fake store, reset per test. */
const fake = {
    testimonials: [] as Testimonial[],
    nextId: 1,
}

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        listTestimonials: async () => fake.testimonials,
        getTestimonial: async (id: number) =>
            fake.testimonials.find((testimonial) => testimonial.id === id),
        putTestimonial: async (testimonial: Testimonial) => {
            fake.testimonials = [
                ...fake.testimonials.filter(
                    (item) => item.id !== testimonial.id
                ),
                testimonial,
            ]
        },
        deleteTestimonial: async (id: number) => {
            fake.testimonials = fake.testimonials.filter(
                (testimonial) => testimonial.id !== id
            )
        },
        nextTestimonialId: async () => fake.nextId++,
    },
}))

import {
    createTestimonial,
    deleteTestimonial,
    listApprovedTestimonials,
    listPendingTestimonials,
    setTestimonialStatus,
    validateTestimonialInput,
    validateTestimonialUpdate,
} from './testimonialService'

const testimonial = (overrides: Partial<Testimonial> = {}): Testimonial => ({
    id: 1,
    authorName: 'Nadia',
    role: 'Parent',
    rating: 5,
    quote: 'Brilliant tutoring.',
    status: 'Approved',
    submittedOn: '2026-05-01',
    ...overrides,
})

const input = (overrides: Record<string, unknown> = {}) => ({
    authorName: 'Jo',
    role: 'Parent' as const,
    rating: 5,
    quote: 'Really helped.',
    ...overrides,
})

beforeEach(() => {
    fake.testimonials = []
    fake.nextId = 1
})

describe('listing', () => {
    it('returns only Approved reviews publicly, newest first', async () => {
        fake.testimonials = [
            testimonial({ id: 1, submittedOn: '2026-01-01' }),
            testimonial({ id: 2, status: 'Pending', submittedOn: '2026-06-01' }),
            testimonial({ id: 3, submittedOn: '2026-03-01' }),
            testimonial({ id: 4, status: 'Rejected', submittedOn: '2026-04-01' }),
        ]

        const approved = await listApprovedTestimonials()

        expect(approved.map((item) => item.id)).toEqual([3, 1])
    })

    it('queues only Pending reviews for the teacher, newest first', async () => {
        fake.testimonials = [
            testimonial({ id: 1, status: 'Pending', submittedOn: '2026-01-01' }),
            testimonial({ id: 2, submittedOn: '2026-06-01' }),
            testimonial({ id: 3, status: 'Pending', submittedOn: '2026-02-01' }),
        ]

        const pending = await listPendingTestimonials()

        expect(pending.map((item) => item.id)).toEqual([3, 1])
    })
})

describe('createTestimonial', () => {
    it('stores a trimmed submission as Pending', async () => {
        const created = await createTestimonial(
            input({
                authorName: '  Jo  ',
                subject: ' Maths ',
                year: ' 10 ',
            }) as Parameters<typeof createTestimonial>[0]
        )

        expect(created).toMatchObject({
            authorName: 'Jo',
            subject: 'Maths',
            year: '10',
            status: 'Pending',
        })
        expect(fake.testimonials).toHaveLength(1)
    })

    it('stores a Professional recommendation without any rating (2026-08-05)', async () => {
        const created = await createTestimonial(
            input({
                role: 'Professional',
                rating: undefined,
            }) as Parameters<typeof createTestimonial>[0]
        )

        expect(created).toMatchObject({
            role: 'Professional',
            status: 'Pending',
        })
        expect(created).not.toHaveProperty('rating')
    })

    it('silently drops a submission with the honeypot filled', async () => {
        const created = await createTestimonial(
            input({ website: 'http://bot.example' }) as Parameters<
                typeof createTestimonial
            >[0]
        )

        expect(created).toBeNull()
        expect(fake.testimonials).toHaveLength(0)
    })

    it('strips HTML from the quote so nothing executable is stored', async () => {
        const created = await createTestimonial(
            input({
                quote: 'Great <script>alert("x")</script> <b>tutor</b>!',
            }) as Parameters<typeof createTestimonial>[0]
        )

        expect(created!.quote).toBe('Great alert("x") tutor!')
    })

    it('omits blank optional fields entirely', async () => {
        const created = await createTestimonial(
            input({ subject: '  ', year: undefined }) as Parameters<
                typeof createTestimonial
            >[0]
        )

        expect(created).not.toHaveProperty('subject')
        expect(created).not.toHaveProperty('year')
    })
})

describe('moderation', () => {
    it('approves a pending review, stamping the moderation date', async () => {
        fake.testimonials = [testimonial({ id: 5, status: 'Pending' })]

        const updated = await setTestimonialStatus(5, 'Approved')

        expect(updated!.status).toBe('Approved')
        expect(updated!.moderatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(fake.testimonials[0].status).toBe('Approved')
    })

    it('returns undefined for an unknown id', async () => {
        expect(await setTestimonialStatus(99, 'Approved')).toBeUndefined()
    })

    it('deletes a review permanently, reporting whether it existed', async () => {
        fake.testimonials = [testimonial({ id: 5 })]

        expect(await deleteTestimonial(5)).toBe(true)
        expect(fake.testimonials).toHaveLength(0)
        expect(await deleteTestimonial(5)).toBe(false)
    })
})

describe('validateTestimonialInput', () => {
    it.each([
        [undefined, 'must be a testimonial object'],
        [input({ authorName: '  ' }), 'authorName is required'],
        [input({ authorName: 'x'.repeat(81) }), 'characters or fewer'],
        [input({ role: 'Teacher' }), 'role must be one of'],
        [
            input({ role: 'Personal', rating: 5 }),
            'does not take a star rating',
        ],
        [input({ rating: 0 }), 'rating'],
        [input({ rating: 5.5 }), 'rating'],
        [input({ quote: ' ' }), 'quote is required'],
        [input({ quote: 'x'.repeat(601) }), 'characters or fewer'],
    ])('rejects %j', (raw, message) => {
        expect(
            validateTestimonialInput(
                raw as Parameters<typeof validateTestimonialInput>[0]
            )
        ).toContain(message)
    })

    it('accepts a valid submission, optional fields present or not', () => {
        expect(validateTestimonialInput(input())).toBeUndefined()
        expect(
            validateTestimonialInput(
                input({ subject: 'Maths', year: '10', website: '' })
            )
        ).toBeUndefined()
    })
})

describe('validateTestimonialUpdate', () => {
    it('accepts only Approved and Rejected', () => {
        expect(validateTestimonialUpdate({ status: 'Approved' })).toBeUndefined()
        expect(validateTestimonialUpdate({ status: 'Rejected' })).toBeUndefined()
        expect(validateTestimonialUpdate({ status: 'Pending' })).toBeTruthy()
        expect(validateTestimonialUpdate(undefined)).toBeTruthy()
    })
})

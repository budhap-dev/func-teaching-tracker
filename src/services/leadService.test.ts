import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lead } from '../models/lead'

/** Mutable fake store, reset per test. */
const fake = {
    leads: [] as Lead[],
    nextId: 1,
}

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        listLeads: async () => fake.leads,
        getLead: async (id: number) =>
            fake.leads.find((lead) => lead.id === id),
        putLead: async (lead: Lead) => {
            fake.leads = [
                ...fake.leads.filter((item) => item.id !== lead.id),
                lead,
            ]
        },
        deleteLead: async (id: number) => {
            fake.leads = fake.leads.filter((item) => item.id !== id)
        },
        nextLeadId: async () => fake.nextId++,
    },
}))

import {
    createLead,
    deleteLead,
    listLeads,
    setLeadStatus,
    validateLeadInput,
    validateLeadUpdate,
} from './leadService'

const lead = (overrides: Partial<Lead> = {}): Lead => ({
    id: 1,
    parentName: 'Nadia Patel',
    email: 'nadia@example.com',
    year: '10',
    subjects: ['Mathematics'],
    goal: 'Confidence before GCSEs.',
    mode: 'Online',
    status: 'New',
    submittedOn: '2026-07-01',
    ...overrides,
})

const input = (overrides: Record<string, unknown> = {}) => ({
    parentName: 'Jo Bloggs',
    email: 'jo@example.com',
    year: '9',
    subjects: ['Physics'],
    goal: 'Catch up after a term off.',
    mode: 'Either' as const,
    ...overrides,
})

beforeEach(() => {
    fake.leads = []
    fake.nextId = 1
})

describe('listLeads', () => {
    it('returns the inbox newest first, id breaking date ties', async () => {
        fake.leads = [
            lead({ id: 1, submittedOn: '2026-07-01' }),
            lead({ id: 3, submittedOn: '2026-07-10' }),
            lead({ id: 2, submittedOn: '2026-07-10' }),
        ]

        const inbox = await listLeads()

        expect(inbox.map((item) => item.id)).toEqual([3, 2, 1])
    })
})

describe('createLead', () => {
    it('stores a trimmed enquiry as New', async () => {
        const created = await createLead(
            input({
                parentName: '  Jo Bloggs ',
                phone: ' +44 7700 900123 ',
                email: undefined,
                subjects: [' Physics ', 'Maths'],
            }) as Parameters<typeof createLead>[0]
        )

        expect(created).toMatchObject({
            parentName: 'Jo Bloggs',
            phone: '+44 7700 900123',
            subjects: ['Physics', 'Maths'],
            status: 'New',
        })
        expect(created).not.toHaveProperty('email')
        expect(created!.submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(fake.leads).toHaveLength(1)
    })

    it('silently drops a submission with the honeypot filled', async () => {
        const created = await createLead(
            input({ website: 'http://bot.example' }) as Parameters<
                typeof createLead
            >[0]
        )

        expect(created).toBeNull()
        expect(fake.leads).toHaveLength(0)
    })

    it('strips HTML from the goal so nothing executable is stored', async () => {
        const created = await createLead(
            input({
                goal: 'Help with <script>alert("x")</script> <b>revision</b>.',
            }) as Parameters<typeof createLead>[0]
        )

        expect(created!.goal).toBe('Help with alert("x") revision.')
    })
})

describe('setLeadStatus', () => {
    it('moves a lead through the inbox', async () => {
        fake.leads = [lead({ id: 5 })]

        const updated = await setLeadStatus(5, 'Contacted')

        expect(updated!.status).toBe('Contacted')
        expect(fake.leads[0].status).toBe('Contacted')
    })

    it('returns undefined for an unknown id', async () => {
        expect(await setLeadStatus(99, 'Contacted')).toBeUndefined()
    })
})

describe('validateLeadInput', () => {
    it.each([
        [undefined, 'must be an enquiry object'],
        [input({ parentName: '  ' }), 'parentName is required'],
        [input({ parentName: 'x'.repeat(81) }), 'characters or fewer'],
        [input({ email: undefined, phone: undefined }), 'A contact is required'],
        [input({ email: 'not-an-email' }), 'valid email address'],
        [input({ email: undefined, phone: '12ab34' }), 'valid phone number'],
        [input({ email: undefined, phone: '+44 123' }), 'valid phone number'],
        [input({ year: ' ' }), 'year is required'],
        [input({ subjects: [] }), 'non-empty list'],
        [input({ subjects: ['ok', '  '] }), 'non-empty list'],
        [input({ subjects: Array(9).fill('Maths') }), '8 or fewer'],
        [input({ goal: ' ' }), 'goal is required'],
        [input({ goal: 'x'.repeat(1001) }), 'characters or fewer'],
        [input({ mode: 'Carrier pigeon' }), 'mode must be one of'],
    ])('rejects %j', (raw, message) => {
        expect(
            validateLeadInput(raw as Parameters<typeof validateLeadInput>[0])
        ).toContain(message)
    })

    it('accepts a valid enquiry with either contact method', () => {
        expect(validateLeadInput(input())).toBeUndefined()
        expect(
            validateLeadInput(
                input({ email: undefined, phone: '+44 7700 900123' })
            )
        ).toBeUndefined()
        expect(validateLeadInput(input({ website: '' }))).toBeUndefined()
    })
})

describe('validateLeadUpdate', () => {
    it('accepts the three statuses and rejects anything else', () => {
        expect(validateLeadUpdate({ status: 'New' })).toBeUndefined()
        expect(validateLeadUpdate({ status: 'Contacted' })).toBeUndefined()
        expect(validateLeadUpdate({ status: 'Converted' })).toBeUndefined()
        expect(validateLeadUpdate({ status: 'Won' as never })).toBeTruthy()
        expect(validateLeadUpdate(undefined)).toBeTruthy()
    })
})

describe('deleteLead', () => {
    it('erases an enquiry permanently, reporting whether it existed', async () => {
        fake.leads = [lead({ id: 7 })]

        expect(await deleteLead(7)).toBe(true)
        expect(fake.leads).toHaveLength(0)
        // Idempotent from the caller's view: a second delete is a clean miss.
        expect(await deleteLead(7)).toBe(false)
    })

    it('leaves other enquiries untouched', async () => {
        fake.leads = [lead({ id: 1 }), lead({ id: 2, parentName: 'Sam Ba' })]

        await deleteLead(1)

        expect(fake.leads.map((item) => item.id)).toEqual([2])
    })
})

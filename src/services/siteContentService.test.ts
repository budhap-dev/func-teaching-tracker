import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteContent } from '../models/siteContent'
import { defaultSiteContent } from '../data/defaultSiteContent'

/** Mutable fake store, reset per test. */
const fake = { content: undefined as SiteContent | undefined }

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        getSiteContent: async () => fake.content,
        putSiteContent: async (content: SiteContent) => {
            fake.content = content
        },
    },
}))

import {
    getSiteContent,
    updateSiteContent,
    validateSiteContentInput,
} from './siteContentService'

/** A valid publish payload, tweakable per test. */
const input = (overrides: Record<string, unknown> = {}) =>
    ({
        ...structuredClone(defaultSiteContent),
        freeform: { heading: 'Notices', markdown: 'Term starts **soon**.' },
        ...overrides,
    }) as SiteContent

beforeEach(() => {
    fake.content = undefined
})

describe('getSiteContent', () => {
    it('serves the bundled defaults until the teacher publishes', async () => {
        expect(await getSiteContent()).toEqual(defaultSiteContent)
    })

    it('serves the published document once one exists', async () => {
        fake.content = input({ siteName: 'Harbour Tuition' })
        expect((await getSiteContent()).siteName).toBe('Harbour Tuition')
    })
})

describe('updateSiteContent', () => {
    it('publishes atomically — the next read sees the new document', async () => {
        const published = await updateSiteContent(
            input({ siteName: 'Harbour Tuition' })
        )

        expect(published.siteName).toBe('Harbour Tuition')
        expect(await getSiteContent()).toEqual(published)
    })

    it('strips raw HTML from every field on write, keeping Markdown', async () => {
        const published = await updateSiteContent(
            input({
                siteName: 'Abhi<script>alert(1)</script>Tutor',
                hero: {
                    headline: 'Confident <b>tutoring</b>.',
                    subhead: 'Lessons <img src=x onerror=alert(1)> weekly.',
                    availability: '',
                },
                freeform: {
                    heading: 'About <i>us</i>',
                    markdown:
                        'We teach **properly**.\n<script>alert(1)</script>\n- and *kindly*',
                },
            })
        )

        expect(published.siteName).toBe('AbhiTutor')
        expect(published.hero.headline).toBe('Confident tutoring.')
        expect(published.hero.subhead).toBe('Lessons  weekly.')
        // Markdown markup survives; tags don't.
        expect(published.freeform.markdown).toContain('**properly**')
        expect(published.freeform.markdown).toContain('- and *kindly*')
        expect(published.freeform.markdown).not.toContain('<script>')
    })

    it('fills an older published document with EMPTY bio/faq, never the drafts', async () => {
        // A document from before REQ-021/025: no bio, no faq, 5-key order.
        const {
            bio: _bio,
            faq: _faq,
            ...older
        } = input({
            sectionOrder: undefined as never,
        })
        fake.content = {
            ...older,
            sectionOrder: [
                'hero',
                'subjects',
                'journey',
                'approach',
                'freeform',
            ],
        } as never

        const served = await getSiteContent()
        // Empty — the owner never approved the bundled draft FAQ.
        expect(served.faq).toEqual([])
        expect(served.bio.dbsChecked).toBe(false)
        expect(served.bio.heading).toBe('')
        // The new keys join the end, every key exactly once.
        expect(served.sectionOrder).toEqual([
            'hero',
            'subjects',
            'journey',
            'approach',
            'freeform',
            'bio',
            'faq',
        ])
    })

    it('sanitises bio and faq on write: HTML out, blanks dropped, DBS is strictly boolean', async () => {
        const published = await updateSiteContent(
            input({
                bio: {
                    heading: 'Meet <b>your tutor</b>',
                    body: 'Twenty years of **maths**.<script>alert(1)</script>',
                    qualifications: ['PGCE <i>Maths</i>', '   ', 'BSc Physics'],
                    dbsChecked: 'yes' as never,
                    safeguarding: 'DBS on the <u>update service</u>.',
                },
                faq: [
                    { question: 'Online?', answer: 'Yes<script>x</script>.' },
                    { question: '  ', answer: 'orphaned answer' },
                ],
            })
        )

        expect(published.bio.heading).toBe('Meet your tutor')
        expect(published.bio.body).toBe('Twenty years of **maths**.')
        expect(published.bio.qualifications).toEqual([
            'PGCE Maths',
            'BSc Physics',
        ])
        // A truthy non-boolean never switches the indicator on.
        expect(published.bio.dbsChecked).toBe(false)
        expect(published.bio.safeguarding).toBe('DBS on the update service.')
        expect(published.faq).toEqual([{ question: 'Online?', answer: 'Yes.' }])
    })

    it('sanitises pricing: floors rates, drops half-rows and titleless factors', async () => {
        const base = input({}).pricing
        const published = await updateSiteContent(
            input({
                pricing: {
                    ...base,
                    rates: [
                        { label: 'GCSE<b>!</b>', fromPerHour: 20.9 },
                        { label: '  ', fromPerHour: 25 },
                        { label: 'A-level', fromPerHour: -5 },
                        { label: 'Degree', fromPerHour: 5000 },
                    ],
                    factors: [
                        { title: '  ', detail: 'orphan detail' },
                        { title: 'Group<b>!</b>', detail: 'Shared.' },
                    ],
                    note: 'Agreed at the <i>assessment</i>.',
                },
            })
        )
        expect(published.pricing.rates).toEqual([
            { label: 'GCSE!', fromPerHour: 20 },
            { label: 'Degree', fromPerHour: 999 },
        ])
        expect(published.pricing.factors).toEqual([
            { title: 'Group!', detail: 'Shared.' },
        ])
        expect(published.pricing.note).toBe('Agreed at the assessment.')
    })

    it('fills an older published document with EMPTY pricing — never the default rates', async () => {
        const { pricing: _pricing, ...older } = input({})
        fake.content = older as never

        const served = await getSiteContent()
        expect(served.pricing.rates).toEqual([])
        expect(served.pricing.factors).toEqual([])
    })

    it('keeps a sane experience-years figure and drops a nonsense one', async () => {
        const base = input({}).hero
        const kept = await updateSiteContent(
            input({ hero: { ...base, experienceYears: 20.9 } })
        )
        expect(kept.hero.experienceYears).toBe(20)

        const capped = await updateSiteContent(
            input({ hero: { ...base, experienceYears: 500 } })
        )
        expect(capped.hero.experienceYears).toBe(99)

        const negative = await updateSiteContent(
            input({ hero: { ...base, experienceYears: -3 } })
        )
        expect(negative.hero.experienceYears).toBeUndefined()

        const { experienceYears: _unused, ...bare } = base
        const absent = await updateSiteContent(input({ hero: bare }))
        expect(absent.hero.experienceYears).toBeUndefined()
    })

    it('trims and preserves the chosen section order', async () => {
        const published = await updateSiteContent(
            input({
                sectionOrder: [
                    'freeform',
                    'hero',
                    'subjects',
                    'approach',
                    'journey',
                ],
            })
        )
        expect(published.sectionOrder).toEqual([
            'freeform',
            'hero',
            'subjects',
            'approach',
            'journey',
        ])
    })

    it('drops empty optional subject tag lists', async () => {
        const published = await updateSiteContent(
            input({
                subjects: [{ name: ' Maths ', keyStages: [] }],
            })
        )
        expect(published.subjects[0]).toEqual({ name: 'Maths' })
    })
})

describe('validateSiteContentInput', () => {
    it.each([
        [undefined, 'must be a site-content object'],
        [input({ siteName: ' ' }), 'siteName is required'],
        [input({ siteName: 'x'.repeat(61) }), 'characters or fewer'],
        [input({ hero: undefined }), 'hero is required'],
        [
            input({ hero: { headline: '', subhead: 'x', availability: '' } }),
            'hero.headline is required',
        ],
        [input({ subjects: [] }), 'subjects must be a non-empty list'],
        [input({ subjects: [{ name: ' ' }] }), 'subjects[0].name is required'],
        [
            input({ subjects: [{ name: 'Maths', examBoards: ['', 'AQA'] }] }),
            'examBoards must be a list of names',
        ],
        [input({ journey: [] }), 'journey must be a non-empty list'],
        [
            input({ journey: [{ title: 'Enquire', detail: ' ' }] }),
            'journey[0].detail is required',
        ],
        [input({ approach: [{ title: '', detail: 'x' }] }), 'approach[0].title'],
        [input({ freeform: undefined }), 'freeform is required'],
        [
            input({ freeform: { heading: 'x', markdown: 'y'.repeat(5001) } }),
            'freeform.markdown must be 5000',
        ],
        [
            input({ sectionOrder: ['hero', 'subjects'] }),
            'sectionOrder must contain each of',
        ],
        [
            input({
                sectionOrder: [
                    'hero',
                    'hero',
                    'subjects',
                    'journey',
                    'approach',
                ],
            }),
            'sectionOrder must contain each of',
        ],
    ])('rejects %j', (raw, message) => {
        expect(
            validateSiteContentInput(
                raw as Parameters<typeof validateSiteContentInput>[0]
            )
        ).toContain(message)
    })

    it('accepts the defaults and an empty availability line', () => {
        expect(validateSiteContentInput(input())).toBeUndefined()
        expect(
            validateSiteContentInput(
                input({
                    hero: { ...defaultSiteContent.hero, availability: '' },
                })
            )
        ).toBeUndefined()
    })
})

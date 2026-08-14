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
        // The bio is different (owner call 2026-08-04): a blank bio serves
        // the owner's own prepared About copy — approved by provision.
        expect(served.bio).toEqual(defaultSiteContent.bio)
        expect(served.bio.dbsChecked).toBe(false)
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
                    experience: [
                        {
                            years: '2019',
                            title: 'Tutor <b>UK</b>',
                            place: '',
                            detail: '',
                        },
                        { years: '', title: '  ', place: 'x', detail: 'x' },
                    ],
                    education: [],
                    expectations: ['Patient <i>teaching</i>', '  '],
                    sections: [
                        { heading: '', markdown: '' },
                        {
                            heading: 'Promise',
                            markdown: 'Better than <b>yesterday</b>.',
                        },
                    ],
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
        // REQ-037 lists: cleaned, titleless/blank rows dropped.
        expect(published.bio.experience).toEqual([
            { years: '2019', title: 'Tutor UK', place: '', detail: '' },
        ])
        expect(published.bio.expectations).toEqual(['Patient teaching'])
        expect(published.bio.sections).toEqual([
            { heading: 'Promise', markdown: 'Better than yesterday.' },
        ])
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

    it('masthead pill: sanitised on write, blank stays blank, missing takes the default', async () => {
        const published = await updateSiteContent(
            input({ mastheadPill: '  Enrolling <b>now</b> • {year}  ' })
        )
        expect(published.mastheadPill).toBe('Enrolling now • {year}')

        // The owner blanking the pill is a choice — reads keep it hidden.
        await updateSiteContent(input({ mastheadPill: '' }))
        expect((await getSiteContent()).mastheadPill).toBe('')

        // Only a pre-pill document (no field at all) takes the default.
        const { mastheadPill: _pill, ...older } = input()
        fake.content = older as never
        expect((await getSiteContent()).mastheadPill).toBe(
            defaultSiteContent.mastheadPill
        )
    })

    it('home copy: sanitised on write, blanks kept, missing lines take the default', async () => {
        const published = await updateSiteContent(
            input({
                home: {
                    ...defaultSiteContent.home,
                    ctaLabel: '  Book a <b>free</b> chat  ',
                    journeyHeading: '',
                },
            })
        )
        expect(published.home.ctaLabel).toBe('Book a free chat')
        // Blank travels: the view, not the API, supplies the fallback.
        expect(published.home.journeyHeading).toBe('')

        // A document published before a line existed keeps the shipped
        // wording for that line and its own for the rest.
        fake.content = {
            ...input(),
            home: { ctaLabel: 'Start here' },
        } as never
        const older = await getSiteContent()
        expect(older.home.ctaLabel).toBe('Start here')
        expect(older.home.highlightsHeading).toBe(
            defaultSiteContent.home.highlightsHeading
        )

        // A pre-home document takes the whole block.
        const { home: _home, ...oldest } = input()
        fake.content = oldest as never
        expect((await getSiteContent()).home).toEqual(defaultSiteContent.home)
    })
})

describe('validateSiteContentInput', () => {
    it('rejects an over-long or non-string area served, allows empty', () => {
        expect(
            validateSiteContentInput(input({ areaServed: 'x'.repeat(61) }))
        ).toMatch(/areaServed/)
        expect(
            validateSiteContentInput(input({ areaServed: 7 as never }))
        ).toMatch(/areaServed/)
        expect(
            validateSiteContentInput(input({ areaServed: '' }))
        ).toBeUndefined()
    })

    it('rejects home copy that is missing, mistyped or over-long; allows empty', () => {
        expect(validateSiteContentInput(input({ home: undefined }))).toMatch(
            /home must be an object/
        )
        expect(
            validateSiteContentInput(
                input({
                    home: { ...defaultSiteContent.home, ctaLabel: 7 },
                })
            )
        ).toMatch(/home\.ctaLabel/)
        // The description is a search snippet, so it gets the longer cap.
        expect(
            validateSiteContentInput(
                input({
                    home: {
                        ...defaultSiteContent.home,
                        metaDescription: 'x'.repeat(201),
                    },
                })
            )
        ).toMatch(/home\.metaDescription/)
        expect(
            validateSiteContentInput(
                input({
                    home: {
                        ...defaultSiteContent.home,
                        metaTitle: 'x'.repeat(61),
                    },
                })
            )
        ).toMatch(/home\.metaTitle/)
        // Every line may be cleared — the view falls back.
        expect(
            validateSiteContentInput(
                input({
                    home: {
                        metaTitle: '',
                        metaDescription: '',
                        ctaLabel: '',
                        exploreLabel: '',
                        highlightsHeading: '',
                        journeyHeading: '',
                    },
                })
            )
        ).toBeUndefined()
    })

    it('rejects an over-long or non-string masthead pill, allows empty', () => {
        expect(
            validateSiteContentInput(input({ mastheadPill: 'x'.repeat(61) }))
        ).toMatch(/mastheadPill/)
        expect(
            validateSiteContentInput(input({ mastheadPill: 7 as never }))
        ).toMatch(/mastheadPill/)
        expect(
            validateSiteContentInput(input({ mastheadPill: '' }))
        ).toBeUndefined()
    })

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

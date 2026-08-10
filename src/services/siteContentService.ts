import { dataStore } from '../data/store'
import { defaultSiteContent } from '../data/defaultSiteContent'
import {
    SectionKey,
    sectionKeys,
    SiteContent,
    SiteContentInput,
} from '../models/siteContent'

// Length caps: generous for real copy, tight enough that the endpoint can't
// be used as free storage. The markdown body is the long field.
const MAX_NAME = 60
const MAX_LINE = 200
const MAX_SUBHEAD = 400
const MAX_LIST = 12
const MAX_TAGS = 8
const MAX_TAG = 30
const MAX_DETAIL = 400
const MAX_MARKDOWN = 5000
const MAX_FAQ = 20
const MAX_ANSWER = 600
const MAX_QUALIFICATIONS = 12
// The phone tab bar's configurable pages (REQ-049); 'menu' is implicit.
const MOBILE_NAV_KEYS = [
    'home',
    'offerings',
    'pricing',
    'enquire',
    'about',
    'reviews',
    'faq',
    'contact',
] as const

/**
 * Strips raw HTML from a value on write (REQ-008's API-side control): the
 * stored document never contains tags, so no renderer downstream can be
 * tricked into emitting them. Script/style blocks lose their contents too —
 * stripping only the tags would leave the payload behind as text. Markdown
 * markup survives untouched.
 */
const stripHtml = (text: string): string =>
    text
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]*>/g, '')

const clean = (text: string): string => stripHtml(text).trim()

/** A browser-downscaled portrait: jpeg/png/webp data-URI, ≤16k chars so
    the single-property document stays far below Table Storage's 64KB. */
const PHOTO_PATTERN =
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{1,16000}$/

/** A bio with no heading, body or experience has nothing to say — serve
    the owner's prepared About copy instead. */
const withPreparedBioFallback = (
    bio: SiteContent['bio']
): SiteContent['bio'] =>
    !bio.heading && !bio.body && bio.experience.length === 0
        ? defaultSiteContent.bio
        : bio

/** The all-empty bio: what older documents' gaps are filled with. */
const EMPTY_BIO = {
    heading: '',
    photo: '',
    body: '',
    qualifications: [],
    dbsChecked: false,
    safeguarding: '',
    experience: [],
    education: [],
    expectations: [],
    sections: [],
}

/** The published content, or the bundled defaults when none exists yet. */
export const getSiteContent = async (): Promise<SiteContent> => {
    const stored = await dataStore.getSiteContent()
    if (!stored) {
        return defaultSiteContent
    }
    // A document published before bio/faq existed (REQ-021/025) is filled
    // with EMPTY sections — never the bundled drafts, which would put words
    // on the live site the owner hasn't approved — and the new keys join
    // the end of its section order.
    return {
        ...stored,
        // Older documents may predate any of the bio's fields (REQ-021 and
        // REQ-037 grew it in stages) — fill every gap empty, stored wins.
        // A bio with no substance serves the owner's PREPARED copy instead
        // (owner call 2026-08-04): these are the owner's own words, given
        // for publication — never-invent protects against unapproved
        // content, and this content is approved.
        bio: withPreparedBioFallback({
            ...EMPTY_BIO,
            ...(stored.bio ?? {}),
        }),
        faq: stored.faq ?? [],
        // Empty pricing: the from-price never appears unpublished.
        pricing: stored.pricing ?? { rates: [], factors: [], note: '' },
        // Owner-approved by provision (2026-08-05), like the About copy.
        highlights: stored.highlights ?? defaultSiteContent.highlights,
        services: stored.services ?? defaultSiteContent.services,
        modesLabel: stored.modesLabel ?? 'Delivery',
        mobileNav: stored.mobileNav ?? defaultSiteContent.mobileNav,
        sectionOrder: [
            ...stored.sectionOrder,
            ...sectionKeys.filter(
                (key) => !stored.sectionOrder.includes(key)
            ),
        ],
    }
}

/**
 * Publishes the whole document atomically — live for the next public GET,
 * no rebuild or deploy. Every text field is HTML-stripped and trimmed here,
 * on the API side, regardless of what the browser did.
 */
export const updateSiteContent = async (
    input: SiteContentInput
): Promise<SiteContent> => {
    const content: SiteContent = {
        siteName: clean(input.siteName),
        hero: {
            headline: clean(input.hero.headline),
            subhead: clean(input.hero.subhead),
            availability: clean(input.hero.availability),
            // A whole number of years, 1–99; anything else means "no tile".
            ...(Number.isFinite(input.hero.experienceYears) &&
            Math.floor(input.hero.experienceYears!) > 0
                ? {
                      experienceYears: Math.min(
                          Math.floor(input.hero.experienceYears!),
                          99
                      ),
                  }
                : {}),
        },
        subjects: input.subjects.map((subject) => ({
            name: clean(subject.name),
            ...(subject.keyStages?.length
                ? { keyStages: subject.keyStages.map(clean) }
                : {}),
            ...(subject.examBoards?.length
                ? { examBoards: subject.examBoards.map(clean) }
                : {}),
            ...(subject.modes?.length
                ? { modes: subject.modes.map(clean) }
                : {}),
        })),
        journey: input.journey.map((step) => ({
            title: clean(step.title),
            detail: clean(step.detail),
        })),
        approach: input.approach.map((point) => ({
            title: clean(point.title),
            detail: clean(point.detail),
        })),
        bio: {
            heading: clean(input.bio.heading),
            // Markdown keeps its markup; only raw HTML is removed.
            body: stripHtml(input.bio.body).trim(),
            qualifications: input.bio.qualifications
                .map(clean)
                .filter((line) => line.length > 0),
            dbsChecked: input.bio.dbsChecked === true,
            safeguarding: clean(input.bio.safeguarding),
            // Only a well-formed, small image data-URI survives.
            photo: PHOTO_PATTERN.test(input.bio.photo) ? input.bio.photo : '',
            experience: input.bio.experience
                .map((entry) => ({
                    years: clean(entry.years),
                    title: clean(entry.title),
                    place: clean(entry.place),
                    detail: clean(entry.detail),
                }))
                .filter((entry) => entry.title.length > 0),
            education: input.bio.education
                .map((entry) => ({
                    years: clean(entry.years),
                    title: clean(entry.title),
                    place: clean(entry.place),
                    detail: clean(entry.detail),
                }))
                .filter((entry) => entry.title.length > 0),
            expectations: input.bio.expectations
                .map(clean)
                .filter((line) => line.length > 0),
            sections: input.bio.sections
                .map((section) => ({
                    heading: clean(section.heading),
                    markdown: stripHtml(section.markdown).trim(),
                }))
                .filter(
                    (section) =>
                        section.heading.length > 0 ||
                        section.markdown.length > 0
                ),
        },
        faq: input.faq
            .map((item) => ({
                question: clean(item.question),
                answer: clean(item.answer),
            }))
            .filter((item) => item.question.length > 0),
        pricing: {
            // A rate needs both halves: a level label and whole pounds
            // 1-999. Anything else drops the row.
            rates: input.pricing.rates
                .map((rate) => ({
                    label: clean(rate.label),
                    fromPerHour: Number.isFinite(rate.fromPerHour)
                        ? Math.min(Math.max(Math.floor(rate.fromPerHour), 0), 999)
                        : 0,
                }))
                .filter(
                    (rate) => rate.label.length > 0 && rate.fromPerHour > 0
                ),
            factors: input.pricing.factors
                .map((factor) => ({
                    title: clean(factor.title),
                    detail: clean(factor.detail),
                }))
                .filter((factor) => factor.title.length > 0),
            note: clean(input.pricing.note),
        },
        highlights: input.highlights
            .map(clean)
            .filter((line) => line.length > 0),
        services: input.services
            .map(clean)
            .filter((line) => line.length > 0),
        modesLabel: clean(input.modesLabel) || 'Delivery',
        mobileNav: {
            items: input.mobileNav.items
                .map((key) => clean(key).toLowerCase())
                .filter((key) =>
                    (MOBILE_NAV_KEYS as readonly string[]).includes(key)
                )
                .slice(0, 3),
            spotlight: (MOBILE_NAV_KEYS as readonly string[]).includes(
                clean(input.mobileNav.spotlight).toLowerCase()
            )
                ? clean(input.mobileNav.spotlight).toLowerCase()
                : 'enquire',
        },
        freeform: {
            heading: clean(input.freeform.heading),
            // Markdown keeps its markup; only raw HTML is removed.
            markdown: stripHtml(input.freeform.markdown).trim(),
        },
        sectionOrder: [...input.sectionOrder],
    }
    await dataStore.putSiteContent(content)
    return content
}

const isString = (value: unknown): value is string => typeof value === 'string'

const isNonEmptyString = (value: unknown): value is string =>
    isString(value) && value.trim().length > 0

/** A short titled-detail pair (journey step / approach point). */
const pairError = (
    value: unknown,
    at: string
): string | undefined => {
    const pair = value as { title?: unknown; detail?: unknown }
    if (!pair || typeof pair !== 'object') {
        return `${at} must be an object.`
    }
    if (!isNonEmptyString(pair.title)) {
        return `${at}.title is required.`
    }
    if (pair.title.trim().length > MAX_LINE) {
        return `${at}.title must be ${MAX_LINE} characters or fewer.`
    }
    if (!isNonEmptyString(pair.detail)) {
        return `${at}.detail is required.`
    }
    if (pair.detail.trim().length > MAX_DETAIL) {
        return `${at}.detail must be ${MAX_DETAIL} characters or fewer.`
    }
    return undefined
}

const tagListError = (
    value: unknown,
    at: string
): string | undefined => {
    if (value === undefined) {
        return undefined
    }
    if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
        return `${at} must be a list of names.`
    }
    if (value.length > MAX_TAGS) {
        return `${at} must list ${MAX_TAGS} or fewer.`
    }
    if (value.some((tag) => tag.trim().length > MAX_TAG)) {
        return `${at} entries must be ${MAX_TAG} characters or fewer.`
    }
    return undefined
}

/** Validates a publish payload, returning an error string when invalid. */
export const validateSiteContentInput = (
    input: Partial<SiteContentInput> | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Request body must be a site-content object.'
    }
    if (!isNonEmptyString(input.siteName)) {
        return 'siteName is required.'
    }
    if (input.siteName.trim().length > MAX_NAME) {
        return `siteName must be ${MAX_NAME} characters or fewer.`
    }

    const hero = input.hero as SiteContent['hero'] | undefined
    if (!hero || typeof hero !== 'object') {
        return 'hero is required.'
    }
    if (!isNonEmptyString(hero.headline)) {
        return 'hero.headline is required.'
    }
    if (hero.headline.trim().length > MAX_LINE) {
        return `hero.headline must be ${MAX_LINE} characters or fewer.`
    }
    if (!isNonEmptyString(hero.subhead)) {
        return 'hero.subhead is required.'
    }
    if (hero.subhead.trim().length > MAX_SUBHEAD) {
        return `hero.subhead must be ${MAX_SUBHEAD} characters or fewer.`
    }
    if (!isString(hero.availability)) {
        return 'hero.availability must be a string (may be empty).'
    }
    if (hero.availability.trim().length > MAX_LINE) {
        return `hero.availability must be ${MAX_LINE} characters or fewer.`
    }

    if (!Array.isArray(input.subjects) || input.subjects.length === 0) {
        return 'subjects must be a non-empty list.'
    }
    if (input.subjects.length > MAX_LIST) {
        return `subjects must list ${MAX_LIST} or fewer.`
    }
    for (const [index, subject] of input.subjects.entries()) {
        const at = `subjects[${index}]`
        if (!subject || typeof subject !== 'object') {
            return `${at} must be an object.`
        }
        if (!isNonEmptyString(subject.name)) {
            return `${at}.name is required.`
        }
        if (subject.name.trim().length > MAX_NAME) {
            return `${at}.name must be ${MAX_NAME} characters or fewer.`
        }
        const listError =
            tagListError(subject.keyStages, `${at}.keyStages`) ??
            tagListError(subject.examBoards, `${at}.examBoards`) ??
            tagListError(subject.modes, `${at}.modes`)
        if (listError) {
            return listError
        }
    }

    for (const [name, list] of [
        ['journey', input.journey],
        ['approach', input.approach],
    ] as const) {
        if (!Array.isArray(list) || list.length === 0) {
            return `${name} must be a non-empty list.`
        }
        if (list.length > MAX_LIST) {
            return `${name} must list ${MAX_LIST} or fewer.`
        }
        for (const [index, pair] of list.entries()) {
            const error = pairError(pair, `${name}[${index}]`)
            if (error) {
                return error
            }
        }
    }

    const bio = input.bio as SiteContent['bio'] | undefined
    if (!bio || typeof bio !== 'object') {
        return 'bio is required.'
    }
    if (!isString(bio.heading) || bio.heading.trim().length > MAX_LINE) {
        return `bio.heading must be a string of ${MAX_LINE} characters or fewer.`
    }
    if (!isString(bio.body) || bio.body.length > MAX_MARKDOWN) {
        return `bio.body must be a string of ${MAX_MARKDOWN} characters or fewer.`
    }
    if (
        !Array.isArray(bio.qualifications) ||
        !bio.qualifications.every(isString)
    ) {
        return 'bio.qualifications must be a list of lines.'
    }
    if (bio.qualifications.length > MAX_QUALIFICATIONS) {
        return `bio.qualifications must list ${MAX_QUALIFICATIONS} or fewer.`
    }
    if (bio.qualifications.some((line) => line.trim().length > MAX_LINE)) {
        return `bio.qualifications entries must be ${MAX_LINE} characters or fewer.`
    }
    if (typeof bio.dbsChecked !== 'boolean') {
        return 'bio.dbsChecked must be true or false.'
    }
    if (
        !isString(bio.safeguarding) ||
        bio.safeguarding.trim().length > MAX_SUBHEAD
    ) {
        return `bio.safeguarding must be a string of ${MAX_SUBHEAD} characters or fewer.`
    }
    if (!isString(bio.photo)) {
        return 'bio.photo must be a string (may be empty).'
    }
    if (bio.photo !== '' && !PHOTO_PATTERN.test(bio.photo)) {
        return 'bio.photo must be a small jpeg/png/webp data-URI — the About page resizes photos automatically; republish from there.'
    }
    for (const [name, list] of [
        ['experience', bio.experience],
        ['education', bio.education],
    ] as const) {
        if (!Array.isArray(list)) {
            return `bio.${name} must be a list (it may be empty).`
        }
        if (list.length > MAX_LIST) {
            return `bio.${name} must list ${MAX_LIST} or fewer.`
        }
        for (const [index, entry] of list.entries()) {
            const at = `bio.${name}[${index}]`
            if (!entry || typeof entry !== 'object') {
                return `${at} must be an object.`
            }
            if (!isNonEmptyString(entry.title)) {
                return `${at}.title is required.`
            }
            for (const field of ['years', 'title', 'place'] as const) {
                if (
                    !isString(entry[field]) ||
                    entry[field].trim().length > MAX_LINE
                ) {
                    return `${at}.${field} must be a string of ${MAX_LINE} characters or fewer.`
                }
            }
            if (
                !isString(entry.detail) ||
                entry.detail.trim().length > MAX_DETAIL
            ) {
                return `${at}.detail must be a string of ${MAX_DETAIL} characters or fewer.`
            }
        }
    }
    if (
        !Array.isArray(bio.expectations) ||
        !bio.expectations.every(isString)
    ) {
        return 'bio.expectations must be a list of lines.'
    }
    if (bio.expectations.length > MAX_LIST) {
        return `bio.expectations must list ${MAX_LIST} or fewer.`
    }
    if (bio.expectations.some((line) => line.trim().length > MAX_LINE)) {
        return `bio.expectations entries must be ${MAX_LINE} characters or fewer.`
    }
    if (!Array.isArray(bio.sections)) {
        return 'bio.sections must be a list (it may be empty).'
    }
    if (bio.sections.length > MAX_LIST) {
        return `bio.sections must list ${MAX_LIST} or fewer.`
    }
    for (const [index, section] of bio.sections.entries()) {
        const at = `bio.sections[${index}]`
        if (!section || typeof section !== 'object') {
            return `${at} must be an object.`
        }
        if (!isString(section.heading) || section.heading.trim().length > MAX_LINE) {
            return `${at}.heading must be a string of ${MAX_LINE} characters or fewer.`
        }
        if (!isString(section.markdown) || section.markdown.length > MAX_MARKDOWN) {
            return `${at}.markdown must be a string of ${MAX_MARKDOWN} characters or fewer.`
        }
    }

    const faq = input.faq as SiteContent['faq'] | undefined
    if (!Array.isArray(faq)) {
        return 'faq must be a list (it may be empty).'
    }
    if (faq.length > MAX_FAQ) {
        return `faq must list ${MAX_FAQ} or fewer.`
    }
    for (const [index, item] of faq.entries()) {
        const at = `faq[${index}]`
        if (!item || typeof item !== 'object') {
            return `${at} must be an object.`
        }
        if (!isNonEmptyString(item.question)) {
            return `${at}.question is required.`
        }
        if (item.question.trim().length > MAX_LINE) {
            return `${at}.question must be ${MAX_LINE} characters or fewer.`
        }
        if (!isNonEmptyString(item.answer)) {
            return `${at}.answer is required.`
        }
        if (item.answer.trim().length > MAX_ANSWER) {
            return `${at}.answer must be ${MAX_ANSWER} characters or fewer.`
        }
    }

    const pricing = input.pricing as SiteContent['pricing'] | undefined
    if (!pricing || typeof pricing !== 'object') {
        return 'pricing is required.'
    }
    if (!Array.isArray(pricing.rates)) {
        return 'pricing.rates must be a list (it may be empty).'
    }
    if (pricing.rates.length > MAX_LIST) {
        return `pricing.rates must list ${MAX_LIST} or fewer.`
    }
    for (const [index, rate] of pricing.rates.entries()) {
        const at = `pricing.rates[${index}]`
        if (!rate || typeof rate !== 'object') {
            return `${at} must be an object.`
        }
        if (!isNonEmptyString(rate.label)) {
            return `${at}.label is required.`
        }
        if (rate.label.trim().length > MAX_NAME) {
            return `${at}.label must be ${MAX_NAME} characters or fewer.`
        }
        if (
            typeof rate.fromPerHour !== 'number' ||
            !Number.isFinite(rate.fromPerHour)
        ) {
            return `${at}.fromPerHour must be a number.`
        }
    }
    if (!Array.isArray(pricing.factors)) {
        return 'pricing.factors must be a list (it may be empty).'
    }
    if (pricing.factors.length > MAX_LIST) {
        return `pricing.factors must list ${MAX_LIST} or fewer.`
    }
    for (const [index, factor] of pricing.factors.entries()) {
        const error = pairError(factor, `pricing.factors[${index}]`)
        if (error) {
            return error
        }
    }
    if (!isString(pricing.note) || pricing.note.trim().length > MAX_SUBHEAD) {
        return `pricing.note must be a string of ${MAX_SUBHEAD} characters or fewer.`
    }

    const highlights = input.highlights as string[] | undefined
    if (!Array.isArray(highlights) || !highlights.every(isString)) {
        return 'highlights must be a list of lines (it may be empty).'
    }
    if (highlights.length > MAX_LIST) {
        return `highlights must list ${MAX_LIST} or fewer.`
    }
    if (highlights.some((line) => line.trim().length > MAX_LINE)) {
        return `highlights entries must be ${MAX_LINE} characters or fewer.`
    }

    const services = input.services as string[] | undefined
    if (!Array.isArray(services) || !services.every(isString)) {
        return 'services must be a list of lines (it may be empty).'
    }
    if (services.length > MAX_LIST) {
        return `services must list ${MAX_LIST} or fewer.`
    }
    if (services.some((line) => line.trim().length > MAX_LINE)) {
        return `services entries must be ${MAX_LINE} characters or fewer.`
    }

    if (
        !isString(input.modesLabel) ||
        input.modesLabel.trim().length > MAX_NAME
    ) {
        return `modesLabel must be a string of ${MAX_NAME} characters or fewer.`
    }

    const mobileNav = input.mobileNav as
        | { items?: unknown; spotlight?: unknown }
        | undefined
    if (!mobileNav || typeof mobileNav !== 'object') {
        return 'mobileNav must be an object with items and spotlight.'
    }
    if (
        !Array.isArray(mobileNav.items) ||
        !mobileNav.items.every(isString) ||
        mobileNav.items.length > 3
    ) {
        return 'mobileNav.items must be a list of at most 3 page keys.'
    }
    if (!isString(mobileNav.spotlight)) {
        return 'mobileNav.spotlight must be a page key.'
    }

    const freeform = input.freeform as SiteContent['freeform'] | undefined
    if (!freeform || typeof freeform !== 'object') {
        return 'freeform is required.'
    }
    if (!isString(freeform.heading) || !isString(freeform.markdown)) {
        return 'freeform.heading and freeform.markdown must be strings.'
    }
    if (freeform.heading.trim().length > MAX_LINE) {
        return `freeform.heading must be ${MAX_LINE} characters or fewer.`
    }
    if (freeform.markdown.length > MAX_MARKDOWN) {
        return `freeform.markdown must be ${MAX_MARKDOWN} characters or fewer.`
    }

    // The order must be every section key exactly once — a permutation, so a
    // page can never lose or duplicate a section.
    const order = input.sectionOrder as SectionKey[] | undefined
    if (
        !Array.isArray(order) ||
        order.length !== sectionKeys.length ||
        [...sectionKeys].some((key) => !order.includes(key))
    ) {
        return `sectionOrder must contain each of ${sectionKeys.join(', ')} exactly once.`
    }
    return undefined
}

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
        bio: stored.bio ?? {
            heading: '',
            body: '',
            qualifications: [],
            dbsChecked: false,
            safeguarding: '',
        },
        faq: stored.faq ?? [],
        // Empty pricing: the from-price never appears unpublished.
        pricing: stored.pricing ?? { rates: [], factors: [], note: '' },
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

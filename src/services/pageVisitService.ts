import { dataStore } from '../data/store'
import {
    DailyVisits,
    PAGE_KEYS,
    PageKey,
    PageVisit,
    PageVisitInput,
} from '../models/pageVisit'

/**
 * Counting visits to the public pages (REQ-058).
 *
 * What is stored is deliberately not personal data: a random per-tab id that
 * the browser never writes to disk, a page name from a closed list, and the
 * server's clock. No IP, no user agent, no referrer. See `models/pageVisit`
 * for why that matters and what changes if it ever stops being true.
 */

/** A visit id is opaque, but it is also a row key — so it is bounded. */
const MAX_VISIT_ID = 64
const VISIT_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/** How far back the teacher's snapshot reaches by default. */
const DEFAULT_DAYS = 30
const MAX_DAYS = 365

/** `YYYY-MM-DD` in UTC — the clock is the server's, never the visitor's. */
const dateKey = (when: Date): string => when.toISOString().slice(0, 10)

/** The day `days` before today, as a date key. */
export const startDate = (days: number, now = new Date()): string => {
    const from = new Date(now)
    from.setUTCDate(from.getUTCDate() - (days - 1))
    return dateKey(from)
}

const isPageKey = (value: unknown): value is PageKey =>
    typeof value === 'string' && (PAGE_KEYS as readonly string[]).includes(value)

/**
 * Rejects anything that is not a known page or a sane visit id. An open
 * endpoint is an invitation, and a closed page list is what stops the table
 * filling with whatever a stranger posts.
 */
export const validatePageVisitInput = (
    input: PageVisitInput | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Expected a page-visit object.'
    }
    if (!isPageKey(input.page)) {
        return `page must be one of: ${PAGE_KEYS.join(', ')}.`
    }
    if (
        typeof input.visitId !== 'string' ||
        input.visitId.length === 0 ||
        input.visitId.length > MAX_VISIT_ID ||
        !VISIT_ID_PATTERN.test(input.visitId)
    ) {
        return `visitId must be 1–${MAX_VISIT_ID} characters of A–Z, a–z, 0–9, _ or -.`
    }
    return undefined
}

/** Records one visit. The caller has already validated the input. */
export const recordPageVisit = async (
    input: PageVisitInput,
    now = new Date()
): Promise<void> => {
    const visit: PageVisit = {
        visitId: input.visitId,
        page: input.page,
        date: dateKey(now),
        at: now.toISOString(),
    }
    await dataStore.putPageVisit(visit)
}

/**
 * The snapshot the teacher reads: one entry per day, newest first, with the
 * distinct visits that reached each page.
 *
 * Distinct rather than total, because the question is "did anyone get as far
 * as Pricing?" — and because a visit id dies with its tab, a reload already
 * counts as a new visit, so totals would flatter the numbers twice over.
 */
export const dailyVisits = async (
    days = DEFAULT_DAYS,
    now = new Date()
): Promise<DailyVisits[]> => {
    const window = Math.min(Math.max(Math.floor(days) || DEFAULT_DAYS, 1), MAX_DAYS)
    const visits = await dataStore.listPageVisits(startDate(window, now))

    const byDate = new Map<string, Map<PageKey, Set<string>>>()
    visits.forEach((visit) => {
        const pages = byDate.get(visit.date) ?? new Map()
        const ids = pages.get(visit.page) ?? new Set<string>()
        ids.add(visit.visitId)
        pages.set(visit.page, ids)
        byDate.set(visit.date, pages)
    })

    return [...byDate.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([date, pages]) => {
            const everyone = new Set<string>()
            const perPage = [...pages.entries()]
                .map(([page, ids]) => {
                    ids.forEach((id) => everyone.add(id))
                    return { page, visits: ids.size }
                })
                // Busiest page first: the shape of the day at a glance.
                .sort(
                    (left, right) =>
                        right.visits - left.visits ||
                        left.page.localeCompare(right.page)
                )
            return { date, visits: everyone.size, pages: perPage }
        })
}

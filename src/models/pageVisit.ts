/**
 * Page-visit counting (REQ-058).
 *
 * The owner wants to know how many visits the public site gets and which
 * pages they reach. This is built first-party — the site posts to this API —
 * for two reasons recorded in the story: the app's CSP allows connections
 * only to these Function Apps, and the ROPA forbids adding a processor
 * without changing the public policy first, which currently promises
 * families there are none.
 *
 * **These rows are not personal data, by construction.** A visit id is
 * random, generated in the browser's memory and never written to the
 * visitor's device; no IP address, user agent or referrer is stored. Nobody
 * can be identified from a row, which is what keeps this outside consent
 * rules and outside the ROPA's processing tables. Anything that would change
 * that — an IP, a cookie, a durable id — changes the paperwork with it.
 */

/**
 * The public pages a visit may be counted against. A closed list, so the
 * table can never fill with arbitrary strings posted by anyone who finds the
 * endpoint. These are the same keys the site's own navigation uses.
 */
export const PAGE_KEYS = [
    'home',
    'offerings',
    'pricing',
    'enquire',
    'about',
    'reviews',
    'faq',
    'contact',
    'privacy',
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

/** What the site posts: which page, and which tab is looking at it. */
export interface PageVisitInput {
    /** A random per-tab id. Opaque here — never looked up, never linked. */
    visitId: string
    page: PageKey
}

/** One stored visit. The date is the partition; the clock is the server's. */
export interface PageVisit extends PageVisitInput {
    /** `YYYY-MM-DD`, UTC — the day the counts are grouped by. */
    date: string
    /** ISO timestamp of arrival. */
    at: string
}

/** One day of the snapshot the teacher reads. */
export interface DailyVisits {
    date: string
    /** Distinct visits that day, across every page. */
    visits: number
    /** Distinct visits that reached each page; pages with none are omitted. */
    pages: { page: PageKey; visits: number }[]
}

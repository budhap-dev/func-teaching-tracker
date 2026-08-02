/**
 * The public site's editable content (REQ-008).
 *
 * Everything a visitor reads on the public pages — the site name, the hero,
 * the subjects, the how-it-works journey, the approach points and a free-form
 * Markdown section — lives in one document the teacher edits from the portal
 * and publishes live, with no rebuild or deploy. Reading is public; writing
 * is teacher-only. Sections render in `sectionOrder`, so the teacher shapes
 * the page's structure as well as its words.
 *
 * The free-form body is **Markdown, never HTML**: the API strips raw tags on
 * write and the renderers escape on output, so nothing executable can travel
 * from this document to a public page.
 */

/** One selling point: a short claim, plus the detail that backs it up. */
export interface ApproachPoint {
    title: string
    detail: string
}

/** One step in the "how it works" journey. */
export interface JourneyStep {
    title: string
    detail: string
}

/** A subject offered, with the detail a parent looks for. */
export interface SubjectOffering {
    name: string
    /** Key stages covered, e.g. `['KS3', 'GCSE']`. */
    keyStages?: string[]
    /** Exam boards taught to, e.g. `['AQA', 'Edexcel']`. */
    examBoards?: string[]
    /** How it's delivered, e.g. `['Online', 'In person']`. */
    modes?: string[]
}

/** The hero: the promise, and the nudge to act. */
export interface SiteHero {
    headline: string
    subhead: string
    /** A scarcity/availability line, e.g. "Now taking Year 10 & 11". */
    availability: string
    /** Years of tutoring experience — the Home strip's lead tile ("20+
        years of tutoring experience"). 0/absent hides it. */
    experienceYears?: number
}

/** The free-form section: a heading plus a Markdown body. */
export interface FreeformSection {
    heading: string
    /** Markdown only — raw HTML is stripped on write. */
    markdown: string
}

/**
 * The tutor bio + safeguarding (REQ-021). Every field may be empty and the
 * public section hides until something is written — the app never invents
 * a qualification or a DBS claim on the owner's behalf.
 */
export interface BioSection {
    /** e.g. "Meet your tutor". */
    heading: string
    /** Who the tutor is — Markdown, like the free-form section. */
    body: string
    /** Qualification bullet lines, e.g. "PGCE, Secondary Mathematics". */
    qualifications: string[]
    /** Shows the DBS-checked indicator — only ever set by the owner. */
    dbsChecked: boolean
    /** A short safeguarding statement. */
    safeguarding: string
}

/** One FAQ entry (REQ-025). Plain text; HTML is stripped on write. */
export interface FaqItem {
    question: string
    answer: string
}

/** The reorderable page sections, in their canonical order. */
export const sectionKeys = [
    'hero',
    'subjects',
    'journey',
    'approach',
    'bio',
    'faq',
    'freeform',
] as const

export type SectionKey = (typeof sectionKeys)[number]

export interface SiteContent {
    /** The public-facing site name, e.g. "Springboard Tutoring". */
    siteName: string
    hero: SiteHero
    subjects: SubjectOffering[]
    journey: JourneyStep[]
    approach: ApproachPoint[]
    bio: BioSection
    faq: FaqItem[]
    freeform: FreeformSection
    /** Every section key exactly once — the order the public page renders. */
    sectionOrder: SectionKey[]
}

/** The PUT payload is the whole document — published atomically. */
export type SiteContentInput = SiteContent

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
    /** Profile photo as a small data-URI (browser-downscaled JPEG,
        ~240px). Empty = no photo. Kept small: the whole document lives in
        one 64KB Table Storage property. */
    photo: string
    /** CV timelines (REQ-037): teaching first, then education. */
    experience: CvEntry[]
    education: CvEntry[]
    /** The "What you can expect" tick list. */
    expectations: string[]
    /** Free sections — philosophy, promise, whatever comes next. */
    sections: AboutSection[]
}

/** One dated CV entry on the About page (REQ-037). */
export interface CvEntry {
    /** e.g. "Since 2019", "2005". Free text, shown quietly. */
    years: string
    title: string
    place: string
    detail: string
}

/** A repeating About section: a heading plus a Markdown body (REQ-037). */
export interface AboutSection {
    heading: string
    /** Markdown only — raw HTML is stripped on write. */
    markdown: string
}

/** One per-level from-rate (REQ-022), e.g. GCSE from £20/session. */
export interface PricingRate {
    /** The level the rate anchors, e.g. "GCSE", "A-level". */
    label: string
    /** Whole pounds per session, per student. The field name stays
        `fromPerHour` for published-document compatibility — the pages
        say "per session" (owner call, 2026-08-09). */
    fromPerHour: number
}

/** One named factor that shapes the exact rate (REQ-022). */
export interface PricingFactor {
    title: string
    detail: string
}

/**
 * Transparent pricing (REQ-022). Rates vary by level (owner 2026-08-04:
 * generally from GCSE £20/session and A-level £30/session, per student); factors
 * are NAMED, never fake-quantified. No rates = pricing not published —
 * older documents normalise that way (never-invent).
 */
export interface PricingSection {
    rates: PricingRate[]
    factors: PricingFactor[]
    /** e.g. "Your exact rate is agreed at the free assessment." */
    note: string
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
    /** The public-facing site name, e.g. "AbhiTutor". */
    siteName: string
    hero: SiteHero
    subjects: SubjectOffering[]
    journey: JourneyStep[]
    approach: ApproachPoint[]
    bio: BioSection
    faq: FaqItem[]
    pricing: PricingSection
    /** Hero highlight tiles (REQ-038) — short owner-approved selling
        points shown under the Home band. */
    highlights: string[]
    /** The services checklist on Offerings — owner-approved lines
        (2026-08-07), ticks supplied by the view. */
    services: string[]
    /** The subject cards' third tag label — "Delivery" by default, the
        owner can rename it (e.g. "Experience") (2026-08-09). */
    modesLabel: string
    /** The masthead pill copy (2026-08-12). `{year}` renders as the
        current year in the view; empty hides the pill. */
    mastheadPill: string
    /** Where the tutoring is offered, e.g. "Leeds" (REQ-043). Published
        as the business's area served in the public site's structured
        data; empty omits the claim - a location is the owner's to give. */
    areaServed: string
    /** The phone tab bar (REQ-049): which public pages fill the slots
        and which one is the raised spotlight. Keys are page ids. */
    mobileNav: { items: string[]; spotlight: string }
    /** The teacher's own phone tab bar (2026-08-10) — same shape, the
        teacher work-screen keys. Public in the document but carries
        nothing sensitive (page ids only). */
    mobileNavTeacher: { items: string[]; spotlight: string }
    freeform: FreeformSection
    /** Every section key exactly once — the order the public page renders. */
    sectionOrder: SectionKey[]
}

/** The PUT payload is the whole document — published atomically. */
export type SiteContentInput = SiteContent

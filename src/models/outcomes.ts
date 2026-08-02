/**
 * Aggregate teaching outcomes for the public site (REQ-020). Whole-app
 * tallies only — never a name, a student row, or anything traceable to a
 * person, because this is served to anonymous visitors.
 */
export interface Outcomes {
    /** Students ever taught — the active roster plus alumni. */
    studentsTaught: number
    /** Classes actually held: Scheduled rows whose date has passed. A group
        class counts once, however many students sat in it (REQ-011). */
    sessionsDelivered: number
    /** Teaching time behind those classes, in whole hours (rounded down). */
    hoursDelivered: number
    /** Distinct subjects across every student taught. */
    subjectsCount: number
    /** Mean star rating (1–5, one decimal) across approved reviews — the
        only ones ever public (REQ-027); 0 when there are none yet. */
    averageRating: number
    /** How many approved reviews back that rating. */
    reviewCount: number
}

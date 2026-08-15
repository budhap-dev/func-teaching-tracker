/**
 * The teacher's own reminder (REQ-057).
 *
 * A note-to-self with a date and, optionally, a time: "order more graph
 * paper", "ring the Chapmans back". It appears on the dashboard among the
 * upcoming classes so the one screen the teacher opens in the morning holds
 * everything that is coming.
 *
 * **It is not a class.** It books nothing, bills nothing and belongs to no
 * student. That separation is the design: the moment a reminder can carry a
 * student it becomes a second way to schedule teaching, and the two will
 * disagree. Nothing here ever reaches the planner, a payment or a public page.
 *
 * Private to the teacher on every verb — this is a note-to-self, and it may
 * well name a family ("ring the Chapmans"), which is why it is teacher-only
 * and why the retention schedule covers it.
 */
export interface Reminder {
    id: number
    /** `YYYY-MM-DD`, the teacher's own local day. */
    date: string
    /**
     * `HH:MM`, or absent. Optional on purpose: "Thursday" is a legitimate
     * reminder, and forcing 00:00 onto it would sort it to dawn.
     */
    time?: string
    /** Whatever the teacher needs to remember. Plain text; HTML is stripped. */
    text: string
}

/** What the teacher sends when writing or changing one. */
export interface ReminderInput {
    date: string
    time?: string
    text: string
}

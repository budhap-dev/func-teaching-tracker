import { dataStore } from '../data/store'
import { Outcomes } from '../models/outcomes'

const today = (): string => new Date().toISOString().slice(0, 10)

/**
 * Whole-app tallies for the public outcomes strip (REQ-020) — computed from
 * live data on every read, never stored, so they cannot drift or be
 * invented. A held class is a Scheduled row with a past date (REQ-010's
 * reading: only the exception is recorded, so "held" is derived); a group
 * class tallies once however many attendees it had, exactly like the
 * dashboard's week-load hours (REQ-011).
 */
export const getOutcomes = async (): Promise<Outcomes> => {
    const [students, sessions, testimonials] = await Promise.all([
        dataStore.listStudents(),
        dataStore.listSessions(),
        dataStore.listTestimonials(),
    ])

    // Held classes keyed like the frontend groups them: one entry per group,
    // one per solo row. The duration is a shared field, so any row's works.
    const cutoff = today()
    const held = new Map<string, number>()
    sessions.forEach((session) => {
        if (session.status !== 'Scheduled' || session.date >= cutoff) {
            return
        }
        const key = session.groupId ?? `solo-${session.id}`
        held.set(key, session.durationMinutes ?? 60)
    })
    const heldMinutes = [...held.values()].reduce(
        (sum, minutes) => sum + minutes,
        0
    )

    const subjects = new Set(students.flatMap((student) => student.subjects))

    // The rating averages only Approved reviews — the ones already public on
    // the Reviews page (REQ-027), so the strip discloses nothing new.
    const approved = testimonials.filter(
        (testimonial) => testimonial.status === 'Approved'
    )
    const averageRating = approved.length
        ? Math.round(
              (approved.reduce(
                  (sum, testimonial) => sum + testimonial.rating,
                  0
              ) /
                  approved.length) *
                  10
          ) / 10
        : 0

    return {
        studentsTaught: students.length,
        sessionsDelivered: held.size,
        hoursDelivered: Math.floor(heldMinutes / 60),
        subjectsCount: subjects.size,
        averageRating,
        reviewCount: approved.length,
    }
}

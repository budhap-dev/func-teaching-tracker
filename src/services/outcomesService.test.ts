import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledSession } from '../models/session'
import type { Student } from '../models/student'
import type { Testimonial } from '../models/testimonial'

/** Mutable fake store, reset per test. */
const fake = {
    students: [] as Student[],
    sessions: [] as ScheduledSession[],
    testimonials: [] as Testimonial[],
}

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        listStudents: async () => fake.students,
        listSessions: async () => fake.sessions,
        listTestimonials: async () => fake.testimonials,
    },
}))

import { getOutcomes } from './outcomesService'

const student = (overrides: Partial<Student>): Student =>
    ({
        id: 1,
        studentId: 'ST-1',
        firstName: 'Test',
        lastName: 'Student',
        dob: '2010-01-01',
        subjects: ['Mathematics'],
        school: 'School',
        year: '9',
        progress: 0,
        mode: 'Online',
        fees: 30,
        notes: '',
        parentName: '',
        contactNumber: '',
        address: '',
        ...overrides,
    }) as Student

const session = (
    overrides: Partial<ScheduledSession>
): ScheduledSession => ({
    id: 1,
    studentId: 1,
    studentName: 'Test Student',
    year: '9',
    subject: 'Mathematics',
    date: '2000-01-10',
    time: '16:00',
    durationMinutes: 60,
    notes: '',
    status: 'Scheduled',
    ...overrides,
})

const review = (overrides: Partial<Testimonial>): Testimonial =>
    ({
        id: 1,
        authorName: 'A Parent',
        role: 'Parent',
        rating: 5,
        quote: 'Great tutoring.',
        status: 'Approved',
        submittedOn: '2026-01-01',
        ...overrides,
    }) as Testimonial

beforeEach(() => {
    fake.students = []
    fake.sessions = []
    fake.testimonials = []
})

describe('getOutcomes', () => {
    it('returns zeros on an empty store', async () => {
        expect(await getOutcomes()).toEqual({
            studentsTaught: 0,
            sessionsDelivered: 0,
            hoursDelivered: 0,
            subjectsCount: 0,
            averageRating: 0,
            reviewCount: 0,
        })
    })

    it('counts every student, active and archived alike', async () => {
        fake.students = [
            student({ id: 1 }),
            student({ id: 2, isArchived: true, archivedOn: '2020-01-01' }),
        ]
        expect((await getOutcomes()).studentsTaught).toBe(2)
    })

    it('delivered = held only: past Scheduled rows, never future or cancelled', async () => {
        fake.sessions = [
            session({ id: 1, date: '2000-01-10' }),
            session({ id: 2, date: '2000-01-11', status: 'Cancelled' }),
            session({ id: 3, date: '2999-01-01' }),
        ]
        const outcomes = await getOutcomes()
        expect(outcomes.sessionsDelivered).toBe(1)
        expect(outcomes.hoursDelivered).toBe(1)
    })

    it('a held group class counts once, not once per attendee', async () => {
        fake.sessions = [
            session({ id: 1, groupId: 'grp-1', durationMinutes: 90 }),
            session({ id: 2, groupId: 'grp-1', durationMinutes: 90, studentId: 2 }),
            session({ id: 3, date: '2000-02-01' }),
        ]
        const outcomes = await getOutcomes()
        expect(outcomes.sessionsDelivered).toBe(2)
        // 90 group minutes (once) + 60 solo minutes = 2.5h, floored.
        expect(outcomes.hoursDelivered).toBe(2)
    })

    it('tallies distinct subjects across students', async () => {
        fake.students = [
            student({ id: 1, subjects: ['Mathematics', 'Physics'] }),
            student({ id: 2, subjects: ['Physics', 'Chemistry'] }),
        ]
        expect((await getOutcomes()).subjectsCount).toBe(3)
    })

    it('averages the star rating over approved reviews only, one decimal', async () => {
        fake.testimonials = [
            review({ id: 1, rating: 5 }),
            review({ id: 2, rating: 4 }),
            review({ id: 3, rating: 4 }),
            // Pending and rejected reviews are not public; they carry no weight.
            review({ id: 4, rating: 1, status: 'Pending' }),
            review({ id: 5, rating: 1, status: 'Rejected' }),
        ]
        const outcomes = await getOutcomes()
        expect(outcomes.averageRating).toBe(4.3)
        expect(outcomes.reviewCount).toBe(3)
    })

    it('sessions missing a duration count as an hour', async () => {
        fake.sessions = [
            session({ id: 1, durationMinutes: undefined as unknown as number }),
        ]
        expect((await getOutcomes()).hoursDelivered).toBe(1)
    })
})

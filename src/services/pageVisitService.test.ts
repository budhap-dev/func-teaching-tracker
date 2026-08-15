import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageVisit } from '../models/pageVisit'

const fake = { visits: [] as PageVisit[] }

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        putPageVisit: async (visit: PageVisit) => {
            fake.visits.push(visit)
        },
        listPageVisits: async (fromDate: string) =>
            fake.visits.filter((visit) => visit.date >= fromDate),
    },
}))

import {
    dailyVisits,
    recordPageVisit,
    startDate,
    validatePageVisitInput,
} from './pageVisitService'

const visit = (
    date: string,
    visitId: string,
    page: PageVisit['page']
): PageVisit => ({ date, visitId, page, at: `${date}T10:00:00.000Z` })

beforeEach(() => {
    fake.visits = []
})

describe('validatePageVisitInput', () => {
    it('accepts a known page and a sane id', () => {
        expect(
            validatePageVisitInput({ visitId: 'abc-123_XYZ', page: 'pricing' })
        ).toBeUndefined()
    })

    it('rejects a page it does not know — the list is closed on purpose', () => {
        // An open endpoint is an invitation; without this the table fills
        // with whatever a stranger posts.
        expect(
            validatePageVisitInput({
                visitId: 'abc',
                page: 'admin' as never,
            })
        ).toMatch(/page must be one of/)
    })

    it.each([
        ['empty', ''],
        ['over-long', 'x'.repeat(65)],
        ['punctuation that is not id-shaped', 'abc/../etc'],
    ])('rejects an %s visit id', (_why, visitId) => {
        expect(
            validatePageVisitInput({ visitId, page: 'home' })
        ).toMatch(/visitId must be/)
    })

    it('rejects a missing body', () => {
        expect(validatePageVisitInput(undefined)).toMatch(/Expected/)
    })
})

describe('recordPageVisit', () => {
    it('stamps the date and time from the server, never the caller', async () => {
        await recordPageVisit(
            { visitId: 'tab-1', page: 'home' },
            new Date('2026-08-15T09:30:00.000Z')
        )

        expect(fake.visits).toEqual([
            {
                visitId: 'tab-1',
                page: 'home',
                date: '2026-08-15',
                at: '2026-08-15T09:30:00.000Z',
            },
        ])
    })
})

describe('dailyVisits', () => {
    it('counts distinct visits per day and per page, newest day first', async () => {
        fake.visits = [
            // One tab that read three pages, and another that only landed.
            visit('2026-08-15', 'tab-1', 'home'),
            visit('2026-08-15', 'tab-1', 'offerings'),
            visit('2026-08-15', 'tab-1', 'pricing'),
            visit('2026-08-15', 'tab-2', 'home'),
            visit('2026-08-14', 'tab-3', 'home'),
        ]

        const daily = await dailyVisits(30, new Date('2026-08-15T12:00:00Z'))

        expect(daily.map((day) => day.date)).toEqual([
            '2026-08-15',
            '2026-08-14',
        ])
        // Two tabs that day, not four page views.
        expect(daily[0].visits).toBe(2)
        expect(daily[0].pages).toEqual([
            { page: 'home', visits: 2 },
            { page: 'offerings', visits: 1 },
            { page: 'pricing', visits: 1 },
        ])
        expect(daily[1]).toEqual({
            date: '2026-08-14',
            visits: 1,
            pages: [{ page: 'home', visits: 1 }],
        })
    })

    it('asks the store only for the window it needs', async () => {
        // 7 days INCLUDING today, so the window starts six days back.
        expect(startDate(7, new Date('2026-08-15T00:00:00Z'))).toBe(
            '2026-08-09'
        )
        expect(startDate(1, new Date('2026-08-15T00:00:00Z'))).toBe(
            '2026-08-15'
        )
    })

    it('says nothing rather than inventing days with no visits', async () => {
        expect(await dailyVisits(30, new Date('2026-08-15T12:00:00Z'))).toEqual(
            []
        )
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Reminder } from '../models/reminder'

const fake = { reminders: [] as Reminder[], nextId: 1 }

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        listReminders: async () => fake.reminders,
        getReminder: async (id: number) =>
            fake.reminders.find((reminder) => reminder.id === id),
        putReminder: async (reminder: Reminder) => {
            const index = fake.reminders.findIndex((r) => r.id === reminder.id)
            if (index >= 0) {
                fake.reminders[index] = reminder
            } else {
                fake.reminders.push(reminder)
            }
        },
        deleteReminder: async (id: number) => {
            fake.reminders = fake.reminders.filter((r) => r.id !== id)
        },
        nextReminderId: async () => fake.nextId++,
    },
}))

import {
    createReminder,
    deleteReminder,
    listReminders,
    updateReminder,
    validateReminderInput,
} from './reminderService'

beforeEach(() => {
    fake.reminders = []
    fake.nextId = 1
})

describe('validateReminderInput', () => {
    it('accepts a date, a time and something to remember', () => {
        expect(
            validateReminderInput({
                date: '2026-08-20',
                time: '09:30',
                text: 'Ring back about Year 11',
            })
        ).toBeUndefined()
    })

    it('accepts a reminder with no time — "Thursday" is a real one', () => {
        expect(
            validateReminderInput({ date: '2026-08-20', text: 'Order paper' })
        ).toBeUndefined()
        expect(
            validateReminderInput({
                date: '2026-08-20',
                time: '',
                text: 'Order paper',
            })
        ).toBeUndefined()
    })

    it.each([
        ['20/08/2026', /date must be/],
        ['2026-8-20', /date must be/],
    ])('rejects %s as a date', (date, expected) => {
        expect(
            validateReminderInput({ date, text: 'Something' })
        ).toMatch(expected)
    })

    it.each(['24:00', '9:30', 'morning'])('rejects %s as a time', (time) => {
        expect(
            validateReminderInput({ date: '2026-08-20', time, text: 'x' })
        ).toMatch(/time must be/)
    })

    it('rejects a reminder with nothing to say, tags included', () => {
        expect(
            validateReminderInput({ date: '2026-08-20', text: '   ' })
        ).toMatch(/text is required/)
        // HTML is stripped before length is judged, so tags cannot stand in
        // for content.
        expect(
            validateReminderInput({ date: '2026-08-20', text: '<b></b>' })
        ).toMatch(/text is required/)
    })

    it('caps the length', () => {
        expect(
            validateReminderInput({
                date: '2026-08-20',
                text: 'x'.repeat(501),
            })
        ).toMatch(/500 characters/)
    })
})

describe('createReminder', () => {
    it('strips HTML and keeps an absent time absent', async () => {
        const reminder = await createReminder({
            date: '2026-08-20',
            text: '  Ring the <b>Chapmans</b>  ',
        })

        expect(reminder).toEqual({
            id: 1,
            date: '2026-08-20',
            text: 'Ring the Chapmans',
        })
        // Not `time: undefined`, and certainly not "00:00".
        expect('time' in reminder).toBe(false)
    })
})

describe('updateReminder', () => {
    it('replaces one that exists', async () => {
        await createReminder({ date: '2026-08-20', text: 'Old' })

        const updated = await updateReminder(1, {
            date: '2026-08-21',
            time: '16:00',
            text: 'New',
        })

        expect(updated).toEqual({
            id: 1,
            date: '2026-08-21',
            time: '16:00',
            text: 'New',
        })
    })

    it('says nothing changed when there is nothing to change', async () => {
        expect(
            await updateReminder(99, { date: '2026-08-20', text: 'x' })
        ).toBeUndefined()
    })
})

describe('listReminders', () => {
    it('reads by day, then by time, with untimed ones first', async () => {
        // An untimed reminder belongs to the whole day, so it leads it —
        // sorting it as 00:00 would be a lie that happens to look the same.
        await createReminder({ date: '2026-08-21', time: '09:00', text: 'B' })
        await createReminder({ date: '2026-08-20', time: '16:00', text: 'A' })
        await createReminder({ date: '2026-08-21', text: 'All day' })

        expect((await listReminders()).map((r) => r.text)).toEqual([
            'A',
            'All day',
            'B',
        ])
    })
})

describe('deleteReminder', () => {
    it('forgets one, and forgives being asked twice', async () => {
        await createReminder({ date: '2026-08-20', text: 'Gone' })

        await deleteReminder(1)
        await expect(deleteReminder(1)).resolves.toBeUndefined()
        expect(await listReminders()).toEqual([])
    })
})

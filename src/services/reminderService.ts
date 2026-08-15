import { dataStore } from '../data/store'
import { Reminder, ReminderInput } from '../models/reminder'

/** Long enough for a real note, short enough not to be free storage. */
const MAX_TEXT = 500

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const stripHtml = (text: string): string => text.replace(/<[^>]*>/g, '').trim()

/**
 * Reminders in the order the teacher reads them: by day, and within a day by
 * time — with the untimed ones first, because "Thursday" belongs to the whole
 * day rather than to midnight.
 */
export const listReminders = async (): Promise<Reminder[]> =>
    (await dataStore.listReminders()).sort(
        (left, right) =>
            left.date.localeCompare(right.date) ||
            (left.time ?? '').localeCompare(right.time ?? '') ||
            left.id - right.id
    )

export const validateReminderInput = (
    input: ReminderInput | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Expected a reminder object.'
    }
    if (typeof input.date !== 'string' || !DATE_PATTERN.test(input.date)) {
        return 'date must be a calendar date, YYYY-MM-DD.'
    }
    if (
        input.time !== undefined &&
        input.time !== '' &&
        (typeof input.time !== 'string' || !TIME_PATTERN.test(input.time))
    ) {
        return 'time must be HH:MM on a 24-hour clock, or left out.'
    }
    if (typeof input.text !== 'string' || stripHtml(input.text).length === 0) {
        return 'text is required — a reminder with nothing to say is not one.'
    }
    if (stripHtml(input.text).length > MAX_TEXT) {
        return `text must be ${MAX_TEXT} characters or fewer.`
    }
    return undefined
}

/** The shape both create and update store, once the input is known good. */
const clean = (input: ReminderInput, id: number): Reminder => {
    const time = input.time?.trim()
    return {
        id,
        date: input.date.trim(),
        // An empty time is no time, not "00:00": the difference is the
        // difference between "Thursday" and "Thursday at midnight".
        ...(time ? { time } : {}),
        text: stripHtml(input.text),
    }
}

export const createReminder = async (
    input: ReminderInput
): Promise<Reminder> => {
    const reminder = clean(input, await dataStore.nextReminderId())
    await dataStore.putReminder(reminder)
    return reminder
}

/** Replaces a reminder. Returns undefined when there is nothing to replace. */
export const updateReminder = async (
    id: number,
    input: ReminderInput
): Promise<Reminder | undefined> => {
    const existing = await dataStore.getReminder(id)
    if (!existing) {
        return undefined
    }
    const reminder = clean(input, id)
    await dataStore.putReminder(reminder)
    return reminder
}

export const deleteReminder = async (id: number): Promise<void> => {
    await dataStore.deleteReminder(id)
}

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { ReminderInput } from '../models/reminder'
import {
    createReminder,
    validateReminderInput,
} from '../services/reminderService'
import { badRequest, created, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** POST /api/reminders — teacher: write a note-to-self (REQ-057). */
export async function createReminderHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const body = await parseJsonBody<ReminderInput>(request)
    const error = validateReminderInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const reminder = await createReminder(body)
    // The date, never the words: a reminder may name a family, and the log is
    // not the place for it.
    context.log(`Reminder ${reminder.id} added for ${reminder.date}`)
    return created(reminder)
}

app.http('createReminder', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'reminders',
    handler: createReminderHandler,
})

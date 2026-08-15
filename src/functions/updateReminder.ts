import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { ReminderInput } from '../models/reminder'
import {
    updateReminder,
    validateReminderInput,
} from '../services/reminderService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** PUT /api/reminders/{id} — teacher: change a note-to-self (REQ-057). */
export async function updateReminderHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Reminder id must be an integer.')
    }

    const body = await parseJsonBody<ReminderInput>(request)
    const error = validateReminderInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const reminder = await updateReminder(id, body)
    if (!reminder) {
        return notFound(`Reminder ${id} not found.`)
    }

    context.log(`Reminder ${id} updated`)
    return ok(reminder)
}

app.http('updateReminder', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'reminders/{id}',
    handler: updateReminderHandler,
})

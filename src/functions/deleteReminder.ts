import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { deleteReminder } from '../services/reminderService'
import { badRequest, noContent } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * DELETE /api/reminders/{id} — teacher: forget a note-to-self (REQ-057).
 *
 * Idempotent: deleting one that is already gone answers 204, so a double tap
 * on a phone is not an error.
 */
export async function deleteReminderHandler(
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

    await deleteReminder(id)
    context.log(`Reminder ${id} deleted`)
    return noContent()
}

app.http('deleteReminder', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'reminders/{id}',
    handler: deleteReminderHandler,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listReminders } from '../services/reminderService'
import { ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * GET /api/reminders — teacher: the notes-to-self, in the order they are read
 * (REQ-057). Teacher-only on every verb: a reminder may name a family.
 */
export async function getReminders(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const reminders = await listReminders()
    context.log(`Returning ${reminders.length} reminders`)
    return ok(reminders)
}

app.http('getReminders', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'reminders',
    handler: getReminders,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { SessionUpdate } from '../models/session'
import { updateSession, validateSessionUpdate } from '../services/sessionService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PUT /api/sessions/{id} — edits a class and/or cancels/restores it.
 * Body is any subset of the class fields, e.g. `{ "status": "Cancelled" }` to
 * cancel, or `{ "subject": "Physics", "time": "17:00" }` to edit.
 */
export async function updateSessionHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Session id must be an integer.')
    }

    const body = await parseJsonBody<SessionUpdate>(request)
    const error = validateSessionUpdate(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const sessions = updateSession(id, body)
    if (!sessions) {
        return notFound(`Session ${id} not found.`)
    }

    context.log(
        sessions.length === 1
            ? `Session ${id} updated`
            : `Group ${sessions[0].groupId} updated (${sessions.length} rows)`
    )
    // One row keeps the old single-object shape for older clients.
    return ok(sessions.length === 1 ? sessions[0] : sessions)
}

app.http('updateSession', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'sessions/{id}',
    handler: updateSessionHandler,
})

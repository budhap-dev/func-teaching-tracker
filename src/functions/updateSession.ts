import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { SessionUpdate } from '../models/session'
import {
    updateSessionStatus,
    validateSessionUpdate,
} from '../services/sessionService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'

/**
 * PUT /api/sessions/{id} — cancels or un-cancels a class.
 * Body: `{ "status": "Cancelled" }` or `{ "status": "Scheduled" }`.
 */
export async function updateSessionHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Session id must be an integer.')
    }

    const body = await parseJsonBody<SessionUpdate>(request)
    const error = validateSessionUpdate(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const session = updateSessionStatus(id, body)
    if (!session) {
        return notFound(`Session ${id} not found.`)
    }

    context.log(`Session ${id} is now ${session.status}`)
    return ok(session)
}

app.http('updateSession', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'sessions/{id}',
    handler: updateSessionHandler,
})

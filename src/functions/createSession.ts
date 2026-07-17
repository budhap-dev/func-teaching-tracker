import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { SessionInput } from '../models/session'
import { createSessions, validateSessionInput } from '../services/sessionService'
import { badRequest, created, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** POST /api/sessions — schedules a new class. */
export async function createSessionHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const body = await parseJsonBody<SessionInput>(request)
    const error = validateSessionInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const sessions = createSessions(body)
    context.log(
        `Scheduled ${sessions.length === 1 ? `session ${sessions[0].id}` : `group of ${sessions.length} (${sessions[0].groupId})`}`
    )
    // Solo bookings keep the old single-object shape for older clients.
    return created(sessions.length === 1 ? sessions[0] : sessions)
}

app.http('createSession', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'sessions',
    handler: createSessionHandler,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { SessionInput } from '../models/session'
import { createSession, validateSessionInput } from '../services/sessionService'
import { badRequest, created, parseJsonBody } from '../shared/http'

/** POST /api/sessions — schedules a new class. */
export async function createSessionHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const body = await parseJsonBody<SessionInput>(request)
    const error = validateSessionInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const session = createSession(body)
    context.log(`Scheduled session ${session.id} for student ${session.studentId}`)
    return created(session)
}

app.http('createSession', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'sessions',
    handler: createSessionHandler,
})

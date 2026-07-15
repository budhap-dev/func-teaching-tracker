import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listSessions } from '../services/sessionService'
import { badRequest, ok } from '../shared/http'

/**
 * GET /api/sessions — returns scheduled classes, date-ordered.
 * Optional query param: studentId (number).
 */
export async function getSessions(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const studentIdParam = request.query.get('studentId')
    let studentId: number | undefined

    if (studentIdParam !== null) {
        studentId = Number(studentIdParam)
        if (!Number.isInteger(studentId)) {
            return badRequest('studentId must be an integer.')
        }
    }

    const sessions = listSessions(studentId)
    context.log(`Returning ${sessions.length} scheduled sessions`)
    return ok(sessions)
}

app.http('getSessions', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'sessions',
    handler: getSessions,
})

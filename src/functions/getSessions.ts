import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listSessions } from '../services/sessionService'
import { badRequest, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * GET /api/sessions — returns scheduled classes, date-ordered.
 * Optional query param: studentId (number).
 */
export async function getSessions(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const studentIdParam = request.query.get('studentId')
    let studentId: number | undefined

    if (studentIdParam !== null) {
        studentId = Number(studentIdParam)
        if (!Number.isInteger(studentId)) {
            return badRequest('studentId must be an integer.')
        }
    }

    const sessions = await listSessions(studentId)
    context.log(`Returning ${sessions.length} scheduled sessions`)
    return ok(sessions)
}

app.http('getSessions', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'sessions',
    handler: getSessions,
})

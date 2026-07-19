import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { addSessionMember } from '../services/sessionService'
import {
    badRequest,
    conflict,
    created,
    notFound,
    parseJsonBody,
} from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * POST /api/sessions/{id}/members — adds a student to a class (REQ: edit a
 * class's membership). Body: `{ "studentId": 3 }`. A solo class becomes a
 * group; a re-added student's cancelled row is restored. Returns every row of
 * the group.
 */
export async function addSessionMemberHandler(
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

    const body = await parseJsonBody<{ studentId?: number }>(request)
    if (typeof body?.studentId !== 'number') {
        return badRequest('studentId is required and must be a number.')
    }

    const result = await addSessionMember(id, body.studentId)
    if (!result.ok) {
        if (result.reason === 'already-member') {
            return conflict('That student is already in this class.')
        }
        return notFound(
            result.reason === 'session-not-found'
                ? `Session ${id} not found.`
                : `Student ${body.studentId} not found.`
        )
    }

    context.log(
        `Added student ${body.studentId} to session ${id}'s group (${result.rows.length} rows)`
    )
    return created(result.rows)
}

app.http('addSessionMember', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'sessions/{id}/members',
    handler: addSessionMemberHandler,
})

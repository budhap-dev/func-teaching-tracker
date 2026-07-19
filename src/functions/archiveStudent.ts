import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { archiveStudent } from '../services/studentService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * POST /api/students/{id}/archive — moves a student to Alumni (REQ-013).
 * Body: `{ "notes": "…" }` — a closing note is required. Any future class the
 * student had is cancelled as part of the archive.
 */
export async function archiveStudentHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Student id must be an integer.')
    }

    const body = await parseJsonBody<{ notes?: string }>(request)
    const notes = body?.notes?.trim()
    if (!notes) {
        return badRequest('A closing note is required to archive a student.')
    }

    const result = await archiveStudent(id, notes)
    if (!result.ok) {
        return notFound(`Student ${id} not found.`)
    }

    context.log(
        `Archived student ${id}; cancelled ${result.cancelledCount} future class(es)`
    )
    return ok(result.student)
}

app.http('archiveStudent', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'students/{id}/archive',
    handler: archiveStudentHandler,
})

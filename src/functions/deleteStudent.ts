import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { deleteStudent } from '../services/studentService'
import { badRequest, noContent, notFound } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * DELETE /api/students/{id} — erases a student and everything about them:
 * their sessions and settlements, in one cascade (GDPR right to erasure,
 * REQ-009 §10). Table deletes are real deletes, so nothing lingers.
 */
export async function deleteStudentHandler(
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

    const deleted = await deleteStudent(id)
    if (!deleted) {
        return notFound(`Student ${id} not found.`)
    }

    context.log(`Erased student ${id} and all their sessions and settlements`)
    return noContent()
}

app.http('deleteStudent', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'students/{id}',
    handler: deleteStudentHandler,
})

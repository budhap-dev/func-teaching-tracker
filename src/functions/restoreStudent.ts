import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { restoreStudent } from '../services/studentService'
import { badRequest, notFound, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * POST /api/students/{id}/restore — returns an archived student to the active
 * roster (REQ-013). The closing note is kept, as a record of the past.
 */
export async function restoreStudentHandler(
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

    const student = await restoreStudent(id)
    if (!student) {
        return notFound(`Student ${id} not found.`)
    }

    context.log(`Restored student ${id} to the active roster`)
    return ok(student)
}

app.http('restoreStudent', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'students/{id}/restore',
    handler: restoreStudentHandler,
})

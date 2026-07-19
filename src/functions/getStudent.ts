import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { getStudentById } from '../services/studentService'
import { badRequest, notFound, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** GET /api/students/{id} — returns a single student by numeric id. */
export async function getStudent(
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

    const student = await getStudentById(id)
    if (!student) {
        context.log(`Student ${id} not found`)
        return notFound(`Student ${id} not found.`)
    }
    return ok(student)
}

app.http('getStudent', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'students/{id}',
    handler: getStudent,
})

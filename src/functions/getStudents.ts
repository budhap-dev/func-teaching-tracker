import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listStudents } from '../services/studentService'
import { ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** GET /api/students — returns all students. */
export async function getStudents(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const students = await listStudents()
    context.log(`Returning ${students.length} students`)
    return ok(students)
}

app.http('getStudents', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'students',
    handler: getStudents,
})

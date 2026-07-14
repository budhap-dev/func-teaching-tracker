import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listStudents } from '../services/studentService'
import { ok } from '../shared/http'

/** GET /api/students — returns all students. */
export async function getStudents(
    _request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const students = listStudents()
    context.log(`Returning ${students.length} students`)
    return ok(students)
}

app.http('getStudents', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'students',
    handler: getStudents,
})

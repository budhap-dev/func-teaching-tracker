import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { StudentInput } from '../models/student'
import { upsertStudent, validateStudentInput } from '../services/studentService'
import { badRequest, created, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * POST /api/students        — create or update a student (id optional in body).
 * PUT  /api/students/{id}   — update the student identified by the route id.
 */
export async function upsertStudentHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const body = await parseJsonBody<StudentInput>(request)
    const error = validateStudentInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    // A route id (from PUT /students/{id}) takes precedence over any body id.
    const routeId = request.params.id ? Number(request.params.id) : undefined
    if (routeId !== undefined) {
        if (!Number.isInteger(routeId)) {
            return badRequest('Student id must be an integer.')
        }
        body.id = routeId
    }

    const result = upsertStudent(body)
    context.log(
        `${result.created ? 'Created' : 'Updated'} student ${result.student.id}`
    )
    return result.created ? created(result.student) : ok(result.student)
}

app.http('upsertStudent', {
    methods: ['POST', 'PUT'],
    authLevel: 'anonymous',
    route: 'students/{id?}',
    handler: upsertStudentHandler,
})

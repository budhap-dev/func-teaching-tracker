import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { TestimonialStatus, TestimonialUpdate } from '../models/testimonial'
import {
    setTestimonialStatus,
    validateTestimonialUpdate,
} from '../services/testimonialService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PUT /api/testimonials/{id} — teacher: approve or reject a review.
 * Body is `{ "status": "Approved" }` or `{ "status": "Rejected" }`.
 */
export async function updateTestimonialHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Testimonial id must be an integer.')
    }

    const body = await parseJsonBody<TestimonialUpdate>(request)
    const error = validateTestimonialUpdate(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const updated = await setTestimonialStatus(
        id,
        body.status as TestimonialStatus
    )
    if (!updated) {
        return notFound(`Testimonial ${id} not found.`)
    }

    context.log(`Testimonial ${id} → ${updated.status}`)
    return ok(updated)
}

app.http('updateTestimonial', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'testimonials/{id}',
    handler: updateTestimonialHandler,
})

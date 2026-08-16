import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { TestimonialStatus, TestimonialUpdate } from '../models/testimonial'
import {
    MAX_FEATURED,
    setTestimonialFeatured,
    setTestimonialStatus,
    validateTestimonialUpdate,
} from '../services/testimonialService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PUT /api/testimonials/{id} — teacher: approve or reject a review, or choose
 * it for the public Home page.
 *
 * Body is `{ "status": "Approved" }`, `{ "status": "Rejected" }` or
 * `{ "featured": true | false }` (REQ-059). Sending both moderates first, so a
 * review can be approved and featured in one call.
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

    if (body.status !== undefined) {
        const moderated = await setTestimonialStatus(
            id,
            body.status as TestimonialStatus
        )
        if (!moderated) {
            return notFound(`Testimonial ${id} not found.`)
        }
        context.log(`Testimonial ${id} → ${moderated.status}`)
        if (body.featured === undefined) {
            return ok(moderated)
        }
    }

    // Choosing it for Home (REQ-059). The refusals are distinct on purpose:
    // "the page is full" is something the teacher can act on, and a 404 would
    // tell them nothing.
    const featured = await setTestimonialFeatured(
        id,
        body.featured as boolean
    )
    if (featured === 'not-found') {
        return notFound(`Testimonial ${id} not found.`)
    }
    if (featured === 'not-approved') {
        return badRequest('Only an approved review can be shown on Home.')
    }
    if (featured === 'full') {
        return badRequest(
            `Only ${MAX_FEATURED} reviews can be shown on Home. Untick one first.`
        )
    }

    context.log(
        `Testimonial ${id} → ${featured.featured ? 'featured' : 'not featured'}`
    )
    return ok(featured)
}

app.http('updateTestimonial', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'testimonials/{id}',
    handler: updateTestimonialHandler,
})

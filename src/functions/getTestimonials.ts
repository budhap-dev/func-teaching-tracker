import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listApprovedTestimonials } from '../services/testimonialService'
import { ok } from '../shared/http'

/**
 * GET /api/testimonials — public: approved reviews only, newest first.
 * There is deliberately no status filter here — the endpoint can never be
 * coerced into returning a pending or rejected review. The teacher's queue is a
 * separate, gated route (GET /testimonials/pending).
 */
export async function getTestimonials(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const testimonials = await listApprovedTestimonials()
    context.log(`Returning ${testimonials.length} approved testimonials`)
    return ok(testimonials)
}

app.http('getTestimonials', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'testimonials',
    handler: getTestimonials,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listPendingTestimonials } from '../services/testimonialService'
import { ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** GET /api/testimonials/pending — teacher: the moderation queue, newest first. */
export async function getPendingTestimonials(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const testimonials = await listPendingTestimonials()
    context.log(`Returning ${testimonials.length} pending testimonials`)
    return ok(testimonials)
}

app.http('getPendingTestimonials', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'testimonials/pending',
    handler: getPendingTestimonials,
})

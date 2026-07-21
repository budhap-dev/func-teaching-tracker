import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { deleteTestimonial } from '../services/testimonialService'
import { badRequest, notFound, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * DELETE /api/testimonials/{id} — teacher: remove a review entirely. Used for
 * spam/abuse, and as the GDPR erasure path if a submitter asks to be forgotten.
 */
export async function deleteTestimonialHandler(
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

    const removed = await deleteTestimonial(id)
    if (!removed) {
        return notFound(`Testimonial ${id} not found.`)
    }

    context.log(`Testimonial ${id} deleted`)
    return ok({ id })
}

app.http('deleteTestimonial', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'testimonials/{id}',
    handler: deleteTestimonialHandler,
})

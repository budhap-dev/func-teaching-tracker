import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { TestimonialInput } from '../models/testimonial'
import {
    createTestimonial,
    validateTestimonialInput,
} from '../services/testimonialService'
import { badRequest, created, parseJsonBody } from '../shared/http'

/**
 * POST /api/testimonials — public: a family submits a review for moderation.
 * No auth: this is the one write anyone may make. It lands as Pending and is
 * invisible until the teacher approves it.
 */
export async function createTestimonialHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const body = await parseJsonBody<TestimonialInput>(request)
    const error = validateTestimonialInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const testimonial = await createTestimonial(body)
    // A filled honeypot returns null: answer 201 like a success, store nothing.
    context.log(
        testimonial
            ? `Testimonial ${testimonial.id} submitted (pending)`
            : 'Testimonial submission ignored (honeypot)'
    )
    // Deliberately minimal: the submitter's words go to moderation, not straight
    // back out to the public.
    return created({ ok: true })
}

app.http('createTestimonial', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'testimonials',
    handler: createTestimonialHandler,
})

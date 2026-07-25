import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { LeadInput } from '../models/lead'
import { createLead, validateLeadInput } from '../services/leadService'
import { badRequest, created, parseJsonBody } from '../shared/http'

/**
 * POST /api/leads — public: a parent submits an enquiry (REQ-018).
 * No auth: like a review submission, this is a write anyone may make. It
 * lands as New in the teacher's Leads inbox (REQ-019).
 */
export async function createLeadHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const body = await parseJsonBody<LeadInput>(request)
    const error = validateLeadInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const lead = await createLead(body)
    // A filled honeypot returns null: answer 201 like a success, store nothing.
    context.log(
        lead
            ? `Lead ${lead.id} submitted`
            : 'Lead submission ignored (honeypot)'
    )
    // Deliberately minimal: the enquiry goes to the teacher's inbox, not back
    // out to the public.
    return created({ ok: true })
}

app.http('createLead', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'leads',
    handler: createLeadHandler,
})

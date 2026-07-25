import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { LeadStatus, LeadUpdate } from '../models/lead'
import { setLeadStatus, validateLeadUpdate } from '../services/leadService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PUT /api/leads/{id} — teacher: move an enquiry through the inbox.
 * Body is `{ "status": "New" | "Contacted" | "Converted" }`.
 */
export async function updateLeadHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Lead id must be an integer.')
    }

    const body = await parseJsonBody<LeadUpdate>(request)
    const error = validateLeadUpdate(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const updated = await setLeadStatus(id, body.status as LeadStatus)
    if (!updated) {
        return notFound(`Lead ${id} not found.`)
    }

    context.log(`Lead ${id} → ${updated.status}`)
    return ok(updated)
}

app.http('updateLead', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'leads/{id}',
    handler: updateLeadHandler,
})

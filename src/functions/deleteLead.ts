import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { deleteLead } from '../services/leadService'
import { badRequest, notFound, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * DELETE /api/leads/{id} — teacher: remove an enquiry entirely. The erasure
 * path (REQ-032): a parent asks to be forgotten, or the enquiry was spam.
 * Distinct from a status change — a status keeps the record; this removes it.
 */
export async function deleteLeadHandler(
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

    const removed = await deleteLead(id)
    if (!removed) {
        return notFound(`Lead ${id} not found.`)
    }

    context.log(`Lead ${id} deleted`)
    return ok({ id })
}

app.http('deleteLead', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'leads/{id}',
    handler: deleteLeadHandler,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { listLeads } from '../services/leadService'
import { ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/** GET /api/leads — teacher: the enquiries inbox, newest first (REQ-019). */
export async function getLeads(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const leads = await listLeads()
    context.log(`Returning ${leads.length} leads`)
    return ok(leads)
}

app.http('getLeads', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'leads',
    handler: getLeads,
})

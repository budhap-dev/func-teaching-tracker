import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { getContact } from '../services/contactService'
import { ok } from '../shared/http'

/**
 * GET /api/contact — public: the contact details shown on the Contact page.
 * Empty fields mean the teacher has removed that method; the page omits them.
 */
export async function getContactHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const contact = await getContact()
    context.log('Returning contact details')
    return ok(contact)
}

app.http('getContact', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'contact',
    handler: getContactHandler,
})

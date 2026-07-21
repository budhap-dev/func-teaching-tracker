import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { ContactInput } from '../models/contact'
import { updateContact, validateContactInput } from '../services/contactService'
import { badRequest, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PUT /api/contact — teacher: update the public contact details. Body is
 * `{ "email": "...", "phone": "..." }`; omit or blank a field to remove it.
 */
export async function updateContactHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const body = await parseJsonBody<ContactInput>(request)
    const error = validateContactInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const updated = await updateContact(body)
    context.log('Contact details updated')
    return ok(updated)
}

app.http('updateContact', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'contact',
    handler: updateContactHandler,
})

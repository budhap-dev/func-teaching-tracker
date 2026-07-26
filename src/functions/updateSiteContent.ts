import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { SiteContentInput } from '../models/siteContent'
import {
    updateSiteContent,
    validateSiteContentInput,
} from '../services/siteContentService'
import { badRequest, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PUT /api/site-content — teacher: publish the public site's content
 * (REQ-008). The whole document replaces atomically and is live for the very
 * next public GET — no rebuild, no deploy. Sanitisation happens in the
 * service, on this side of the wire: the browser's behaviour is irrelevant.
 */
export async function updateSiteContentHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const body = await parseJsonBody<SiteContentInput>(request)
    const error = validateSiteContentInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const published = await updateSiteContent(body)
    context.log('Site content published')
    return ok(published)
}

app.http('updateSiteContent', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'site-content',
    handler: updateSiteContentHandler,
})

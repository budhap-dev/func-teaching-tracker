import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { getSiteContent } from '../services/siteContentService'
import { ok } from '../shared/http'

/**
 * GET /api/site-content — public: what the public pages render (REQ-008).
 * Serves the bundled defaults until the teacher first publishes, so the site
 * never renders blank. Visitors aren't signed in; this stays anonymous.
 */
export async function getSiteContentHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const content = await getSiteContent()
    context.log(`Serving site content (${content.subjects.length} subjects)`)
    return ok(content)
}

app.http('getSiteContent', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'site-content',
    handler: getSiteContentHandler,
})

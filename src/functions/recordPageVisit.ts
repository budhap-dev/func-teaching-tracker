import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { PageVisitInput } from '../models/pageVisit'
import {
    recordPageVisit,
    validatePageVisitInput,
} from '../services/pageVisitService'
import { badRequest, parseJsonBody } from '../shared/http'

/**
 * POST /api/events — public: the site counts a visit to one of its own pages
 * (REQ-058).
 *
 * Anonymous by necessity: visitors are not signed in. What arrives carries no
 * personal data — a random per-tab id the browser never stores, and a page
 * name from a closed list — and nothing about the request itself (IP, user
 * agent, referrer) is recorded.
 *
 * It answers 204 either way. A rejected page key is a bad request to a
 * stranger poking the endpoint, but the site's own counting must never turn
 * into an error a visitor could see, so the client fires and forgets.
 */
export async function recordPageVisitHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const body = await parseJsonBody<PageVisitInput>(request)
    const error = validatePageVisitInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    await recordPageVisit(body)
    // The page, never the visitor: the id is not worth logging and the log is
    // not the place for it.
    context.log(`Counted a visit to ${body.page}`)
    return { status: 204 }
}

app.http('recordPageVisit', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'events',
    handler: recordPageVisitHandler,
})

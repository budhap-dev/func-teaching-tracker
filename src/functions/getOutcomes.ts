import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { getOutcomes } from '../services/outcomesService'
import { ok } from '../shared/http'

/**
 * GET /api/outcomes — public: the outcomes strip's numbers (REQ-020).
 * Aggregate tallies computed from live data; nothing personal leaves the
 * API. Visitors aren't signed in; this stays anonymous.
 */
export async function getOutcomesHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const outcomes = await getOutcomes()
    context.log(
        `Serving outcomes (${outcomes.studentsTaught} students, ${outcomes.sessionsDelivered} sessions)`
    )
    return ok(outcomes)
}

app.http('getOutcomes', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'outcomes',
    handler: getOutcomesHandler,
})

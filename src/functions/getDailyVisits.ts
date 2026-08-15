import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { dailyVisits } from '../services/pageVisitService'
import { ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * GET /api/events/daily — teacher: how many visits the public site had each
 * day, and how many reached each page (REQ-058).
 *
 * `?days=` narrows the window (default 30, capped at a year).
 */
export async function getDailyVisits(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const days = Number(request.query.get('days')) || undefined
    const daily = await dailyVisits(days)
    context.log(`Returning ${daily.length} days of visit counts`)
    return ok(daily)
}

app.http('getDailyVisits', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'events/daily',
    handler: getDailyVisits,
})

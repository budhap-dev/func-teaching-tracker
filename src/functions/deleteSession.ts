import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { deleteSessionClass } from '../services/sessionService'
import { badRequest, notFound, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * DELETE /api/sessions/{id} — permanently removes a class (every row of a
 * group class), as if it were never booked. This is a real delete, distinct
 * from cancelling (PUT with `{ status: 'Cancelled' }`), which keeps a marked
 * row for the record. Returns the removed ids so the client can drop them.
 */
export async function deleteSessionHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Session id must be an integer.')
    }

    const ids = await deleteSessionClass(id)
    if (!ids) {
        return notFound(`Session ${id} not found.`)
    }

    context.log(
        ids.length === 1
            ? `Session ${id} deleted`
            : `Group class deleted (${ids.length} rows)`
    )
    return ok({ ids })
}

app.http('deleteSession', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'sessions/{id}',
    handler: deleteSessionHandler,
})

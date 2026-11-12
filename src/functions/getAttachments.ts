import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import {
    listAttachments,
    parseAttachmentQuery,
} from '../services/attachmentService'
import { badRequest, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * GET /api/attachments — teacher: the file index, newest first (REQ-063).
 * Filters: from, to, studentId, sessionId, subject, type, q — all combine.
 * The bytes are in the teacher's OneDrive; this is only where to find them.
 */
export async function getAttachments(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const parsed = parseAttachmentQuery(request.query)
    if ('error' in parsed) {
        return badRequest(parsed.error)
    }

    const attachments = await listAttachments(parsed.query)
    context.log(`Returning ${attachments.length} attachments`)
    return ok(attachments)
}

app.http('getAttachments', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'attachments',
    handler: getAttachments,
})

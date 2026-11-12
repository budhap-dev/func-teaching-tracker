import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { AttachmentInput } from '../models/attachment'
import {
    createAttachment,
    validateAttachmentInput,
} from '../services/attachmentService'
import { badRequest, created, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * POST /api/attachments — teacher: index a file OneDrive has already
 * accepted (REQ-063). Sent only after the upload succeeds, so a failed upload
 * leaves no ghost row. A retry of the same (class, drive item) answers 200
 * with the row already made.
 */
export async function createAttachmentHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const body = await parseJsonBody<AttachmentInput>(request)
    const error = validateAttachmentInput(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const outcome = await createAttachment(body)
    if (!outcome.ok) {
        return badRequest(`Class ${body.sessionId} does not exist.`)
    }

    // Ids only, never the file name: it may name a child.
    context.log(
        `Attachment ${outcome.attachment.id} ${outcome.created ? 'added to' : 'already on'} class ${outcome.attachment.sessionId}`
    )
    return outcome.created ? created(outcome.attachment) : ok(outcome.attachment)
}

app.http('createAttachment', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'attachments',
    handler: createAttachmentHandler,
})

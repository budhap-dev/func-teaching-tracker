import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { AttachmentUpdate } from '../models/attachment'
import {
    updateAttachment,
    validateAttachmentUpdate,
} from '../services/attachmentService'
import { badRequest, notFound, ok, parseJsonBody } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * PATCH /api/attachments/{id} — teacher: set or clear a file's caption
 * (REQ-063). The caption is the only thing that changes after upload.
 */
export async function updateAttachmentHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const id = Number(request.params.id)
    if (!Number.isInteger(id)) {
        return badRequest('Attachment id must be an integer.')
    }

    const body = await parseJsonBody<AttachmentUpdate>(request)
    const error = validateAttachmentUpdate(body)
    if (error || !body) {
        return badRequest(error ?? 'Invalid request body.')
    }

    const attachment = await updateAttachment(id, body)
    if (!attachment) {
        return notFound(`Attachment ${id} not found.`)
    }

    context.log(`Attachment ${id} caption updated`)
    return ok(attachment)
}

app.http('updateAttachment', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'attachments/{id}',
    handler: updateAttachmentHandler,
})

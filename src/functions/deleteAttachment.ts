import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { deleteAttachment } from '../services/attachmentService'
import { badRequest, noContent } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * DELETE /api/attachments/{id} — teacher: forget a file's index row
 * (REQ-063). The browser deletes the OneDrive item first; the API cannot
 * reach the drive. Idempotent, so a double tap is not an error.
 */
export async function deleteAttachmentHandler(
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

    await deleteAttachment(id)
    context.log(`Attachment ${id} deleted`)
    return noContent()
}

app.http('deleteAttachment', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'attachments/{id}',
    handler: deleteAttachmentHandler,
})

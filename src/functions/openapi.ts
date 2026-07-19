import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { openApiDocument } from '../docs/openapi'

/**
 * GET /api/openapi.json — the OpenAPI 3.0 description of this API.
 *
 * Public and ungated (no requireTeacher): the spec describes the surface, it
 * doesn't expose data. `GET /api/docs` renders it as an interactive page.
 */
export async function openApiHandler(
    _request: HttpRequest,
    _context: InvocationContext
): Promise<HttpResponseInit> {
    return {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
        jsonBody: openApiDocument,
    }
}

app.http('openapi', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'openapi.json',
    handler: openApiHandler,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'

/**
 * GET /api/docs — interactive API reference, rendered by Scalar from the
 * OpenAPI document at /api/openapi.json.
 *
 * Public and ungated. Scalar (MIT, free) is loaded from a public CDN; the page
 * points it at the sibling spec endpoint via a relative URL, so it follows the
 * app wherever it is deployed.
 */
const page = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Teaching Tracker API — Reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="./openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

export async function docsHandler(
    _request: HttpRequest,
    _context: InvocationContext
): Promise<HttpResponseInit> {
    return {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
        body: page,
    }
}

app.http('docs', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'docs',
    handler: docsHandler,
})

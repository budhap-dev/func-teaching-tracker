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
 *
 * An optional `?theme=` query parameter selects one of Scalar's built-in
 * themes (e.g. /api/docs?theme=purple). Unknown values fall back to the
 * default. Scalar's own light/dark toggle is available on every theme.
 */
const SCALAR_THEMES = [
    'default',
    'alternate',
    'moon',
    'purple',
    'solarized',
    'bluePlanet',
    'saturn',
    'kepler',
    'mars',
    'deepSpace',
] as const

type ScalarTheme = (typeof SCALAR_THEMES)[number]

const DEFAULT_THEME: ScalarTheme = 'default'

function isScalarTheme(value: string): value is ScalarTheme {
    return (SCALAR_THEMES as readonly string[]).includes(value)
}

function renderPage(theme: ScalarTheme): string {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Teaching Tracker API — Reference</title>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="./openapi.json"
      data-configuration='{"theme":"${theme}"}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`
}

export async function docsHandler(
    request: HttpRequest,
    _context: InvocationContext
): Promise<HttpResponseInit> {
    const requested = request.query.get('theme') ?? DEFAULT_THEME
    const theme = isScalarTheme(requested) ? requested : DEFAULT_THEME
    return {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
        body: renderPage(theme),
    }
}

app.http('docs', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'docs',
    handler: docsHandler,
})

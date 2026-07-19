import { HttpResponseInit } from '@azure/functions'

/** 200 OK with a JSON body. */
export const ok = (body: unknown): HttpResponseInit => ({
    status: 200,
    jsonBody: body,
})

/** 201 Created with a JSON body. */
export const created = (body: unknown): HttpResponseInit => ({
    status: 201,
    jsonBody: body,
})

/** 400 Bad Request with an error message. */
export const badRequest = (message: string): HttpResponseInit => ({
    status: 400,
    jsonBody: { error: message },
})

/** 401 Unauthorized — no token, or one that fails validation. */
export const unauthorized = (message: string): HttpResponseInit => ({
    status: 401,
    jsonBody: { error: message },
})

/** 403 Forbidden — a valid token, but not an allowed teacher. */
export const forbidden = (message: string): HttpResponseInit => ({
    status: 403,
    jsonBody: { error: message },
})

/** 404 Not Found with an error message. */
export const notFound = (message: string): HttpResponseInit => ({
    status: 404,
    jsonBody: { error: message },
})

/** 204 No Content — a successful action with nothing to return (e.g. delete). */
export const noContent = (): HttpResponseInit => ({ status: 204 })

/** 409 Conflict — the request clashes with the resource's current state. */
export const conflict = (message: string): HttpResponseInit => ({
    status: 409,
    jsonBody: { error: message },
})

/**
 * Parses a request JSON body, returning `undefined` when the body is empty or
 * not valid JSON. Callers should validate the returned shape.
 */
export const parseJsonBody = async <T>(
    request: { text: () => Promise<string> }
): Promise<T | undefined> => {
    const raw = await request.text()
    if (!raw) {
        return undefined
    }
    try {
        return JSON.parse(raw) as T
    } catch {
        return undefined
    }
}

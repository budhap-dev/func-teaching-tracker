import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from 'jsonwebtoken'
import jwksClient, { JwksClient } from 'jwks-rsa'
import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import { forbidden, unauthorized } from './http'

/**
 * Teacher authentication (REQ-004, T2).
 *
 * Every teacher endpoint calls {@link requireTeacher} first. The token is a
 * v2.0 Entra access token requested by the SPA for the API app registration;
 * it is validated here — signature via the tenant's JWKS, issuer, audience,
 * expiry, scope — and then the caller's email is checked against the
 * `teacher-emails` allow-list in Key Vault (read with the app's managed
 * identity, cached a few minutes).
 *
 * The auth infrastructure exists ahead of the frontend's sign-in, so
 * enforcement is gated by the AUTH_ENFORCED app setting: while `false`, every
 * request runs the same checks but is let through with the verdict logged —
 * flipping the flag is a config change, not a deploy. Anything that cannot be
 * evaluated (Key Vault down, JWKS unreachable) fails CLOSED when enforced.
 */

/** How long one Key Vault read of the allow-list is trusted. */
const ALLOW_LIST_TTL_MS = 5 * 60 * 1000

/** Auth outcome: the caller's identity, or the HTTP response refusing them. */
export type TeacherAuth = { email: string }

const config = () => ({
    tenantId: process.env.TENANT_ID ?? '',
    apiClientId: process.env.API_CLIENT_ID ?? '',
    keyVaultUrl: process.env.KEY_VAULT_URL ?? '',
    enforced: process.env.AUTH_ENFORCED === 'true',
})

// Module-scope singletons: JWKS keys and the vault client survive across
// invocations on a warm instance, so steady state adds no network hops.
let keys: JwksClient | undefined
let secrets: SecretClient | undefined
let allowList: { emails: string[]; fetchedAt: number } | undefined

const jwks = (tenantId: string): JwksClient =>
    (keys ??= jwksClient({
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        cache: true,
        rateLimit: true,
    }))

/** Reads the teacher-emails secret, normalised, with a short in-memory cache. */
export const getTeacherEmails = async (): Promise<string[]> => {
    if (allowList && Date.now() - allowList.fetchedAt < ALLOW_LIST_TTL_MS) {
        return allowList.emails
    }
    secrets ??= new SecretClient(
        config().keyVaultUrl,
        new DefaultAzureCredential()
    )
    const secret = await secrets.getSecret('teacher-emails')
    const emails = (secret.value ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    allowList = { emails, fetchedAt: Date.now() }
    return emails
}

/** Verifies the JWT's signature and claims against the tenant + API app. */
const verifyToken = (token: string): Promise<JwtPayload> => {
    const { tenantId, apiClientId } = config()
    const getKey = (header: JwtHeader, callback: SigningKeyCallback) => {
        jwks(tenantId).getSigningKey(header.kid, (error, key) =>
            callback(error, key?.getPublicKey())
        )
    }
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getKey,
            {
                algorithms: ['RS256'],
                issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
                audience: apiClientId,
            },
            (error, decoded) =>
                error || typeof decoded === 'string' || decoded === undefined
                    ? reject(error ?? new Error('Unexpected token payload.'))
                    : resolve(decoded)
        )
    })
}

/** The full check: token → claims → scope → allow-list. Never throws. */
const evaluate = async (
    request: HttpRequest
): Promise<{ email: string; refusal?: HttpResponseInit }> => {
    const header = request.headers.get('authorization') ?? ''
    const token = header.replace(/^Bearer\s+/i, '')
    if (!token) {
        return { email: '', refusal: unauthorized('Missing bearer token.') }
    }

    let payload: JwtPayload
    try {
        payload = await verifyToken(token)
    } catch {
        return { email: '', refusal: unauthorized('Invalid or expired token.') }
    }

    // The scope ties the token to this API's teacher surface specifically —
    // audience alone would accept any token minted for the app.
    const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : []
    const email = String(payload.preferred_username ?? payload.email ?? '')
        .trim()
        .toLowerCase()
    if (!scopes.includes('access_as_teacher')) {
        return { email, refusal: forbidden('Token lacks the teacher scope.') }
    }

    try {
        const allowed = await getTeacherEmails()
        if (!allowed.includes(email)) {
            return {
                email,
                refusal: forbidden(`${email || 'This account'} is not an allowed teacher.`),
            }
        }
    } catch {
        // Can't read the allow-list: fail closed. A refusal that clears when
        // Key Vault returns beats silently serving student data.
        return {
            email,
            refusal: forbidden('The teacher allow-list is unavailable.'),
        }
    }

    return { email }
}

/**
 * Gate for teacher endpoints. Returns the caller's identity, or the response
 * to send back. While AUTH_ENFORCED is false the verdict is only logged, so
 * the API keeps serving the not-yet-authenticated frontend.
 */
export const requireTeacher = async (
    request: HttpRequest,
    context: InvocationContext
): Promise<TeacherAuth | HttpResponseInit> => {
    const outcome = await evaluate(request)

    if (!outcome.refusal) {
        return { email: outcome.email }
    }
    if (config().enforced) {
        context.log(
            `AUTH refused ${request.method} ${new URL(request.url).pathname}: ${JSON.stringify(outcome.refusal.jsonBody)}`
        )
        return outcome.refusal
    }
    context.log(
        `AUTH (not enforced) would refuse ${request.method} ${new URL(request.url).pathname}: ${JSON.stringify(outcome.refusal.jsonBody)}`
    )
    return { email: outcome.email }
}

/** True when {@link requireTeacher} returned a refusal to send back. */
export const isRefusal = (
    auth: TeacherAuth | HttpResponseInit
): auth is HttpResponseInit => 'status' in auth

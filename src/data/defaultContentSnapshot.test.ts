import { describe, expect, it } from 'vitest'
import { defaultSiteContent } from './defaultSiteContent'

/**
 * The bundled defaults are mirrored in the frontend repo, which renders them
 * whenever the API has not answered yet (REQ-045). The mirror used to be
 * discipline: the copy drifted on 2026-08-06 and cost a debugging session,
 * and by 2026-08-12 the two had parted again over the services list and the
 * per-session pricing wording.
 *
 * This snapshot makes each repo's own defaults reviewable in one plain file,
 * and the `content-drift` CI job compares the two files across the repos —
 * so a change to one side that never reached the other fails the build.
 *
 * Regenerate after an intended change: `npx vitest -u`.
 */

/** Key order is an implementation detail; content is not. Sorting keys keeps
    the two repos comparable byte-for-byte however their literals are laid
    out. Array order is meaningful (it is the order families read), so it
    stays exactly as written. */
const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(canonical)
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, inner]) => [key, canonical(inner)])
        )
    }
    return value
}

describe('bundled default site content', () => {
    it('matches the shared snapshot the other repo is compared against', async () => {
        await expect(
            `${JSON.stringify(canonical(defaultSiteContent), null, 2)}\n`
        ).toMatchFileSnapshot('../../site-content.default.json')
    })
})

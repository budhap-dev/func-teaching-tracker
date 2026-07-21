/**
 * A light profanity screen for public submissions (REQ-028).
 *
 * This does NOT block or hide anything — it only *flags* text so the teacher's
 * moderation queue can highlight likely-offensive reviews for a closer look.
 * Nothing is ever published without the teacher approving it, so a missed word
 * (false negative) is caught by human review, and a false positive just adds a
 * badge the teacher can ignore.
 *
 * Matching is whole-word (with common suffixes) over a leet-normalised copy, so
 * "sh1t"/"f*ck"/"a$$" are caught while innocent words that merely contain a bad
 * substring — Scunthorpe, assist, class, cockpit — are not.
 */

/**
 * A starter blocklist of common profanity and slurs. Deliberately small and
 * mainstream; extend it (or move it to configuration) as needed.
 */
export const profanityBlocklist: string[] = [
    'fuck',
    'shit',
    'bitch',
    'bastard',
    'asshole',
    'ass',
    'arse',
    'arsehole',
    'dick',
    'piss',
    'crap',
    'cunt',
    'bollocks',
    'wanker',
    'twat',
    'slut',
    'whore',
    'prick',
    'douche',
    'nigger',
    'faggot',
    'retard',
]

// Fold common letter-for-symbol substitutions back to letters so "sh1t" and
// "a$$" normalise to "shit" and "ass".
const leetMap: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '!': 'i',
    '|': 'i',
    '3': 'e',
    '4': 'a',
    '@': 'a',
    '5': 's',
    $: 's',
    '7': 't',
    '8': 'b',
}

const normalise = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[01!|34@57$8]/g, (character) => leetMap[character] ?? character)

// Word boundaries + a short list of common inflections, so "fucking"/"shits"
// match but "assist"/"classic" do not (the trailing letters break the \b).
const suffix = "(?:s|es|ed|ing|er|ers|in'?|y|z)?"
const pattern = new RegExp(
    `\\b(?:${profanityBlocklist.join('|')})${suffix}\\b`,
    'i'
)

/** True when the text contains a blocklisted word (leet-normalised, whole-word). */
export const containsProfanity = (text: string): boolean =>
    pattern.test(normalise(text))

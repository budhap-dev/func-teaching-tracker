/**
 * A file on a class (REQ-063): a whiteboard photo, a marked worksheet, a past
 * paper.
 *
 * **The bytes are not here.** They live in the teacher's own OneDrive (the
 * app's folder), written and read by the browser with the teacher's delegated
 * consent. The API cannot reach that drive — app-only Graph access does not
 * exist for personal OneDrive — so this row is only the *index*: enough to
 * find a file by date, student, subject or class, and the `driveItemId` the
 * browser needs to show it, rename it or delete it.
 *
 * One row per student per file. A group class keeps one copy per attendee
 * (owner decision, 2026-11-12), and each copy has its own row and its own
 * `driveItemId`, so erasing one student never touches a file another student
 * still needs.
 *
 * Private to the teacher on every verb: these are pictures of children's
 * work, and file names and captions may name them.
 */
export interface Attachment {
    id: number
    /** The class row (one student's) this file belongs to. */
    sessionId: number
    /**
     * Copied from the class when the row is written, then refreshed from the
     * class on every read — so a class moved to another day or subject never
     * leaves its files filed under the old one. The copy is only the fallback
     * for a row whose class has gone.
     */
    studentId: number
    studentName: string
    /** `YYYY-MM-DD` — the class's day, not the upload's. */
    date: string
    subject: string
    groupId?: string
    /** The name the teacher sees; the file's name in OneDrive may differ. */
    fileName: string
    contentType: AttachmentContentType
    /** Derived from `contentType`, for the type filter. */
    kind: AttachmentKind
    sizeBytes: number
    /** OneDrive's id for the item — survives moves and renames in the drive. */
    driveItemId: string
    /** Absent when there is none; never an empty string. */
    caption?: string
    /** ISO timestamp, set by the API. */
    uploadedAt: string
}

export type AttachmentKind = 'photo' | 'pdf' | 'word' | 'powerpoint'

/** The closed list of types a class may carry (owner decision, 2026-11-08). */
export const contentTypeKinds = {
    'image/jpeg': 'photo',
    'image/png': 'photo',
    'image/webp': 'photo',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'word',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'powerpoint',
} as const satisfies Record<string, AttachmentKind>

export type AttachmentContentType = keyof typeof contentTypeKinds

export const attachmentKinds: AttachmentKind[] = [
    'photo',
    'pdf',
    'word',
    'powerpoint',
]

/** What the browser sends once OneDrive has confirmed the upload. */
export interface AttachmentInput {
    sessionId: number
    fileName: string
    contentType: string
    sizeBytes: number
    driveItemId: string
    caption?: string
}

/** The only thing that changes after upload. Empty or absent clears it. */
export interface AttachmentUpdate {
    caption?: string
}

/** GET /attachments filters — every one optional, all combined. */
export interface AttachmentQuery {
    from?: string
    to?: string
    studentId?: number
    sessionId?: number
    subject?: string
    kind?: AttachmentKind
    /** Matched, case-insensitively, against file name and caption. */
    text?: string
}

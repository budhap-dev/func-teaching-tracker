import { dataStore } from '../data/store'
import {
    Attachment,
    AttachmentInput,
    AttachmentKind,
    AttachmentQuery,
    AttachmentUpdate,
    attachmentKinds,
    contentTypeKinds,
} from '../models/attachment'
import { ScheduledSession } from '../models/session'

/** 20MB per file (owner decision, 2026-11-08). */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const MAX_FILE_NAME = 200
const MAX_CAPTION = 300
/**
 * OneDrive item ids: personal drives look like `E3970E054464BE5C!s9936…`,
 * business ones are base32-ish. Anything else is not an id we wrote.
 */
const DRIVE_ITEM_ID = /^[A-Za-z0-9!._-]{1,200}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const stripHtml = (text: string): string => text.replace(/<[^>]*>/g, '').trim()

const isKnownContentType = (
    value: string
): value is keyof typeof contentTypeKinds =>
    Object.prototype.hasOwnProperty.call(contentTypeKinds, value)

/** The class's current day, subject and student win over the row's copy. */
const withClass = (
    attachment: Attachment,
    session: ScheduledSession | undefined
): Attachment => {
    if (!session) {
        return attachment
    }
    const fresh: Attachment = {
        ...attachment,
        studentId: session.studentId,
        studentName: session.studentName,
        date: session.date,
        subject: session.subject,
    }
    delete fresh.groupId
    return session.groupId ? { ...fresh, groupId: session.groupId } : fresh
}

const byNewest = (left: Attachment, right: Attachment): number =>
    right.date.localeCompare(left.date) ||
    right.uploadedAt.localeCompare(left.uploadedAt) ||
    right.id - left.id

/**
 * The index, filtered and newest first. Search is ours, not OneDrive's:
 * Graph search is fuzzy and knows nothing about students or classes.
 */
export const listAttachments = async (
    query: AttachmentQuery = {}
): Promise<Attachment[]> => {
    const [rows, sessions] = await Promise.all([
        dataStore.listAttachments(),
        dataStore.listSessions(),
    ])
    const sessionsById = new Map(sessions.map((s) => [s.id, s]))
    const subject = query.subject?.trim().toLowerCase()
    const text = query.text?.trim().toLowerCase()

    return rows
        .map((row) => withClass(row, sessionsById.get(row.sessionId)))
        .filter(
            (a) =>
                (!query.from || a.date >= query.from) &&
                (!query.to || a.date <= query.to) &&
                (query.studentId === undefined ||
                    a.studentId === query.studentId) &&
                (query.sessionId === undefined ||
                    a.sessionId === query.sessionId) &&
                (!subject || a.subject.toLowerCase() === subject) &&
                (!query.kind || a.kind === query.kind) &&
                (!text ||
                    a.fileName.toLowerCase().includes(text) ||
                    (a.caption ?? '').toLowerCase().includes(text))
        )
        .sort(byNewest)
}

/**
 * Turns the query string into filters, or says what is wrong with it. An
 * unknown parameter is ignored; a known one with a bad value is refused, so a
 * typo in a date never silently widens the search to everything.
 */
export const parseAttachmentQuery = (
    params: URLSearchParams
): { query: AttachmentQuery } | { error: string } => {
    const query: AttachmentQuery = {}
    for (const key of ['from', 'to'] as const) {
        const value = params.get(key)
        if (value) {
            if (!DATE_PATTERN.test(value)) {
                return { error: `${key} must be a calendar date, YYYY-MM-DD.` }
            }
            query[key] = value
        }
    }
    for (const key of ['studentId', 'sessionId'] as const) {
        const value = params.get(key)
        if (value) {
            const id = Number(value)
            if (!Number.isInteger(id)) {
                return { error: `${key} must be an integer.` }
            }
            query[key] = id
        }
    }
    const kind = params.get('type')
    if (kind) {
        if (!attachmentKinds.includes(kind as AttachmentKind)) {
            return { error: `type must be one of ${attachmentKinds.join(', ')}.` }
        }
        query.kind = kind as AttachmentKind
    }
    const subject = params.get('subject')
    if (subject) query.subject = subject
    const text = params.get('q')
    if (text) query.text = text
    return { query }
}

export const validateAttachmentInput = (
    input: AttachmentInput | undefined
): string | undefined => {
    if (!input || typeof input !== 'object') {
        return 'Expected an attachment object.'
    }
    if (!Number.isInteger(input.sessionId)) {
        return 'sessionId must be an integer.'
    }
    if (
        typeof input.fileName !== 'string' ||
        input.fileName.trim().length === 0
    ) {
        return 'fileName is required.'
    }
    if (input.fileName.trim().length > MAX_FILE_NAME) {
        return `fileName must be ${MAX_FILE_NAME} characters or fewer.`
    }
    if (
        typeof input.contentType !== 'string' ||
        !isKnownContentType(input.contentType)
    ) {
        return 'contentType must be an image (JPEG, PNG, WebP), a PDF, or a Word or PowerPoint file.'
    }
    if (
        !Number.isInteger(input.sizeBytes) ||
        input.sizeBytes <= 0 ||
        input.sizeBytes > MAX_ATTACHMENT_BYTES
    ) {
        return 'sizeBytes must be a whole number of bytes, at most 20MB.'
    }
    if (
        typeof input.driveItemId !== 'string' ||
        !DRIVE_ITEM_ID.test(input.driveItemId)
    ) {
        return 'driveItemId must be a OneDrive item id.'
    }
    return validateCaption(input.caption)
}

export const validateAttachmentUpdate = (
    update: AttachmentUpdate | undefined
): string | undefined => {
    if (!update || typeof update !== 'object') {
        return 'Expected an object with a caption.'
    }
    return validateCaption(update.caption)
}

const validateCaption = (caption: unknown): string | undefined => {
    if (caption === undefined || caption === null) {
        return undefined
    }
    if (typeof caption !== 'string') {
        return 'caption must be text.'
    }
    if (stripHtml(caption).length > MAX_CAPTION) {
        return `caption must be ${MAX_CAPTION} characters or fewer.`
    }
    return undefined
}

/** A caption with nothing in it is no caption: the field is left out. */
const withCaption = (
    attachment: Attachment,
    caption: string | undefined | null
): Attachment => {
    const next = { ...attachment }
    delete next.caption
    const clean = caption ? stripHtml(caption) : ''
    return clean ? { ...next, caption: clean } : next
}

export type CreateOutcome =
    | { ok: true; attachment: Attachment; created: boolean }
    | { ok: false; reason: 'no-class' }

/**
 * Indexes a file OneDrive has already accepted. The class supplies the
 * student, day and subject — the browser is not trusted to.
 *
 * Idempotent per (class, drive item): a phone that lost signal after OneDrive
 * answered retries the POST, and gets the row it already made rather than a
 * second one.
 */
export const createAttachment = async (
    input: AttachmentInput
): Promise<CreateOutcome> => {
    const session = await dataStore.getSession(input.sessionId)
    if (!session) {
        return { ok: false, reason: 'no-class' }
    }
    const existing = (await dataStore.listAttachments()).find(
        (a) =>
            a.sessionId === input.sessionId &&
            a.driveItemId === input.driveItemId
    )
    if (existing) {
        return {
            ok: true,
            attachment: withClass(existing, session),
            created: false,
        }
    }

    const contentType = input.contentType as keyof typeof contentTypeKinds
    const attachment = withCaption(
        withClass(
            {
                id: await dataStore.nextAttachmentId(),
                sessionId: session.id,
                studentId: session.studentId,
                studentName: session.studentName,
                date: session.date,
                subject: session.subject,
                fileName: input.fileName.trim(),
                contentType,
                kind: contentTypeKinds[contentType],
                sizeBytes: input.sizeBytes,
                driveItemId: input.driveItemId,
                uploadedAt: new Date().toISOString(),
            },
            session
        ),
        input.caption
    )
    await dataStore.putAttachment(attachment)
    return { ok: true, attachment, created: true }
}

/** Sets or clears the caption. Undefined when there is no such file. */
export const updateAttachment = async (
    id: number,
    update: AttachmentUpdate
): Promise<Attachment | undefined> => {
    const existing = await dataStore.getAttachment(id)
    if (!existing) {
        return undefined
    }
    const attachment = withCaption(existing, update.caption)
    await dataStore.putAttachment(attachment)
    return withClass(attachment, await dataStore.getSession(attachment.sessionId))
}

/**
 * Forgets one file's index row. The browser deletes the OneDrive item first
 * — the API cannot reach the drive.
 */
export const deleteAttachment = async (id: number): Promise<void> => {
    await dataStore.deleteAttachment(id)
}

/**
 * Drops the index rows of classes that no longer exist. Called when a class
 * is deleted; the browser has already removed the files from OneDrive.
 */
export const deleteAttachmentsForSessions = async (
    sessionIds: number[]
): Promise<void> => {
    const gone = new Set(sessionIds)
    for (const attachment of await dataStore.listAttachments()) {
        if (gone.has(attachment.sessionId)) {
            await dataStore.deleteAttachment(attachment.id)
        }
    }
}

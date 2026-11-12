import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Attachment, AttachmentInput } from '../models/attachment'
import type { ScheduledSession } from '../models/session'

const fake = {
    attachments: [] as Attachment[],
    sessions: [] as ScheduledSession[],
    nextId: 1,
}

vi.mock('../data/store', () => ({
    environmentName: 'test',
    dataStore: {
        listAttachments: async () => fake.attachments,
        getAttachment: async (id: number) =>
            fake.attachments.find((a) => a.id === id),
        putAttachment: async (attachment: Attachment) => {
            const index = fake.attachments.findIndex(
                (a) => a.id === attachment.id
            )
            if (index >= 0) {
                fake.attachments[index] = attachment
            } else {
                fake.attachments.push(attachment)
            }
        },
        deleteAttachment: async (id: number) => {
            fake.attachments = fake.attachments.filter((a) => a.id !== id)
        },
        nextAttachmentId: async () => fake.nextId++,
        listSessions: async () => fake.sessions,
        getSession: async (id: number) =>
            fake.sessions.find((s) => s.id === id),
    },
}))

import {
    createAttachment,
    deleteAttachment,
    deleteAttachmentsForSessions,
    listAttachments,
    MAX_ATTACHMENT_BYTES,
    parseAttachmentQuery,
    updateAttachment,
    validateAttachmentInput,
    validateAttachmentUpdate,
} from './attachmentService'

const DOCX =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const session = (
    id: number,
    over: Partial<ScheduledSession> = {}
): ScheduledSession => ({
    id,
    studentId: 1,
    studentName: 'Asha Patel',
    year: 'Year 10',
    subject: 'Maths',
    date: '2026-11-12',
    time: '16:00',
    durationMinutes: 60,
    notes: '',
    status: 'Scheduled',
    ...over,
})

const input = (over: Partial<AttachmentInput> = {}): AttachmentInput => ({
    sessionId: 10,
    fileName: 'whiteboard.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 120_000,
    driveItemId: 'E3970E054464BE5C!s9936516d44ec4f74',
    ...over,
})

beforeEach(() => {
    fake.attachments = []
    fake.sessions = [session(10)]
    fake.nextId = 1
})

describe('validateAttachmentInput', () => {
    it('accepts a good upload', () => {
        expect(validateAttachmentInput(input())).toBeUndefined()
        expect(
            validateAttachmentInput(input({ contentType: DOCX, caption: 'Q3' }))
        ).toBeUndefined()
    })

    it.each([
        ['no body', undefined, /Expected/],
        ['no class', input({ sessionId: 1.5 }), /sessionId/],
        ['blank name', input({ fileName: '  ' }), /fileName is required/],
        ['long name', input({ fileName: 'a'.repeat(201) }), /200/],
        ['a zip', input({ contentType: 'application/zip' }), /contentType/],
        ['an old .doc', input({ contentType: 'application/msword' }), /contentType/],
        ['empty file', input({ sizeBytes: 0 }), /sizeBytes/],
        ['over 20MB', input({ sizeBytes: MAX_ATTACHMENT_BYTES + 1 }), /20MB/],
        ['bad drive id', input({ driveItemId: '../../etc' }), /driveItemId/],
        ['long caption', input({ caption: 'x'.repeat(301) }), /300/],
        ['caption not text', input({ caption: 5 as unknown as string }), /caption/],
    ])('refuses %s', (_label, body, message) => {
        expect(validateAttachmentInput(body)).toMatch(message)
    })

    it('allows exactly 20MB', () => {
        expect(
            validateAttachmentInput(input({ sizeBytes: MAX_ATTACHMENT_BYTES }))
        ).toBeUndefined()
    })
})

describe('validateAttachmentUpdate', () => {
    it('accepts a caption, an empty one, or none', () => {
        expect(validateAttachmentUpdate({ caption: 'Past paper' })).toBeUndefined()
        expect(validateAttachmentUpdate({ caption: '' })).toBeUndefined()
        expect(validateAttachmentUpdate({})).toBeUndefined()
    })
    it('refuses no body and an over-long caption', () => {
        expect(validateAttachmentUpdate(undefined)).toMatch(/caption/)
        expect(validateAttachmentUpdate({ caption: 'x'.repeat(301) })).toMatch(
            /300/
        )
    })
})

describe('createAttachment', () => {
    it('files the upload under the class, not what the browser says', async () => {
        fake.sessions = [session(10, { groupId: 'grp-10' })]
        const outcome = await createAttachment(
            input({ fileName: '  whiteboard.jpg ', caption: '<b>Q2</b> ' })
        )
        expect(outcome).toMatchObject({
            ok: true,
            created: true,
            attachment: {
                id: 1,
                sessionId: 10,
                studentId: 1,
                studentName: 'Asha Patel',
                date: '2026-11-12',
                subject: 'Maths',
                groupId: 'grp-10',
                fileName: 'whiteboard.jpg',
                kind: 'photo',
                caption: 'Q2',
            },
        })
        expect(fake.attachments).toHaveLength(1)
    })

    it('derives the kind from the content type', async () => {
        const { attachment } = (await createAttachment(
            input({ contentType: DOCX, driveItemId: 'A!1' })
        )) as { attachment: Attachment }
        expect(attachment.kind).toBe('word')
    })

    it('leaves out an empty caption rather than storing ""', async () => {
        const { attachment } = (await createAttachment(
            input({ caption: '   ' })
        )) as { attachment: Attachment }
        expect('caption' in attachment).toBe(false)
    })

    it('refuses a class that does not exist', async () => {
        expect(await createAttachment(input({ sessionId: 99 }))).toEqual({
            ok: false,
            reason: 'no-class',
        })
        expect(fake.attachments).toEqual([])
    })

    it('is idempotent per class and drive item — a retry makes no second row', async () => {
        await createAttachment(input())
        const again = await createAttachment(input())
        expect(again).toMatchObject({ ok: true, created: false })
        expect(fake.attachments).toHaveLength(1)
    })

    it('makes a row per copy for a group class (different drive items)', async () => {
        fake.sessions = [
            session(10, { groupId: 'grp-10' }),
            session(11, { groupId: 'grp-10', studentId: 2, studentName: 'Ben' }),
        ]
        await createAttachment(input({ sessionId: 10, driveItemId: 'A!1' }))
        await createAttachment(input({ sessionId: 11, driveItemId: 'A!2' }))
        expect(fake.attachments.map((a) => a.studentId)).toEqual([1, 2])
    })
})

describe('listAttachments', () => {
    const seed = async () => {
        fake.sessions = [
            session(10),
            session(11, { date: '2026-11-05', subject: 'Physics', studentId: 2, studentName: 'Ben' }),
            session(12, { date: '2026-10-01' }),
        ]
        await createAttachment(input({ sessionId: 10, driveItemId: 'A!1', fileName: 'whiteboard.jpg' }))
        await createAttachment(input({ sessionId: 11, driveItemId: 'A!2', fileName: 'Past paper 2023.docx', contentType: DOCX }))
        await createAttachment(input({ sessionId: 12, driveItemId: 'A!3', fileName: 'scan.pdf', contentType: 'application/pdf', caption: 'Mock exam' }))
    }

    it('lists newest class first', async () => {
        await seed()
        expect((await listAttachments()).map((a) => a.id)).toEqual([1, 2, 3])
    })

    it.each([
        [{ from: '2026-11-01' }, [1, 2]],
        [{ to: '2026-11-05' }, [2, 3]],
        [{ studentId: 2 }, [2]],
        [{ sessionId: 12 }, [3]],
        [{ subject: 'physics' }, [2]],
        [{ kind: 'pdf' as const }, [3]],
        [{ text: 'PAPER' }, [2]],
        [{ text: 'mock' }, [3]],
        [{ from: '2026-10-01', kind: 'photo' as const, studentId: 1 }, [1]],
    ])('filters by %o', async (query, ids) => {
        await seed()
        expect((await listAttachments(query)).map((a) => a.id)).toEqual(ids)
    })

    it('follows the class when it moves day or subject', async () => {
        await seed()
        fake.sessions[0] = session(10, { date: '2026-12-01', subject: 'Further Maths' })
        const [first] = await listAttachments()
        expect(first).toMatchObject({ id: 1, date: '2026-12-01', subject: 'Further Maths' })
    })

    it('keeps its own copy when the class has gone', async () => {
        await seed()
        fake.sessions = fake.sessions.filter((s) => s.id !== 10)
        const row = (await listAttachments()).find((a) => a.id === 1)
        expect(row).toMatchObject({ date: '2026-11-12', subject: 'Maths' })
    })
})

describe('parseAttachmentQuery', () => {
    const parse = (qs: string) => parseAttachmentQuery(new URLSearchParams(qs))

    it('reads every filter', () => {
        expect(
            parse('from=2026-11-01&to=2026-11-30&studentId=2&sessionId=7&subject=Maths&type=word&q=paper&other=x')
        ).toEqual({
            query: {
                from: '2026-11-01',
                to: '2026-11-30',
                studentId: 2,
                sessionId: 7,
                subject: 'Maths',
                kind: 'word',
                text: 'paper',
            },
        })
        expect(parse('')).toEqual({ query: {} })
    })

    it.each([
        ['from=12/11/2026', /from/],
        ['to=soon', /to/],
        ['studentId=abc', /studentId/],
        ['sessionId=1.5', /sessionId/],
        ['type=zip', /type/],
    ])('refuses %s rather than widening the search', (qs, message) => {
        const result = parse(qs)
        expect('error' in result && result.error).toMatch(message)
    })
})

describe('updateAttachment', () => {
    it('sets, strips and clears the caption', async () => {
        await createAttachment(input())
        expect(await updateAttachment(1, { caption: ' <i>Q4</i> ' })).toMatchObject({ caption: 'Q4' })
        const cleared = await updateAttachment(1, { caption: '' })
        expect(cleared && 'caption' in cleared).toBe(false)
        expect('caption' in fake.attachments[0]).toBe(false)
    })

    it('answers undefined for a file that is not there', async () => {
        expect(await updateAttachment(5, { caption: 'x' })).toBeUndefined()
    })
})

describe('deleting', () => {
    it('removes one row, and is fine when it is already gone', async () => {
        await createAttachment(input())
        await deleteAttachment(1)
        await deleteAttachment(1)
        expect(fake.attachments).toEqual([])
    })

    it("drops the rows of deleted classes and keeps everyone else's", async () => {
        fake.sessions = [session(10), session(11)]
        await createAttachment(input({ sessionId: 10, driveItemId: 'A!1' }))
        await createAttachment(input({ sessionId: 11, driveItemId: 'A!2' }))
        await deleteAttachmentsForSessions([10])
        expect(fake.attachments.map((a) => a.sessionId)).toEqual([11])
    })
})

import { describe, expect, it } from 'vitest'
import { MemoryStore } from './memoryStore'

/**
 * The student erasure cascade (GDPR right to erasure, REQ-009/REQ-032):
 * deleting a student must take their sessions and settlements with them.
 * The MemoryStore is the reference adapter the table store is checked
 * against, so the cascade's contract is pinned here.
 */
describe('MemoryStore.deleteStudentCascade', () => {
    it('erases the student with their sessions and settlements, nothing else', async () => {
        const store = new MemoryStore('dev')
        const students = await store.listStudents()
        const target = students[0]
        const other = students[1]
        // A recorded payment for the target, and one for another student.
        await store.putSettlement({
            studentId: target.id,
            month: '2026-07',
            amountPaid: 120,
            notes: 'July, settled',
        })
        await store.putSettlement({
            studentId: other.id,
            month: '2026-07',
            amountPaid: 90,
            notes: '',
        })
        const sessionsBefore = await store.listSessions()
        const otherSessionsBefore = sessionsBefore.filter(
            (session) => session.studentId !== target.id
        )
        expect(
            sessionsBefore.some((session) => session.studentId === target.id)
        ).toBe(true)

        await store.deleteStudentCascade(target.id)

        expect(await store.getStudent(target.id)).toBeUndefined()
        // Every trace of the target is gone…
        const sessionsAfter = await store.listSessions()
        expect(
            sessionsAfter.some((session) => session.studentId === target.id)
        ).toBe(false)
        const settlementsAfter = await store.listSettlements()
        expect(
            settlementsAfter.some(
                (settlement) => settlement.studentId === target.id
            )
        ).toBe(false)
        // …and nobody else lost anything.
        expect(sessionsAfter).toEqual(otherSessionsBefore)
        expect(settlementsAfter).toEqual([
            { studentId: other.id, month: '2026-07', amountPaid: 90, notes: '' },
        ])
        expect(await store.getStudent(other.id)).toBeDefined()
    })
})

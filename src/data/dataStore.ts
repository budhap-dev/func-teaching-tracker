import { Student } from '../models/student'
import { ScheduledSession } from '../models/session'
import { PaymentSettlement } from '../models/payment'
import { Testimonial } from '../models/testimonial'
import { Lead } from '../models/lead'
import { PageVisit } from '../models/pageVisit'
import { Reminder } from '../models/reminder'
import { SiteContent } from '../models/siteContent'
import { Contact } from '../models/contact'

/**
 * The persistence seam (REQ-009).
 *
 * Every operation the services actually need, and nothing more — expressed
 * asynchronously so the same interface fits both the in-memory adapter (which
 * resolves immediately) and a durable store like Azure Table Storage (which
 * awaits the network). Swapping stores is a matter of which implementation the
 * factory returns; the services and functions above never change.
 *
 * What is *not* here: a student's bill. That stays derived from the classes
 * that took place (see paymentService), never stored, so it cannot drift. Only
 * settlements — what the teacher actually recorded — are persisted.
 */
export interface DataStore {
    // --- Students ---
    listStudents(): Promise<Student[]>
    getStudent(id: number): Promise<Student | undefined>
    /** Creates or replaces a student by id. */
    putStudent(student: Student): Promise<void>
    /** Reserves the next numeric student id. */
    nextStudentId(): Promise<number>
    /**
     * Erases a student and everything about them — their sessions and
     * settlements — in one call (GDPR right to erasure, REQ-009 §10).
     */
    deleteStudentCascade(id: number): Promise<void>

    // --- Sessions ---
    listSessions(): Promise<ScheduledSession[]>
    getSession(id: number): Promise<ScheduledSession | undefined>
    /** Every row sharing a group class's id. */
    listSessionsByGroup(groupId: string): Promise<ScheduledSession[]>
    /** Creates or replaces a session by id. */
    putSession(session: ScheduledSession): Promise<void>
    /** Permanently removes a session row by id — a real delete, not a cancel. */
    deleteSession(id: number): Promise<void>
    /**
     * Reserves `count` contiguous numeric session ids — a group booking takes
     * its whole block at once, so its rows keep the `grp-<firstId>` naming.
     */
    nextSessionIds(count: number): Promise<number[]>

    // --- Settlements (the only stored payment fact) ---
    listSettlements(): Promise<PaymentSettlement[]>
    getSettlement(
        studentId: number,
        month: string
    ): Promise<PaymentSettlement | undefined>
    /** Creates or replaces the settlement for one (student, month). */
    putSettlement(settlement: PaymentSettlement): Promise<void>

    // --- Site content (REQ-008) ---
    /** The published document, or undefined when never published. */
    getSiteContent(): Promise<SiteContent | undefined>
    /** Replaces the published document atomically. */
    putSiteContent(content: SiteContent): Promise<void>

    // --- Leads (REQ-018/019) ---
    listLeads(): Promise<Lead[]>
    getLead(id: number): Promise<Lead | undefined>
    /** Creates or replaces a lead by id. */
    putLead(lead: Lead): Promise<void>
    /** Permanently removes a lead by id (spam, or GDPR erasure — REQ-032). */
    deleteLead(id: number): Promise<void>
    /** Reserves the next numeric lead id. */
    nextLeadId(): Promise<number>

    // --- Testimonials (REQ-027) ---
    listTestimonials(): Promise<Testimonial[]>
    getTestimonial(id: number): Promise<Testimonial | undefined>
    /** Creates or replaces a testimonial by id. */
    putTestimonial(testimonial: Testimonial): Promise<void>
    /** Permanently removes a testimonial by id (spam/abuse, or GDPR erasure). */
    deleteTestimonial(id: number): Promise<void>
    /** Reserves the next numeric testimonial id. */
    nextTestimonialId(): Promise<number>

    // --- Reminders (REQ-057) ---
    /** The teacher's own notes-to-self, unordered. */
    listReminders(): Promise<Reminder[]>
    getReminder(id: number): Promise<Reminder | undefined>
    /** Creates or replaces a reminder by id. */
    putReminder(reminder: Reminder): Promise<void>
    deleteReminder(id: number): Promise<void>
    /** Reserves the next numeric reminder id. */
    nextReminderId(): Promise<number>

    // --- Page visits (REQ-058) ---
    /** Appends one counted visit. Rows carry no personal data. */
    putPageVisit(visit: PageVisit): Promise<void>
    /** Every visit on or after `fromDate` (`YYYY-MM-DD`), for the daily roll-up. */
    listPageVisits(fromDate: string): Promise<PageVisit[]>

    // --- Contact (REQ-006/008) ---
    /** The single public contact record; empty fields mean "not offered". */
    getContact(): Promise<Contact>
    /** Replaces the public contact record. */
    putContact(contact: Contact): Promise<void>
}

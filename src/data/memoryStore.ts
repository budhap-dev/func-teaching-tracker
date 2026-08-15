import { Student } from '../models/student'
import { ScheduledSession } from '../models/session'
import { PaymentSettlement } from '../models/payment'
import { Testimonial } from '../models/testimonial'
import { Lead } from '../models/lead'
import { PageVisit } from '../models/pageVisit'
import { SiteContent } from '../models/siteContent'
import { Contact } from '../models/contact'
import { DataStore } from './dataStore'
import { buildSeedForEnv } from './seed'

/**
 * The in-memory adapter — the original store, behind the {@link DataStore}
 * seam. Seeded per environment at construction; state lasts only for the
 * lifetime of a worker process, so it is NOT durable and resets on restart or
 * scale-out. It stays the default for local `func start` and the test suite,
 * and the reference the table adapter is checked against.
 *
 * Every method returns a Promise to match the interface, but resolves
 * synchronously — there is no network here.
 */
export class MemoryStore implements DataStore {
    private students: Student[]
    private sessions: ScheduledSession[]
    private settlements: PaymentSettlement[]
    private testimonials: Testimonial[]
    private leads: Lead[]
    private siteContent: SiteContent | undefined
    private contact: Contact

    constructor(environmentName: string) {
        const seed = buildSeedForEnv(environmentName)
        this.students = seed.students
        this.sessions = seed.sessions
        this.settlements = []
        this.testimonials = seed.testimonials
        // Leads start empty everywhere: enquiries are real-world input, never seeded.
        this.leads = []
        // Unpublished until the teacher publishes — the service serves defaults.
        this.siteContent = undefined
        this.contact = seed.contact
    }

    // --- Students ---
    async listStudents(): Promise<Student[]> {
        return this.students
    }

    async getStudent(id: number): Promise<Student | undefined> {
        return this.students.find((student) => student.id === id)
    }

    async putStudent(student: Student): Promise<void> {
        const index = this.students.findIndex((item) => item.id === student.id)
        if (index >= 0) {
            this.students[index] = student
        } else {
            this.students.push(student)
        }
    }

    async nextStudentId(): Promise<number> {
        return this.students.reduce((max, s) => Math.max(max, s.id), 0) + 1
    }

    async deleteStudentCascade(id: number): Promise<void> {
        this.students = this.students.filter((student) => student.id !== id)
        this.sessions = this.sessions.filter(
            (session) => session.studentId !== id
        )
        this.settlements = this.settlements.filter(
            (settlement) => settlement.studentId !== id
        )
    }

    // --- Sessions ---
    async listSessions(): Promise<ScheduledSession[]> {
        return this.sessions
    }

    async getSession(id: number): Promise<ScheduledSession | undefined> {
        return this.sessions.find((session) => session.id === id)
    }

    async listSessionsByGroup(groupId: string): Promise<ScheduledSession[]> {
        return this.sessions.filter((session) => session.groupId === groupId)
    }

    async putSession(session: ScheduledSession): Promise<void> {
        const index = this.sessions.findIndex((item) => item.id === session.id)
        if (index >= 0) {
            this.sessions[index] = session
        } else {
            this.sessions.push(session)
        }
    }

    async deleteSession(id: number): Promise<void> {
        this.sessions = this.sessions.filter((session) => session.id !== id)
    }

    async nextSessionIds(count: number): Promise<number[]> {
        const base =
            this.sessions.reduce((max, s) => Math.max(max, s.id), 0) + 1
        return Array.from({ length: count }, (_, index) => base + index)
    }

    // --- Settlements ---
    async listSettlements(): Promise<PaymentSettlement[]> {
        return this.settlements
    }

    async getSettlement(
        studentId: number,
        month: string
    ): Promise<PaymentSettlement | undefined> {
        return this.settlements.find(
            (item) => item.studentId === studentId && item.month === month
        )
    }

    async putSettlement(settlement: PaymentSettlement): Promise<void> {
        const existing = this.settlements.find(
            (item) =>
                item.studentId === settlement.studentId &&
                item.month === settlement.month
        )
        if (existing) {
            existing.amountPaid = settlement.amountPaid
            existing.notes = settlement.notes
        } else {
            this.settlements.push(settlement)
        }
    }

    // --- Site content ---
    async getSiteContent(): Promise<SiteContent | undefined> {
        return this.siteContent
    }

    async putSiteContent(content: SiteContent): Promise<void> {
        this.siteContent = content
    }

    // --- Page visits (REQ-058) ---
    private pageVisits: PageVisit[] = []

    async putPageVisit(visit: PageVisit): Promise<void> {
        this.pageVisits.push(visit)
    }

    async listPageVisits(fromDate: string): Promise<PageVisit[]> {
        return this.pageVisits.filter((visit) => visit.date >= fromDate)
    }

    // --- Leads ---
    async listLeads(): Promise<Lead[]> {
        return this.leads
    }

    async getLead(id: number): Promise<Lead | undefined> {
        return this.leads.find((lead) => lead.id === id)
    }

    async putLead(lead: Lead): Promise<void> {
        const index = this.leads.findIndex((item) => item.id === lead.id)
        if (index >= 0) {
            this.leads[index] = lead
        } else {
            this.leads.push(lead)
        }
    }

    async deleteLead(id: number): Promise<void> {
        this.leads = this.leads.filter((lead) => lead.id !== id)
    }

    async nextLeadId(): Promise<number> {
        return this.leads.reduce((max, lead) => Math.max(max, lead.id), 0) + 1
    }

    // --- Testimonials ---
    async listTestimonials(): Promise<Testimonial[]> {
        return this.testimonials
    }

    async getTestimonial(id: number): Promise<Testimonial | undefined> {
        return this.testimonials.find((testimonial) => testimonial.id === id)
    }

    async putTestimonial(testimonial: Testimonial): Promise<void> {
        const index = this.testimonials.findIndex(
            (item) => item.id === testimonial.id
        )
        if (index >= 0) {
            this.testimonials[index] = testimonial
        } else {
            this.testimonials.push(testimonial)
        }
    }

    async deleteTestimonial(id: number): Promise<void> {
        this.testimonials = this.testimonials.filter(
            (testimonial) => testimonial.id !== id
        )
    }

    async nextTestimonialId(): Promise<number> {
        return (
            this.testimonials.reduce((max, t) => Math.max(max, t.id), 0) + 1
        )
    }

    // --- Contact ---
    async getContact(): Promise<Contact> {
        return this.contact
    }

    async putContact(contact: Contact): Promise<void> {
        this.contact = contact
    }
}

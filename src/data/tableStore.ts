import { odata, RestError, TableClient } from '@azure/data-tables'
import { DefaultAzureCredential } from '@azure/identity'
import { Student } from '../models/student'
import { ScheduledSession } from '../models/session'
import { PaymentSettlement } from '../models/payment'
import { Testimonial } from '../models/testimonial'
import { Lead } from '../models/lead'
import { PageVisit } from '../models/pageVisit'
import { SiteContent } from '../models/siteContent'
import { Contact } from '../models/contact'
import { DataStore } from './dataStore'

/**
 * Azure Table Storage adapter (REQ-009).
 *
 * Four tables, one logical partition each — at this volume partitioning for
 * throughput would be cargo cult, so the keys are chosen so every write-path
 * lookup is a point read (plan §4). Arrays have no Table type, so `subjects`
 * and `progressBySubject` travel as JSON strings. Numeric ids stay the API
 * contract; a `counters` table hands them out under an ETag guard (§5).
 *
 * Auth: `DefaultAzureCredential` — the Function App's managed identity in
 * Azure, your `az login` locally. Azurite speaks no AAD over plain HTTP, so a
 * `127.0.0.1` endpoint falls back to the well-known emulator key (a public
 * constant, not a secret).
 */

const STUDENT_PK = 'student'
const SESSION_PK = 'session'
const SETTLEMENT_PK = 'settlement'
const TESTIMONIAL_PK = 'testimonial'
const LEAD_PK = 'lead'
const SITECONTENT_PK = 'sitecontent'
const SITECONTENT_ROW = 'sitecontent'
const CONTACT_PK = 'contact'
const COUNTER_PK = 'counter'
// The contact record is a singleton — one fixed key, always overwritten.
const CONTACT_ROW = 'contact'
const STUDENT_WIDTH = 6
const SESSION_WIDTH = 8
const TESTIMONIAL_WIDTH = 6
const LEAD_WIDTH = 6

/** The well-known Azurite emulator account key — a documented public constant. */
const AZURITE_KEY =
    'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='

const isEmulator = (url: string): boolean =>
    url.includes('127.0.0.1') || url.includes('localhost')

/**
 * A TableClient for one table, authenticated the way the environment allows:
 * the managed identity in Azure, the well-known key against a local Azurite.
 * Exported so the one-off seeder (tools/seed.ts) reuses the exact same auth.
 */
export const tableClientFor = (tableName: string): TableClient => {
    const url = process.env.DATA_TABLES_URL
    if (!url) {
        throw new Error('DATA_TABLES_URL is required when DATA_STORE=tables.')
    }
    if (isEmulator(url)) {
        const connectionString =
            `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;` +
            `AccountKey=${AZURITE_KEY};TableEndpoint=${url}/devstoreaccount1;`
        return TableClient.fromConnectionString(connectionString, tableName, {
            allowInsecureConnection: true,
        })
    }
    return new TableClient(url, tableName, new DefaultAzureCredential())
}

/** The four tables the store uses. Exported for provisioning and seeding. */
export const TABLE_NAMES = [
    'students',
    'sessions',
    'settlements',
    'testimonials',
    'leads',
    'sitecontent',
    'contact',
    'counters',
    'pageviews',
] as const

const pad = (id: number, width: number): string =>
    String(id).padStart(width, '0')

const notFound = (error: unknown): boolean =>
    error instanceof RestError && error.statusCode === 404

const collect = async <T>(iter: AsyncIterable<T>): Promise<T[]> => {
    const out: T[] = []
    for await (const item of iter) {
        out.push(item)
    }
    return out
}

/**
 * Creates a table on first use, memoised per client. A table added to the code
 * after an environment was first provisioned (e.g. `testimonials`, REQ-027)
 * would otherwise 500 every request against it; this self-heals instead. 409
 * means it already exists; a transient failure is not cached, so it retries.
 */
const ensured = new WeakMap<TableClient, Promise<void>>()
const ensureTable = (client: TableClient): Promise<void> => {
    let ready = ensured.get(client)
    if (!ready) {
        ready = client
            .createTable()
            .then(() => undefined)
            .catch((error) => {
                if (error instanceof RestError && error.statusCode === 409) {
                    return
                }
                ensured.delete(client)
                throw error
            })
        ensured.set(client, ready)
    }
    return ready
}

// --- Entity <-> model mapping -------------------------------------------------

type Row = { partitionKey: string; rowKey: string } & Record<string, unknown>

const toStudentRow = (s: Student): Row => ({
    partitionKey: STUDENT_PK,
    rowKey: pad(s.id, STUDENT_WIDTH),
    id: s.id,
    studentId: s.studentId,
    firstName: s.firstName,
    lastName: s.lastName,
    dob: s.dob,
    subjectsJson: JSON.stringify(s.subjects),
    school: s.school,
    year: s.year,
    progress: s.progress,
    ...(s.progressBySubject
        ? { progressBySubjectJson: JSON.stringify(s.progressBySubject) }
        : {}),
    mode: s.mode,
    fees: s.fees,
    // Billing basis; written only when set (absent means per-session).
    ...(s.feeType ? { feeType: s.feeType } : {}),
    notes: s.notes,
    // Tables has no array column, so the notes log rides in a JSON string like
    // subjects — written only when the student has any.
    ...(s.datedNotes && s.datedNotes.length
        ? { datedNotesJson: JSON.stringify(s.datedNotes) }
        : {}),
    parentName: s.parentName,
    contactNumber: s.contactNumber,
    address: s.address,
    // Archive fields (REQ-013). Written only when set; putStudent replaces the
    // whole entity, so restoring (isArchived false) simply drops isArchived.
    ...(s.isArchived ? { isArchived: true } : {}),
    ...(s.archivedOn ? { archivedOn: s.archivedOn } : {}),
    ...(s.archiveNotes ? { archiveNotes: s.archiveNotes } : {}),
})

const fromStudentRow = (e: Row): Student => ({
    id: e.id as number,
    studentId: e.studentId as string,
    firstName: e.firstName as string,
    lastName: e.lastName as string,
    dob: e.dob as string,
    subjects: JSON.parse((e.subjectsJson as string) ?? '[]'),
    school: e.school as string,
    year: e.year as string,
    progress: e.progress as number,
    ...(e.progressBySubjectJson
        ? {
              progressBySubject: JSON.parse(
                  e.progressBySubjectJson as string
              ),
          }
        : {}),
    mode: e.mode as Student['mode'],
    fees: e.fees as number,
    ...(e.feeType ? { feeType: e.feeType as Student['feeType'] } : {}),
    notes: e.notes as string,
    ...(e.datedNotesJson
        ? { datedNotes: JSON.parse(e.datedNotesJson as string) }
        : {}),
    parentName: e.parentName as string,
    contactNumber: e.contactNumber as string,
    address: e.address as string,
    ...(e.isArchived ? { isArchived: true } : {}),
    ...(e.archivedOn ? { archivedOn: e.archivedOn as string } : {}),
    ...(e.archiveNotes ? { archiveNotes: e.archiveNotes as string } : {}),
})

const toSessionRow = (s: ScheduledSession): Row => ({
    partitionKey: SESSION_PK,
    rowKey: pad(s.id, SESSION_WIDTH),
    id: s.id,
    studentId: s.studentId,
    studentName: s.studentName,
    year: s.year,
    subject: s.subject,
    date: s.date,
    time: s.time,
    durationMinutes: s.durationMinutes,
    ...(s.groupId ? { groupId: s.groupId } : {}),
    notes: s.notes,
    status: s.status,
})

const fromSessionRow = (e: Row): ScheduledSession => ({
    id: e.id as number,
    studentId: e.studentId as number,
    studentName: e.studentName as string,
    year: e.year as string,
    subject: e.subject as string,
    date: e.date as string,
    time: e.time as string,
    durationMinutes: e.durationMinutes as number,
    ...(e.groupId ? { groupId: e.groupId as string } : {}),
    notes: e.notes as string,
    status: e.status as ScheduledSession['status'],
})

const settlementRowKey = (studentId: number, month: string): string =>
    `${pad(studentId, STUDENT_WIDTH)}_${month}`

const toSettlementRow = (s: PaymentSettlement): Row => ({
    partitionKey: SETTLEMENT_PK,
    rowKey: settlementRowKey(s.studentId, s.month),
    studentId: s.studentId,
    month: s.month,
    amountPaid: s.amountPaid,
    notes: s.notes,
})

const fromSettlementRow = (e: Row): PaymentSettlement => ({
    studentId: e.studentId as number,
    month: e.month as string,
    amountPaid: e.amountPaid as number,
    notes: e.notes as string,
})

const toTestimonialRow = (t: Testimonial): Row => ({
    partitionKey: TESTIMONIAL_PK,
    rowKey: pad(t.id, TESTIMONIAL_WIDTH),
    id: t.id,
    authorName: t.authorName,
    role: t.role,
    // Optional attribution — written only when given, so a Replace upsert
    // drops it if the submitter left it blank.
    ...(t.subject ? { subject: t.subject } : {}),
    ...(t.year ? { year: t.year } : {}),
    rating: t.rating,
    quote: t.quote,
    status: t.status,
    ...(t.flagged ? { flagged: true } : {}),
    submittedOn: t.submittedOn,
    ...(t.moderatedOn ? { moderatedOn: t.moderatedOn } : {}),
})

const fromTestimonialRow = (e: Row): Testimonial => ({
    id: e.id as number,
    authorName: e.authorName as string,
    role: e.role as Testimonial['role'],
    ...(e.subject ? { subject: e.subject as string } : {}),
    ...(e.year ? { year: e.year as string } : {}),
    rating: e.rating as number,
    quote: e.quote as string,
    status: e.status as Testimonial['status'],
    ...(e.flagged ? { flagged: true } : {}),
    submittedOn: e.submittedOn as string,
    ...(e.moderatedOn ? { moderatedOn: e.moderatedOn as string } : {}),
})

const toLeadRow = (l: Lead): Row => ({
    partitionKey: LEAD_PK,
    rowKey: pad(l.id, LEAD_WIDTH),
    id: l.id,
    parentName: l.parentName,
    // At least one contact field is always present (validated on create);
    // written only when given so a Replace upsert drops a blank one.
    ...(l.email ? { email: l.email } : {}),
    ...(l.phone ? { phone: l.phone } : {}),
    year: l.year,
    subjectsJson: JSON.stringify(l.subjects),
    goal: l.goal,
    mode: l.mode,
    status: l.status,
    submittedOn: l.submittedOn,
})

const fromLeadRow = (e: Row): Lead => ({
    id: e.id as number,
    parentName: e.parentName as string,
    ...(e.email ? { email: e.email as string } : {}),
    ...(e.phone ? { phone: e.phone as string } : {}),
    year: e.year as string,
    subjects: JSON.parse((e.subjectsJson as string) ?? '[]'),
    goal: e.goal as string,
    mode: e.mode as Lead['mode'],
    status: e.status as Lead['status'],
    submittedOn: e.submittedOn as string,
})

const toContactRow = (c: Contact): Row => ({
    partitionKey: CONTACT_PK,
    rowKey: CONTACT_ROW,
    // Only write a field that's set — a Replace upsert then drops a removed one,
    // so an absent column reads back as "not offered".
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    // Nested per-channel notes ride as JSON, like subjects on a student.
    ...(c.availability
        ? { availabilityJson: JSON.stringify(c.availability) }
        : {}),
    ...(c.preferred ? { preferred: c.preferred } : {}),
})

const fromContactRow = (e: Row): Contact => ({
    ...(e.email ? { email: e.email as string } : {}),
    ...(e.phone ? { phone: e.phone as string } : {}),
    ...(e.availabilityJson
        ? { availability: JSON.parse(e.availabilityJson as string) }
        : {}),
    ...(e.preferred ? { preferred: e.preferred as Contact['preferred'] } : {}),
})

// --- The adapter --------------------------------------------------------------

export class TableStore implements DataStore {
    private pageVisits = tableClientFor('pageviews')
    private students = tableClientFor('students')
    private sessions = tableClientFor('sessions')
    private settlements = tableClientFor('settlements')
    private testimonials = tableClientFor('testimonials')
    private leads = tableClientFor('leads')
    private siteContent = tableClientFor('sitecontent')
    private contact = tableClientFor('contact')
    private counters = tableClientFor('counters')

    // --- Students ---
    async listStudents(): Promise<Student[]> {
        const rows = await collect(
            this.students.listEntities<Row>({
                queryOptions: { filter: odata`PartitionKey eq ${STUDENT_PK}` },
            })
        )
        return rows.map(fromStudentRow).sort((a, b) => a.id - b.id)
    }

    async getStudent(id: number): Promise<Student | undefined> {
        try {
            const row = await this.students.getEntity<Row>(
                STUDENT_PK,
                pad(id, STUDENT_WIDTH)
            )
            return fromStudentRow(row)
        } catch (error) {
            if (notFound(error)) {
                return undefined
            }
            throw error
        }
    }

    async putStudent(student: Student): Promise<void> {
        await this.students.upsertEntity(toStudentRow(student), 'Replace')
    }

    async nextStudentId(): Promise<number> {
        const [id] = await this.reserveIds('student', 1)
        return id
    }

    async deleteStudentCascade(id: number): Promise<void> {
        await this.students
            .deleteEntity(STUDENT_PK, pad(id, STUDENT_WIDTH))
            .catch((error) => {
                if (!notFound(error)) throw error
            })

        const sessionRows = await collect(
            this.sessions.listEntities<Row>({
                queryOptions: {
                    filter: odata`PartitionKey eq ${SESSION_PK} and studentId eq ${id}`,
                },
            })
        )
        for (const row of sessionRows) {
            await this.sessions.deleteEntity(SESSION_PK, row.rowKey as string)
        }

        const settlementRows = await collect(
            this.settlements.listEntities<Row>({
                queryOptions: {
                    filter: odata`PartitionKey eq ${SETTLEMENT_PK} and studentId eq ${id}`,
                },
            })
        )
        for (const row of settlementRows) {
            await this.settlements.deleteEntity(
                SETTLEMENT_PK,
                row.rowKey as string
            )
        }
    }

    // --- Sessions ---
    async listSessions(): Promise<ScheduledSession[]> {
        const rows = await collect(
            this.sessions.listEntities<Row>({
                queryOptions: { filter: odata`PartitionKey eq ${SESSION_PK}` },
            })
        )
        return rows.map(fromSessionRow)
    }

    async getSession(id: number): Promise<ScheduledSession | undefined> {
        try {
            const row = await this.sessions.getEntity<Row>(
                SESSION_PK,
                pad(id, SESSION_WIDTH)
            )
            return fromSessionRow(row)
        } catch (error) {
            if (notFound(error)) {
                return undefined
            }
            throw error
        }
    }

    async listSessionsByGroup(groupId: string): Promise<ScheduledSession[]> {
        const rows = await collect(
            this.sessions.listEntities<Row>({
                queryOptions: {
                    filter: odata`PartitionKey eq ${SESSION_PK} and groupId eq ${groupId}`,
                },
            })
        )
        return rows.map(fromSessionRow)
    }

    async putSession(session: ScheduledSession): Promise<void> {
        await this.sessions.upsertEntity(toSessionRow(session), 'Replace')
    }

    async deleteSession(id: number): Promise<void> {
        await this.sessions
            .deleteEntity(SESSION_PK, pad(id, SESSION_WIDTH))
            .catch((error) => {
                // Already gone is fine — deleting a class is idempotent.
                if (!notFound(error)) throw error
            })
    }

    async nextSessionIds(count: number): Promise<number[]> {
        return this.reserveIds('session', count)
    }

    // --- Settlements ---
    async listSettlements(): Promise<PaymentSettlement[]> {
        const rows = await collect(
            this.settlements.listEntities<Row>({
                queryOptions: {
                    filter: odata`PartitionKey eq ${SETTLEMENT_PK}`,
                },
            })
        )
        return rows.map(fromSettlementRow)
    }

    async getSettlement(
        studentId: number,
        month: string
    ): Promise<PaymentSettlement | undefined> {
        try {
            const row = await this.settlements.getEntity<Row>(
                SETTLEMENT_PK,
                settlementRowKey(studentId, month)
            )
            return fromSettlementRow(row)
        } catch (error) {
            if (notFound(error)) {
                return undefined
            }
            throw error
        }
    }

    async putSettlement(settlement: PaymentSettlement): Promise<void> {
        await this.settlements.upsertEntity(
            toSettlementRow(settlement),
            'Replace'
        )
    }

    // --- Testimonials ---
    // Each entry point ensures the table exists first — it was added to the
    // store after some environments were provisioned (REQ-027).
    // --- Site content (REQ-008) --- One row, the whole document as JSON:
    // published atomically, read whole — no per-field columns to drift.
    async getSiteContent(): Promise<SiteContent | undefined> {
        await ensureTable(this.siteContent)
        try {
            const row = await this.siteContent.getEntity<Row>(
                SITECONTENT_PK,
                SITECONTENT_ROW
            )
            return JSON.parse(row.contentJson as string)
        } catch (error) {
            // Never published yet — the service serves the bundled defaults.
            if (notFound(error)) {
                return undefined
            }
            throw error
        }
    }

    async putSiteContent(content: SiteContent): Promise<void> {
        await ensureTable(this.siteContent)
        await this.siteContent.upsertEntity(
            {
                partitionKey: SITECONTENT_PK,
                rowKey: SITECONTENT_ROW,
                contentJson: JSON.stringify(content),
            },
            'Replace'
        )
    }

    // --- Leads --- (create-on-first-use, like testimonials: the table may
    // not exist yet in an environment provisioned before REQ-018.)
    // --- Page visits (REQ-058) ---
    // Partitioned by date, so a day's roll-up reads one partition and a
    // purge deletes whole days. The row key carries the visit and page, so
    // the same tab counting the same page twice overwrites rather than
    // inflating - "reached this page" is the question, not "how often".
    async putPageVisit(visit: PageVisit): Promise<void> {
        await ensureTable(this.pageVisits)
        await this.pageVisits.upsertEntity(
            {
                partitionKey: visit.date,
                rowKey: `${visit.visitId}_${visit.page}`,
                visitId: visit.visitId,
                page: visit.page,
                at: visit.at,
            },
            'Replace'
        )
    }

    async listPageVisits(fromDate: string): Promise<PageVisit[]> {
        await ensureTable(this.pageVisits)
        const rows = await collect(
            this.pageVisits.listEntities<Row>({
                queryOptions: { filter: odata`PartitionKey ge ${fromDate}` },
            })
        )
        return rows.map((e) => ({
            date: e.partitionKey,
            visitId: e.visitId as string,
            page: e.page as PageVisit['page'],
            at: e.at as string,
        }))
    }

    async listLeads(): Promise<Lead[]> {
        await ensureTable(this.leads)
        const rows = await collect(
            this.leads.listEntities<Row>({
                queryOptions: { filter: odata`PartitionKey eq ${LEAD_PK}` },
            })
        )
        return rows.map(fromLeadRow)
    }

    async getLead(id: number): Promise<Lead | undefined> {
        await ensureTable(this.leads)
        try {
            const row = await this.leads.getEntity<Row>(
                LEAD_PK,
                pad(id, LEAD_WIDTH)
            )
            return fromLeadRow(row)
        } catch (error) {
            if (notFound(error)) {
                return undefined
            }
            throw error
        }
    }

    async putLead(lead: Lead): Promise<void> {
        await ensureTable(this.leads)
        await this.leads.upsertEntity(toLeadRow(lead), 'Replace')
    }

    async deleteLead(id: number): Promise<void> {
        await ensureTable(this.leads)
        await this.leads
            .deleteEntity(LEAD_PK, pad(id, LEAD_WIDTH))
            .catch((error) => {
                // Already gone is fine — deleting an enquiry is idempotent.
                if (!notFound(error)) throw error
            })
    }

    async nextLeadId(): Promise<number> {
        const [id] = await this.reserveIds('lead', 1)
        return id
    }

    async listTestimonials(): Promise<Testimonial[]> {
        await ensureTable(this.testimonials)
        const rows = await collect(
            this.testimonials.listEntities<Row>({
                queryOptions: {
                    filter: odata`PartitionKey eq ${TESTIMONIAL_PK}`,
                },
            })
        )
        return rows.map(fromTestimonialRow)
    }

    async getTestimonial(id: number): Promise<Testimonial | undefined> {
        await ensureTable(this.testimonials)
        try {
            const row = await this.testimonials.getEntity<Row>(
                TESTIMONIAL_PK,
                pad(id, TESTIMONIAL_WIDTH)
            )
            return fromTestimonialRow(row)
        } catch (error) {
            if (notFound(error)) {
                return undefined
            }
            throw error
        }
    }

    async putTestimonial(testimonial: Testimonial): Promise<void> {
        await ensureTable(this.testimonials)
        await this.testimonials.upsertEntity(
            toTestimonialRow(testimonial),
            'Replace'
        )
    }

    async deleteTestimonial(id: number): Promise<void> {
        await ensureTable(this.testimonials)
        await this.testimonials
            .deleteEntity(TESTIMONIAL_PK, pad(id, TESTIMONIAL_WIDTH))
            .catch((error) => {
                // Already gone is fine — deleting a review is idempotent.
                if (!notFound(error)) throw error
            })
    }

    async nextTestimonialId(): Promise<number> {
        const [id] = await this.reserveIds('testimonial', 1)
        return id
    }

    // --- Contact ---
    // A singleton row; like testimonials it ensures its table first, since it
    // was added to the store after some environments were provisioned.
    async getContact(): Promise<Contact> {
        await ensureTable(this.contact)
        try {
            const row = await this.contact.getEntity<Row>(
                CONTACT_PK,
                CONTACT_ROW
            )
            return fromContactRow(row)
        } catch (error) {
            // Never set yet — an empty record, not an error.
            if (notFound(error)) {
                return {}
            }
            throw error
        }
    }

    async putContact(contact: Contact): Promise<void> {
        await ensureTable(this.contact)
        await this.contact.upsertEntity(toContactRow(contact), 'Replace')
    }

    /**
     * Reserves a contiguous block of `count` ids for a sequence, guarded by
     * the counter row's ETag: read, write value+count with If-Match, retry on
     * a 412 conflict. A missing counter (empty prod) starts the sequence at 1.
     * This is the only place two workers could genuinely race, so it is the
     * only place that pays for concurrency control.
     */
    private async reserveIds(
        name: 'student' | 'session' | 'testimonial' | 'lead',
        count: number
    ): Promise<number[]> {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
                const row = await this.counters.getEntity<Row>(
                    COUNTER_PK,
                    name
                )
                const base = (row.value as number) + 1
                await this.counters.updateEntity(
                    {
                        partitionKey: COUNTER_PK,
                        rowKey: name,
                        value: base + count - 1,
                    },
                    'Replace',
                    { etag: row.etag }
                )
                return range(base, count)
            } catch (error) {
                if (notFound(error)) {
                    // No counter yet — try to create it, starting at 1.
                    try {
                        await this.counters.createEntity({
                            partitionKey: COUNTER_PK,
                            rowKey: name,
                            value: count,
                        })
                        return range(1, count)
                    } catch (createError) {
                        if (
                            createError instanceof RestError &&
                            createError.statusCode === 409
                        ) {
                            continue // someone else created it — retry as update
                        }
                        throw createError
                    }
                }
                if (error instanceof RestError && error.statusCode === 412) {
                    continue // ETag conflict — another worker won; retry
                }
                throw error
            }
        }
        throw new Error(
            `Could not reserve ${count} ${name} id(s) after 8 attempts.`
        )
    }
}

const range = (base: number, count: number): number[] =>
    Array.from({ length: count }, (_, index) => base + index)

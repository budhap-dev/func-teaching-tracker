# REQ-009 — Replace the in-memory store with a real database (plan)

Working plan for REQ-009 (frontend repo, `docs/STORIES.md`). Written 2026-07-17,
against the two-environment world (dev / prod). Companion to
[DEPLOYMENT.md](DEPLOYMENT.md); the auth groundwork this rides on is the frontend
repo's `docs/PLAN-req-004-entra-signin.md`.

**The short version:** put students, sessions and settlements in **Azure Table
Storage**, in a small dedicated storage account per environment, accessed with the
Function App's existing managed identity. Total added cost ≈ **£0.02/month for
both environments**. Payments stay derived. Ids stay numeric. The in-memory store
survives as the test/local adapter. **And because this is durable personal data
about children, GDPR is a design input, not a footnote** — section 10: move the
stack to a UK region *before* data becomes real, add an erasure path, keep the
data plane keyless and AAD-only.

## 0. Progress tracker

**Decisions — all approved by the owner, 2026-07-17:**

- [x] **Prod starts empty** — the teacher enters the real roster; no synthetic
      children in the durable store. Dev keeps the synthetic seed.
- [x] **UK South move confirmed as phase 0** — while every byte is synthetic.
- [x] **Retention: 12 months after a student leaves**, exported accounts under
      the owner's custody cover HMRC.
- [x] **Backup: monthly JSON dump** of the four tables, owner's custody, same
      retention rules as the live data.

**Phases** _(ticked as each lands; details in §6)_:

- [x] Phase 0 — **dev** stack to UK South (SWA stayed in eastus2 — no UK
      region, holds no personal data; new dev SWA hostname
      `kind-sea-093f96a0f`; 401 gate re-verified) — done 2026-07-19
- [ ] Phase 0 — prod stack to UK South (LATER, with the prod move)
- [x] Phase 1 — dataStore seam; memory adapter behind `DATA_STORE` flag;
      services/handlers async; no behaviour change (HTTP e2e identical)
- [x] Phase 2 — tableStore adapter + `DELETE /students/{id}` erasure cascade
      (validated on Azurite)
- [x] Phase 3 — Terraform data accounts (UK South dev / eastus prod, LRS,
      prevent_destroy) + RBAC. **Deviation:** shared-key access stays
      *enabled* — the azurerm provider reads account service properties over
      the data plane with key auth every plan, so strict keyless needs a
      provider-wide `storage_use_azuread` switch (deferred hardening). The app
      + seeder use managed identity regardless; the key is reachable only by
      an owner/deployer, not the CI identities.
- [x] Phase 4 — one-off seeder (`npm run seed`, `--empty` for prod, re-seed
      guard) + counters; **dev tables seeded** (5 students, 365 sessions)
- [x] Phase 5 — **dev flipped to `DATA_STORE=tables`**; acceptance PROVEN:
      a student+session+payment written in one process survived a fresh
      process (= restart) reading the real UK South tables, then erased
      cleanly. Deployed app cold-starts healthy on tables (401 gate live).
      Terraform in sync (`AUTH_ENFORCED`/`DATA_STORE` now TF-managed).
- [x] Phase 6 — prod flipped (empty, UK South); monthly dump script in place
      (`npm run dump` → src/tools/dump.ts); story ticked 2026-07-24

## 1. What we're replacing

Today the entire dataset lives in one module-level object:
[`src/data/store.ts`](../src/data/store.ts) — three arrays (`students`,
`sessions`, `settlements`) built from
[`src/data/seed.ts`](../src/data/seed.ts) at module load, with `nextStudentId()` /
`nextSessionId()` handing out max+1 numeric ids.

Failure modes, all real on Flex Consumption:

- **Restart / redeploy loses everything the teacher entered.** The seed is
  rebuilt on every cold start; `settlements` starts empty — recorded payments
  simply vanish.
- **Scale-out forks reality.** Each worker instance seeds its own copy. A student
  created on instance A doesn't exist on instance B; two instances can hand out
  the same "next" id.
- **Prod data is permanently synthetic.** Real records can't accumulate because
  nothing accumulates.

This was a deliberate placeholder — the store module says "swap this module for a
real repository" — and it's now the gate for REQ-008 (published site content
would silently revert on every restart).

## 2. REQ-009 acceptance criteria

Quoted from the frontend repo's `docs/STORIES.md`:

> - [ ] Students, payments and sessions are stored in Cosmos DB (or Table Storage)
>       instead of memory.
> - [ ] Data survives a restart, a redeploy, and scale-out.
> - [ ] Each environment has its own isolated database/container (dev/prod).
> - [ ] Writes actually persist: upsert student, save payments, create session.
> - [ ] Seeding becomes a deliberate one-off step, not a value rebuilt on every
>       module load — and per-env volumes stay distinct (5 / 10 / 15).
> - [ ] Terraform provisions the account per environment.
> - [ ] The connection is secured with a managed identity or Key Vault — **not** a
>       connection string sitting in app settings.
> - [ ] Services and functions keep their current shape; only the data layer changes.

(The "5 / 10 / 15" predates the current two-env world — `envSeeds` today defines
dev = 5 and prod = 15. "Distinct volumes per env" is the intent we design to.)

## 3. Options

Scale assumptions: single-digit-to-15 students, ~900 session rows/year, one
writer, a few thousand API calls a month. Prices are East US (where both envs
run **today** — section 10 argues for UK South, which is within pennies of these
numbers at this scale), converted at ≈ £0.80/$.

| | Cosmos DB (NoSQL) | **Table Storage** | Azure SQL serverless |
| --- | --- | --- | --- |
| Realistic cost, both envs | Free tier is **one account per subscription** — one env free, the other serverless at ~£0.10–£0.40/mo. Both-serverless: ~£0.20–£0.60/mo. | **~£0.01–£0.05/mo total.** No fixed fee, no free-tier dependency, both envs identical. | Free offer is **one database per subscription** (100k vCore-s + 32 GB). Second env ~£3–£5/mo even with auto-pause, plus ~1 min resume latency after idle. |
| Managed identity | Yes — Cosmos data-plane RBAC (`azurerm_cosmosdb_sql_role_assignment`, its own role system). | Yes — standard `azurerm_role_assignment`, role **Storage Table Data Contributor**. Account can disable shared keys entirely. | Yes, but ceremony: Entra admin on the server + `CREATE USER … FROM EXTERNAL PROVIDER` bootstrap SQL. |
| Local / test story | Emulator is Windows-first; the Linux/ARM (Apple Silicon) emulator is preview. | **Azurite** (npm, cross-platform, GA table support) — and the in-memory adapter covers tests anyway. | SQL Server in Docker; heaviest to run, ARM support patchy. |
| Migration effort | Medium — documents map 1:1 to models, but new SDK, per-container partition keys, indexing policy, own RBAC model. | **Small** — one adapter, flatten `subjects` to JSON, key scheme below. | Large — schema, migrations tooling, SQL client, relational remodel of what is currently three lists. |

**Recommendation: Azure Table Storage.** Every access pattern in the services is
a point lookup or a scan of a few hundred rows the code already post-processes in
memory, so Cosmos's query power and SQL's relational model buy nothing here — and
both hit the "only one free per subscription" wall this project has already run
into twice. Tables cost pennies for *both* envs with no fine print, use the
standard RBAC + managed-identity pattern REQ-004 already established, and the
adapter seam means a later swap to Cosmos serverless (if querying ever grows) is
one file, not a rewrite.

## 4. Data design

One **dedicated storage account per environment** (`stteachtrackerdata<env>…`),
not the existing app storage account: that account is Flex deploy plumbing,
key-authenticated, and lives or dies with the compute stack. The data account is
AAD-only (`shared_access_key_enabled = false`), `prevent_destroy`, and outlives
redeploys and re-provisions — which is the entire point of this story. Four
tables: `students`, `sessions`, `settlements`, `counters`.

### Keys, justified by the access patterns in `src/services/`

One logical partition per entity type. At this volume (≤ a few thousand rows,
well under any partition limit) partitioning for throughput would be cargo cult;
instead the keys are chosen so every lookup a *write path* needs is a point read:

| Table | PartitionKey | RowKey | Access patterns served |
| --- | --- | --- | --- |
| `students` | `"student"` | id, zero-padded (`"0007"`) | `getStudentById` → point read. `listStudents` → partition scan (≤ 15 rows). |
| `sessions` | `"session"` | id, zero-padded (`"00900511"`) | `getSessionById` (PUT /sessions/{id}) → point read. `listSessions(studentId?)` → partition scan + filter, sorted in code as today. Group fan-out (`applyToGroup`) → scan filtered on `groupId`. Billing (`sessionsHeldIn`) → scan filtered on student + month prefix. |
| `settlements` | `"settlement"` | `"<paddedStudentId>_<month>"` (`"0007_2026-03"`) | `findSettlement(studentId, month)` → point read. `listPayments` totals → partition scan. |
| `counters` | `"counter"` | `"student"` \| `"session"` | Id allocation (section 5). |

A full `sessions` scan (~900 rows/year) is one storage transaction per 1,000
entities — single-digit milliseconds, thousandths of a penny. If the roster ever
grew 100×, repartitioning sessions by `studentId` is an adapter-internal change.

### Entity shapes

Entities mirror the existing models; the only translation is `subjects` (Tables
have no array type) and the key columns:

```ts
/** Row in `students`. Everything except subjects maps 1:1 to Student. */
interface StudentEntity {
    partitionKey: 'student'
    rowKey: string            // padded id
    id: number
    studentId: string         // human-facing code, e.g. STU-4F9K2Q
    firstName: string
    lastName: string
    dob: string
    subjectsJson: string      // JSON.stringify(Student.subjects)
    school: string
    year: string
    progress: number
    mode: StudentMode
    fees: number
    notes: string
    parentName: string
    contactNumber: string
    address: string
}

/** Row in `sessions`. Maps 1:1 to ScheduledSession. */
interface SessionEntity {
    partitionKey: 'session'
    rowKey: string            // padded id
    id: number
    studentId: number
    studentName: string
    year: string
    subject: string
    date: string              // YYYY-MM-DD
    time: string              // HH:MM
    durationMinutes: number
    groupId?: string          // omitted on solo classes, exactly as the model
    notes: string
    status: SessionStatus
}

/** Row in `settlements`. Maps 1:1 to PaymentSettlement. */
interface SettlementEntity {
    partitionKey: 'settlement'
    rowKey: string            // `${paddedStudentId}_${month}`
    studentId: number
    month: string             // YYYY-MM
    amountPaid: number
    notes: string
}
```

### Indexing

Tables index PartitionKey + RowKey and nothing else — there is no policy to
write, tune or pay for. Every non-key filter (`groupId`, month prefix, `status`)
is a scan of one small partition, which is exactly what the in-memory code does
today with `Array.filter`. (Had we picked Cosmos, this section would be an
indexing-policy JSON; with Tables it is this paragraph.)

### Derived payments stay derived

`PaymentRecord` (`amountDue`, `sessionsHeld`, `outstanding`, `status`) is **not
stored**. It stays computed per request from fees × sessions held, as REQ-001
built it: change the timetable and the bill follows, with no stored figure to
drift. Storing it would mean recomputing on every session create / edit /
cancel / group fan-out — write amplification and a drift risk, to save a scan
that costs thousandths of a penny. The only stored payment fact remains the
settlement (what the teacher actually recorded), now in the `settlements` table.
`PaymentRecord.id` (`studentId * 100 + monthIndex`) stays synthetic and derived.

## 5. Ids and concurrency

Ids stay **numeric** — `Student.id` and session ids are the API contract with the
frontend (`/students/{id}`, `/sessions/{id}`), and REQ-009 promises the shapes
don't change. What goes: max+1 over an in-memory array.

- **A `counters` table row per sequence** (`student`, `session`), incremented
  with an ETag-conditional update: read value, write value+n with `If-Match`,
  retry on 412. A group booking reserves its whole contiguous block (`n =
  studentIds.length`) in one increment, preserving today's `grp-<firstId>`
  naming. The one-off seeder initialises each counter to max seeded id + 1.
- **Creates use `createEntity`** (insert, not upsert), so even a duplicate id from
  a bug turns into a 409 and a retried allocation — never a silently overwritten
  student.
- **Record updates stay last-write-wins** (merge). There is one writer — the
  teacher — so ETag plumbing on every PUT is ceremony without a scenario; the
  counter is the only spot where two instances could genuinely corrupt state.
- `generateStudentCode()` stays as-is: it's a human-facing label, not a key, and
  its `Date.now()`-based suffix is unique enough for one teacher.

## 6. Migration plan

Ordered phases; each deploys green before the next starts. The rollout flag is a
new `DATA_STORE` app setting (`memory` | `tables`) — same zero-breakage pattern
as REQ-004's `AUTH_ENFORCED`.

0. **Move house to UK South first (section 10).** While every byte is synthetic
   seed, changing region is a Terraform variable + `destroy`/`apply` + redeploy —
   not a data migration. Once the tables hold real records, this stops being
   free. Re-point what the recreate breaks: Key Vault allow-list entries, GitHub
   environment URLs/secrets, Entra redirect URIs for the new SWA hostnames.
1. **Carve the seam (no behaviour change).** New `src/data/dataStore.ts`: an
   async repository interface with the operations the services actually use
   (list/get/save per type, `getSettlement(studentId, month)`,
   `listSessionsByGroup(groupId)`, `nextStudentId()`, `nextSessionIds(n)`).
   Today's store becomes `src/data/memoryStore.ts` implementing it (still
   self-seeding); `src/data/store.ts` becomes the factory that picks an adapter
   from `DATA_STORE`. Services in `src/services/*.ts` go async and the handlers
   in `src/functions/*.ts` await them — mechanical, since every handler is
   already `async`. This is the one honest deviation from "services keep their
   current shape": sync signatures become Promises. Deploy; everything still
   runs in memory.
2. **Table adapter.** `src/data/tableStore.ts` using `@azure/data-tables` +
   `DefaultAzureCredential` (the dependency and identity pattern
   `src/shared/auth.ts` already uses for Key Vault). Entity mapping from
   section 4, counter allocation from section 5 — and the **erasure path**
   (section 10): `DELETE /students/{id}` cascading to that student's sessions
   and settlements, implemented in both adapters so memory-mode behaves
   identically.
3. **Terraform** (section 8): data account, tables, RBAC, app settings, with
   `DATA_STORE = "memory"` so applying is inert.
4. **One-off seeding.** `npm run seed -- --env dev` (`scripts/seed.ts`): reuses
   `buildSeedForEnv()` from `src/data/seed.ts` — the dataset definition keeps
   living there — and writes through the table adapter, then sets the counters.
   Runs from the bootstrap machine under `az login` (DefaultAzureCredential picks
   up the CLI credential; the deployer gets the same RBAC role as the app).
   Refuses to touch non-empty tables without `--force`. This satisfies "a
   deliberate one-off step": the cloud path never auto-seeds again, while the
   memory adapter keeps self-seeding for local runs and tests.
5. **Flip dev.** `DATA_STORE = "tables"` on dev (a Terraform variable flip;
   in-place setting change). Soak: create a student, book a group class, record
   a payment, then **restart the Function App and check they're still there** —
   the acceptance test this story exists for. Rollback at any point = flip back;
   nothing in the tables is harmed.
6. **Flip prod** after seeding decision (open question 1), then update
   README/DEPLOYMENT and tick the story. The per-env seed data's fate: dev is
   re-seeded once with the same 5 synthetic students; the memory datasets remain
   the local/test fixture; prod's 15 synthetic students exist only until the
   flip, then never again.

## 7. Local dev and tests

- **`npm start` / `func start` unchanged.** With `DATA_STORE` unset the factory
  returns the memory adapter — same self-seeded behaviour as today, so the
  frontend's local verify shim against `:7071` keeps working untouched.
- **Tests never need a live DB.** The repo currently has no test suite (`npm
  test` is a stub); when tests land, services are tested against the memory
  adapter, and the two adapters share one contract-test file so `tableStore`
  is exercised against **Azurite** (`npx azurite`) only when it's running —
  skipped otherwise, never a CI requirement.
- **Azurite quirk:** it doesn't speak AAD tokens over plain HTTP, so when
  `DATA_TABLES_URL` points at `127.0.0.1` the factory uses the well-known
  `devstoreaccount1` emulator key (public constant, not a secret) instead of
  `DefaultAzureCredential`.
- **Real-dev-data option:** point `DATA_TABLES_URL` at the dev account and
  `az login` — DefaultAzureCredential makes local code hit real dev tables with
  your own identity, no keys anywhere.

## 8. Infra changes (Terraform)

New module `infra/terraform/modules/data_store`, instantiated per env from
`main.tf` like `teacher_auth`:

| Resource | Notes |
| --- | --- |
| `azurerm_storage_account` | `stteachtrackerdata<env><rand>` (24-char pattern as in `function_app`), **UK South** (section 10), LRS, TLS 1.2, `shared_access_key_enabled = false`, `lifecycle { prevent_destroy = true }` |
| `azurerm_storage_table` × 4 | `students`, `sessions`, `settlements`, `counters` |

At root (same cycle-avoidance placement as `func_reads_secrets`):

| Resource | Notes |
| --- | --- |
| `azurerm_role_assignment` | Function App principal → **Storage Table Data Contributor** on the data account |
| `azurerm_role_assignment` | `deployer_object_id` → same role (lets the bootstrap machine run `npm run seed`) |

App settings added via `extra_app_settings`:

| Setting | Value |
| --- | --- |
| `DATA_TABLES_URL` | `https://<data account>.table.core.windows.net` (module output) |
| `DATA_STORE` | per-env variable, `"memory"` until the phase-5/6 flips |

Code side: one new dependency, `@azure/data-tables` (`@azure/identity` is
already there from REQ-004). No workflow changes — the deploy artifact and OIDC
identities are untouched.

## 9. Costs

East US prices, ≈ £0.80/$; "both envs" = the realistic total.

| Item | Price | At this scale (both envs) |
| --- | --- | --- |
| Storage account (fixed) | none | £0.00 |
| Table storage, LRS | ~$0.045/GB·mo | data is < 10 MB → < £0.01 |
| Transactions | $0.00036 per 10k | a few tens of thousands/mo → < £0.01 (1M/mo would be ~£0.03) |
| Managed identity + RBAC | free | £0.00 |
| Azurite (local) | free | £0.00 |
| **Total** | | **≈ £0.02/month** |

Fine print, honestly stated:

- **No free tier is involved, so there's nothing to lose or share.** For
  contrast: Cosmos's free tier (1000 RU/s + 25 GB) is one account per
  subscription — it could host both envs free only by sharing one account, one
  blast radius and one region across dev and prod. The SQL free offer is likewise
  one database per subscription.
- **Tables have no point-in-time restore.** LRS gives 11-nines durability
  against hardware loss, not against a fat-fingered script (open question 3).
- Costs scale linearly and stay negligible up to ~100× this usage.

## 10. GDPR & data protection

This story is the moment the app starts holding **durable personal data about
children** — names, DOB, school, parent contact details, home address, progress
notes. That makes the teacher a **data controller** under UK GDPR / DPA 2018
(Microsoft is the processor, covered by its standard DPA), and children's data
gets explicit extra care (Recital 38). Design consequences, in order of
importance:

1. **Residency: run in the UK.** Both environments live in **East US** today
   (verified against the live resource groups), which makes every student record
   a restricted international transfer the moment data is real. The UK–US data
   bridge would make that *defensible*; being in **UK South** makes it a
   non-issue. `location` is already a Terraform variable, and there is exactly
   one free moment to use it — **before** the durable store exists, while
   destroy/recreate loses nothing (migration phase 0). The new data account is
   born in UK South either way. (Verify Flex Consumption availability in
   `uksouth` at implementation; SWA's `location` is metadata for a global CDN.)
2. **Erasure and rectification (Art. 16/17).** Rectification exists (`PUT
   /students/{id}`). Erasure does not — there are **no delete endpoints**, which
   was harmless when a restart wiped everything and stops being harmless now.
   In scope for this story (phase 2): `DELETE /students/{id}` cascading to the
   student's sessions and settlements. Table deletes are real deletes (no
   tombstones, no soft-delete tier for tables), so a cascade is a complete
   erasure. The frontend's delete button can follow as its own small story;
   `az` + the export script cover requests until then.
3. **Retention.** Personal records go when tutoring ends and nothing requires
   them: propose **delete within 12 months of a student leaving** (manual, at
   this roster size). HMRC's ~6-year business-records duty attaches to the
   teacher's *accounts*, not to a child's profile — the periodic export (open
   question 3) doubles as the accounting archive the teacher keeps under their
   own retention rules, letting the app itself erase fully.
4. **Security of processing (Art. 32) — already in the design, named here.**
   Encryption at rest (Azure SSE, default) and TLS ≥ 1.2 in transit; a keyless,
   AAD-only data plane (`shared_access_key_enabled = false`); exactly two RBAC
   principals (Function App + deployer, least-privilege Table Data Contributor);
   the API itself behind Entra sign-in + the Key Vault allow-list (REQ-004,
   enforced). Private endpoints/storage firewalls would add ~£5/month of
   ceremony against a data plane that already refuses anything but two AAD
   identities — noted, not proposed, revisit if scale changes.
5. **Minimisation and the notes fields.** The model already collects only what
   tutoring + billing need (that is the processing purpose; section 4's entity
   shapes double as the record of processing). One controller habit matters:
   free-text `notes` must not accumulate health/SEN or other special-category
   detail — if that's ever genuinely needed, it's a new design conversation,
   not a notes field.
6. **Subject access (Art. 15).** One student is three point-ish queries; the
   seeding machinery gains a sibling `npm run export -- --student <id>` that
   emits their rows as JSON. No ceremony beyond that at this scale.
7. **Exports and backups are personal data too.** The open-question-3 dump must
   live under the controller's custody (their machine/UK storage), inherit the
   same retention policy, and be deleted alongside an erased student.
8. **Breach duty (Art. 33/34)** sits with the controller (72h to the ICO where
   risky). The design's contribution is a small blast radius: per-env accounts,
   no shareable keys in existence, two named identities, allow-listed sign-in.

## 11. Open questions

1. **What does prod go live with — empty, or one last synthetic seed?**
   Recommendation: **prod starts empty** and the teacher enters the real
   roster; dev keeps the synthetic seed. GDPR strengthens this: synthetic
   children mixed into a real register pollute every export, SAR and
   retention sweep from day one (and even with the new DELETE endpoint,
   scrubbing 15 fake students by hand is pointless work).
2. **Dedicated data account (proposed) vs reusing the env's existing storage
   account?** Reuse saves one resource; the dedicated account decouples data
   from deploy plumbing, allows disabling shared keys, and can carry
   `prevent_destroy`. I'd spend the zero extra pounds.
3. **Is a periodic export enough backup?** A tiny scheduled/manual dump of four
   small tables would cover the accidental-overwrite case Tables' LRS doesn't.
   If real backup ever matters more, that — not query power — is the strongest
   future argument for Cosmos (continuous backup). Per section 10.7: the dump
   is personal data — controller's custody, same retention, deleted alongside
   an erased student.
4. **Confirm the UK South move (section 10.1) before phase 1.** It recreates
   both stacks: new SWA/Function hostnames mean re-entering the Key Vault
   allow-list, updating GitHub environment secrets/URLs, and re-registering
   Entra redirect URIs — an hour of churn now versus a real data migration
   later. Recommendation: yes, do it as phase 0.
5. **Retention window.** Section 10.3 proposes deleting a leaver's records
   within 12 months, with financial history surviving only in the teacher's
   own exported accounts. Is 12 months right, and does the teacher want a
   yearly reminder (a note in their calendar beats a cron job at this scale)?
6. **Billing horizon.** `billingYear` is pinned to the seed year (2026) in
   `store.ts` / `paymentService.ts`. Once data is durable and sessions roll into
   2027, should billable months derive from the sessions actually present? Small
   change, but a product decision — and a separate story.

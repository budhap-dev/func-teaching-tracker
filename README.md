# func-teaching-tracker

Azure Functions API (Node.js + TypeScript) backing the **Teaching Tracker** app.
Built on the [Azure Functions Node.js v4 programming model](https://learn.microsoft.com/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v4).

The `Student` and `PaymentRecord` shapes mirror the Teaching Tracker frontend so
this API can back it directly.

## Requirements

- Node.js **>= 24**
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`npm i -g azure-functions-core-tools@4`)

## Getting started

```bash
npm install
npm start          # cleans, builds, then runs `func start` on http://localhost:7071
```

For iterative development, run the compiler in watch mode alongside the host:

```bash
npm run watch      # terminal 1 — tsc -w
func start         # terminal 2
```

## Project structure

```
src/
├── functions/     # one file per HTTP endpoint (self-registers via app.http)
│   ├── getStudents.ts
│   ├── getStudent.ts
│   ├── upsertStudent.ts
│   ├── getPayments.ts
│   ├── getPaymentsByMonth.ts
│   ├── savePayments.ts
│   ├── getSessions.ts
│   └── createSession.ts
├── services/      # business logic (studentService, paymentService, sessionService)
├── data/          # in-memory store + per-environment seed (swap for a real DB)
├── models/        # Student / Payment / ScheduledSession types
└── shared/        # HTTP response helpers
```

The data layer is an **in-memory store** (`src/data/store.ts`) seeded per
environment. State is per-process and resets on restart or scale-out — replace
this module with a real repository (Cosmos DB, Azure SQL, Table Storage) without
changing the services or functions.

## API

Base URL when running locally: `http://localhost:7071/api`

| Method     | Route                | Description                                    |
| ---------- | -------------------- | ---------------------------------------------- |
| GET        | `/students`          | List all students                              |
| GET        | `/students/{id}`     | Get a single student by numeric id             |
| POST       | `/students`          | Create or update a student (id optional)       |
| PUT        | `/students/{id}`     | Update the student identified by the route id  |
| GET        | `/payments`          | List payments (`?studentId=&month=&status=`)   |
| GET        | `/payments/by-month` | Bills grouped by month, with totals            |
| POST       | `/payments`          | Record a payment (omit `amountPaid` to settle) |
| GET        | `/sessions`          | List classes (`?studentId=`)                   |
| POST       | `/sessions`          | Schedule a new class                           |
| PUT        | `/sessions/{id}`     | Cancel / un-cancel a class                     |

### Per-environment data

The dataset is selected by the `ENVIRONMENT` app setting (set per environment by
Terraform), so each environment serves distinct people and volumes:

| Env  | Students | Classes / year | Fee per session |
| ---- | -------- | -------------- | --------------- |
| dev  | 5        | ~261           | from £100       |
| test | 10       | ~522           | from £110       |
| prod | 15       | ~783           | from £120       |

Each student has a weekly class through the seed year (2026), on their own
weekday, and every Nth is seeded cancelled. Counts live in `src/data/seed.ts`
(`envSeeds`).

### How billing works

`Student.fees` is the price of **one session**. A month's bill is derived, never
stored:

```
amountDue = fees × classes that already took place that month
```

A class counts when it is **not cancelled** and its date is **not in the future**
(`wasHeld`). So a month **accrues** as lessons are taught, a future month owes
nothing, and cancelling a class that already happened reduces the bill by exactly
one fee. Change the timetable and the bill follows — there is no stored figure to
drift out of step.

Only what the teacher records is stored (`PaymentSettlement`: amount paid and
notes). `POST /payments` without an `amountPaid` settles the month in full — it
pays exactly what the classes come to, rather than a figure typed in hope.

> ⚠️ This makes `/payments` **time-dependent**: the same request returns more as
> the month goes on. `todayIso()` in `paymentService` is the single place the
> clock is read.

### Examples

```bash
# List students
curl http://localhost:7071/api/students

# Get one student
curl http://localhost:7071/api/students/1

# Create a student
curl -X POST http://localhost:7071/api/students \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Jane","lastName":"Doe","year":"10","mode":"Online"}'

# Update a student (upsert by id)
curl -X PUT http://localhost:7071/api/students/1 \
  -H 'Content-Type: application/json' \
  -d '{"progress":95,"notes":"Great progress"}'

# List payments for one student
curl "http://localhost:7071/api/payments?studentId=1&month=2026-01"

# Mark a month as paid (settles exactly what was taught)
curl -X POST http://localhost:7071/api/payments \
  -H 'Content-Type: application/json' \
  -d '[{"studentId":1,"month":"2026-01","notes":"Paid by transfer"}]'

# Record a partial payment
curl -X POST http://localhost:7071/api/payments \
  -H 'Content-Type: application/json' \
  -d '[{"studentId":1,"month":"2026-01","amountPaid":130}]'

# Cancel a class (it stops being billed)
curl -X PUT http://localhost:7071/api/sessions/1001 \
  -H 'Content-Type: application/json' \
  -d '{"status":"Cancelled"}'
```

## Hosted environments

| Env      | API base URL                                                | Function App                   | Resource group          |
| -------- | ----------------------------------------------------------- | ------------------------------ | ----------------------- |
| **dev**  | https://func-teachtracker-dev-pjlmrq.azurewebsites.net/api   | `func-teachtracker-dev-pjlmrq`  | `rg-teachtracker-dev`  |
| **test** | https://func-teachtracker-test-mtbace.azurewebsites.net/api  | `func-teachtracker-test-mtbace` | `rg-teachtracker-test` |
| **prod** | https://func-teachtracker-prod-gjvecw.azurewebsites.net/api  | `func-teachtracker-prod-gjvecw` | `rg-teachtracker-prod` |

Each is called by exactly one frontend (CORS is locked to the paired Static Web
App origin):

| Env  | Allowed frontend origin                                   |
| ---- | --------------------------------------------------------- |
| dev  | https://delightful-water-09b7c480f.7.azurestaticapps.net   |
| test | https://delightful-sea-0e15b030f.7.azurestaticapps.net     |
| prod | https://nice-sea-095463c0f.7.azurestaticapps.net           |

Quick check:

```bash
curl https://func-teachtracker-dev-pjlmrq.azurewebsites.net/api/students
```

## Deploy

A push to `main` builds once and promotes the same artifact **dev → test**
automatically. **Production is a separate, manually-triggered workflow** (there is
no approval button — GitHub required-reviewer rules need a public repo or paid
plan):

```bash
gh workflow run deploy-prod.yml --repo budhap-dev/func-teaching-tracker --ref main
```

Or: **Actions → "Deploy to Production (manual)" → Run workflow → `main`**.

> ⚠️ When shipping a breaking API change, deploy **this API before** the frontend.
> The frontend calls `/sessions` and `/payments/by-month`; if it ships first
> against an older API those 404 and its screens render empty.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the architecture, pipeline,
CORS, and the one-time bootstrap runbook.

Manual publish to a single Function App (Node 24 runtime), as a fallback:

```bash
npm run clean && npm run build
func azure functionapp publish <your-function-app-name>
```

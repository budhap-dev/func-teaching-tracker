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
| GET        | `/payments/by-month` | Payments grouped by month, with totals         |
| POST       | `/payments`          | Create/update one payment or an array of them  |
| GET        | `/sessions`          | List scheduled classes (`?studentId=`)         |
| POST       | `/sessions`          | Schedule a new class                           |

### Per-environment data

The dataset is selected by the `ENVIRONMENT` app setting (set per environment by
Terraform), so each environment serves distinct people and volumes:

| Env  | Students | Sessions | Payments | Base fee |
| ---- | -------- | -------- | -------- | -------- |
| dev  | 5        | 4        | 60       | £100     |
| test | 10       | 6        | 120      | £110     |
| prod | 15       | 8        | 180      | £120     |

Each student has an agreed monthly `fees` value, which drives their payment
records' `monthlyFee`. Counts live in `src/data/seed.ts` (`envSeeds`).

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

# Save payments (single or array; upsert by id or studentId+month)
curl -X POST http://localhost:7071/api/payments \
  -H 'Content-Type: application/json' \
  -d '[{"studentId":1,"month":"2026-01","monthlyFee":120,"amountPaid":120,"status":"Paid"}]'
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

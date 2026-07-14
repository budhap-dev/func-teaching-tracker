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
│   └── savePayments.ts
├── services/      # business logic (studentService, paymentService)
├── data/          # in-memory store + seed data (swap for a real DB)
├── models/        # Student / Payment types
└── shared/        # HTTP response helpers
```

The data layer is an **in-memory store** (`src/data/store.ts`) seeded with sample
students and payments. State is per-process and resets on restart — replace this
module with a real repository (Cosmos DB, Azure SQL, Table Storage) without
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
| POST       | `/payments`          | Create/update one payment or an array of them  |

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

## Deploy

Build and deploy to an Azure Function App (Node 24 runtime):

```bash
npm run clean && npm run build
func azure functionapp publish <your-function-app-name>
```

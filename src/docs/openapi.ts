/**
 * OpenAPI 3.0 description of the Teaching Tracker API.
 *
 * Kept as a typed module beside the handlers (not a separate swagger.json) so
 * it ships and versions with the code. Two anonymous endpoints expose it:
 * `GET /api/openapi.json` (this document) and `GET /api/docs` (a Scalar UI
 * rendered from it). The shapes below mirror `src/models/*` and the validation
 * rules in `src/services/*`; keep them in step when either changes.
 */

const bearer = [{ bearerAuth: [] as string[] }]

/** The spec object. Loosely typed on purpose — it is data, not code. */
export const openApiDocument = {
    openapi: '3.0.3',
    info: {
        title: 'Teaching Tracker API',
        version: '1.0.0',
        description: [
            'Azure Functions API for a private tutor: students, scheduled',
            'classes, and monthly payments.',
            '',
            '**Authentication.** Every endpoint below is a *teacher* endpoint,',
            'guarded by an Entra (Azure AD) v2.0 bearer access token carrying the',
            '`access_as_teacher` scope, whose account must be on the Key Vault',
            'allow-list. Enforcement is gated by the `AUTH_ENFORCED` app setting:',
            'while it is `false` the same checks run but the request is let',
            'through with the verdict logged, so the not-yet-authenticated',
            'frontend keeps working. The docs endpoints themselves are public.',
        ].join('\n'),
    },
    servers: [
        { url: 'http://localhost:7071/api', description: 'Local (func start)' },
        {
            url: 'https://{functionAppName}.azurewebsites.net/api',
            description: 'Azure',
            variables: {
                functionAppName: {
                    default: 'func-teaching-tracker',
                    description: 'Your Function App name',
                },
            },
        },
    ],
    tags: [
        { name: 'Students', description: 'Tutored students (REQ-009).' },
        { name: 'Sessions', description: 'Scheduled classes, solo or group.' },
        { name: 'Payments', description: 'Monthly bills and settlements.' },
        {
            name: 'Testimonials',
            description:
                'Family-submitted reviews (REQ-027). Submitting and reading approved reviews are public; the moderation queue and approve/reject/delete are teacher-only.',
        },
        {
            name: 'Contact',
            description:
                'Public contact details (REQ-006/008). Reading is public; the teacher updates them, and clearing a field removes that method.',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description:
                    'Entra v2.0 access token with the `access_as_teacher` scope.',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: { error: { type: 'string' } },
                required: ['error'],
                example: { error: 'firstName is required.' },
            },

            // ---- Students ----------------------------------------------
            Student: {
                type: 'object',
                description: 'A tutored student.',
                properties: {
                    id: { type: 'integer', example: 7 },
                    studentId: {
                        type: 'string',
                        description: 'Human-facing code, e.g. STU-4F9K2Q.',
                        example: 'STU-4F9K2Q',
                    },
                    firstName: { type: 'string', example: 'Ada' },
                    lastName: { type: 'string', example: 'Lovelace' },
                    dob: { type: 'string', format: 'date', example: '2009-12-10' },
                    subjects: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['Maths', 'Physics'],
                    },
                    school: { type: 'string', example: 'Crownwood High' },
                    year: { type: 'string', example: 'Year 10' },
                    progress: {
                        type: 'number',
                        minimum: 0,
                        maximum: 100,
                        description:
                            'Blended 0–100 figure. When progressBySubject is present the API keeps this as the rounded average of its values.',
                        example: 72,
                    },
                    progressBySubject: {
                        type: 'object',
                        additionalProperties: {
                            type: 'number',
                            minimum: 0,
                            maximum: 100,
                        },
                        description: 'Progress per studied subject (0–100).',
                        example: { Maths: 80, Physics: 64 },
                    },
                    mode: { $ref: '#/components/schemas/StudentMode' },
                    fees: {
                        type: 'number',
                        minimum: 0,
                        description:
                            'Fee amount in GBP — a per-session price or a monthly retainer, per feeType.',
                        example: 35,
                    },
                    feeType: {
                        type: 'string',
                        enum: ['per-session', 'monthly', 'none'],
                        description:
                            'How fees is billed. Absent means per-session.',
                    },
                    notes: { type: 'string' },
                    parentName: { type: 'string', example: 'Byron Lovelace' },
                    contactNumber: { type: 'string', example: '+44 7700 900123' },
                    address: { type: 'string' },
                    isArchived: {
                        type: 'boolean',
                        description:
                            'True once moved to Alumni (REQ-013). Absent/false means active; older records are unaffected.',
                        example: false,
                    },
                    archivedOn: {
                        type: 'string',
                        format: 'date',
                        description:
                            'ISO date the student was archived — the retention-window anchor.',
                    },
                    archiveNotes: {
                        type: 'string',
                        description:
                            "The teacher's closing note, kept through archive and restore.",
                    },
                },
                required: [
                    'id',
                    'studentId',
                    'firstName',
                    'lastName',
                    'subjects',
                    'progress',
                    'mode',
                    'fees',
                ],
            },
            StudentMode: {
                type: 'string',
                enum: ['Online', 'Face to Face', 'Both'],
                description: 'Defaults to "Face to Face" when omitted.',
            },
            StudentInput: {
                type: 'object',
                description:
                    'Upsert payload. `id` omitted (POST) creates; `id` present, or a PUT route id, updates. Only firstName and lastName are required.',
                properties: {
                    id: { type: 'integer' },
                    studentId: { type: 'string' },
                    firstName: { type: 'string', example: 'Ada' },
                    lastName: { type: 'string', example: 'Lovelace' },
                    dob: { type: 'string', format: 'date' },
                    subjects: { type: 'array', items: { type: 'string' } },
                    school: { type: 'string' },
                    year: { type: 'string' },
                    progress: { type: 'number', minimum: 0, maximum: 100 },
                    progressBySubject: {
                        type: 'object',
                        additionalProperties: {
                            type: 'number',
                            minimum: 0,
                            maximum: 100,
                        },
                    },
                    mode: { $ref: '#/components/schemas/StudentMode' },
                    fees: { type: 'number', minimum: 0 },
                    feeType: {
                        type: 'string',
                        enum: ['per-session', 'monthly', 'none'],
                    },
                    notes: { type: 'string' },
                    parentName: { type: 'string' },
                    contactNumber: { type: 'string' },
                    address: { type: 'string' },
                },
                required: ['firstName', 'lastName'],
            },

            // ---- Sessions ----------------------------------------------
            SessionStatus: {
                type: 'string',
                enum: ['Scheduled', 'Cancelled'],
            },
            ScheduledSession: {
                type: 'object',
                description: 'A scheduled class for a student.',
                properties: {
                    id: { type: 'integer', example: 42 },
                    studentId: { type: 'integer', example: 7 },
                    studentName: { type: 'string', example: 'Ada Lovelace' },
                    year: { type: 'string', example: 'Year 10' },
                    subject: { type: 'string', example: 'Maths' },
                    date: { type: 'string', format: 'date', example: '2026-07-20' },
                    time: {
                        type: 'string',
                        pattern: '^\\d{2}:\\d{2}$',
                        example: '17:00',
                    },
                    durationMinutes: {
                        type: 'integer',
                        enum: [30, 60, 90, 120],
                        example: 60,
                    },
                    groupId: {
                        type: 'string',
                        description:
                            'Links the rows of a group class; absent on a solo class.',
                        example: 'grp-42',
                    },
                    notes: { type: 'string' },
                    status: { $ref: '#/components/schemas/SessionStatus' },
                },
                required: [
                    'id',
                    'studentId',
                    'studentName',
                    'subject',
                    'date',
                    'time',
                    'durationMinutes',
                    'status',
                ],
            },
            SessionInput: {
                type: 'object',
                description:
                    'Create payload. Provide `studentId` for a solo class, or a non-empty `studentIds` for a group class. durationMinutes defaults when omitted.',
                properties: {
                    studentId: { type: 'integer', example: 7 },
                    studentIds: {
                        type: 'array',
                        items: { type: 'integer' },
                        description: 'Two or more books a group class.',
                        example: [7, 8, 9],
                    },
                    studentName: { type: 'string' },
                    year: { type: 'string' },
                    subject: { type: 'string', example: 'Maths' },
                    date: { type: 'string', format: 'date', example: '2026-07-20' },
                    time: {
                        type: 'string',
                        pattern: '^\\d{2}:\\d{2}$',
                        example: '17:00',
                    },
                    durationMinutes: {
                        type: 'integer',
                        enum: [30, 60, 90, 120],
                    },
                    notes: { type: 'string' },
                },
                required: ['subject', 'date', 'time'],
            },
            SessionUpdate: {
                type: 'object',
                description:
                    'Edit and/or cancel/restore a class. Every field is optional but at least one must be present.',
                properties: {
                    studentId: { type: 'integer' },
                    studentName: { type: 'string' },
                    year: { type: 'string' },
                    subject: { type: 'string' },
                    date: { type: 'string', format: 'date' },
                    time: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                    durationMinutes: {
                        type: 'integer',
                        enum: [30, 60, 90, 120],
                    },
                    notes: { type: 'string' },
                    status: { $ref: '#/components/schemas/SessionStatus' },
                    applyToGroup: {
                        type: 'boolean',
                        description:
                            'Apply this update to every row sharing the session’s groupId.',
                    },
                },
                minProperties: 1,
                example: { status: 'Cancelled' },
            },

            // ---- Payments ----------------------------------------------
            PaymentStatus: {
                type: 'string',
                enum: ['Paid', 'Partial', 'Pending'],
            },
            PaymentRecord: {
                type: 'object',
                description:
                    "A student's bill for one month. amountDue is derived from the classes that took place; only amountPaid/notes are stored.",
                properties: {
                    id: { type: 'integer' },
                    studentId: { type: 'integer', example: 7 },
                    studentName: { type: 'string', example: 'Ada Lovelace' },
                    month: {
                        type: 'string',
                        pattern: '^\\d{4}-\\d{2}$',
                        example: '2026-07',
                    },
                    feePerSession: { type: 'number', example: 35 },
                    feeType: {
                        type: 'string',
                        enum: ['per-session', 'monthly', 'none'],
                    },
                    sessionsHeld: { type: 'integer', example: 4 },
                    totalDurationMinutes: {
                        type: 'integer',
                        description:
                            'Total minutes of the classes held this month.',
                        example: 240,
                    },
                    amountDue: {
                        type: 'number',
                        description: 'feePerSession × sessionsHeld.',
                        example: 140,
                    },
                    amountPaid: { type: 'number', example: 100 },
                    outstanding: {
                        type: 'number',
                        description: 'amountDue − amountPaid, never below zero.',
                        example: 40,
                    },
                    status: { $ref: '#/components/schemas/PaymentStatus' },
                    notes: { type: 'string' },
                    sessions: {
                        type: 'array',
                        description:
                            'The held classes behind this bill, each a line item. Per-session fees sum to amountDue; a monthly student’s lines carry fee 0 (the flat retainer covers them). Empty for no-fee students.',
                        items: { $ref: '#/components/schemas/SessionLine' },
                    },
                },
                required: [
                    'id',
                    'studentId',
                    'studentName',
                    'month',
                    'feePerSession',
                    'sessionsHeld',
                    'totalDurationMinutes',
                    'amountDue',
                    'amountPaid',
                    'outstanding',
                    'status',
                    'sessions',
                ],
            },
            SessionLine: {
                type: 'object',
                description:
                    'One held class as a bill line item. The fee is the flat per-session price, independent of durationMinutes (shown for context); on a monthly bill it is 0.',
                properties: {
                    date: {
                        type: 'string',
                        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                        example: '2026-07-03',
                    },
                    subject: { type: 'string', example: 'Mathematics' },
                    durationMinutes: { type: 'integer', example: 60 },
                    fee: { type: 'number', example: 35 },
                },
                required: ['date', 'subject', 'durationMinutes', 'fee'],
            },
            PaymentInput: {
                type: 'object',
                description:
                    'Records a payment. Omit amountPaid to settle the month in full ("mark as paid"). month must be a month of the billing year.',
                properties: {
                    studentId: { type: 'integer', example: 7 },
                    month: {
                        type: 'string',
                        pattern: '^\\d{4}-\\d{2}$',
                        example: '2026-07',
                    },
                    amountPaid: { type: 'number', minimum: 0, example: 100 },
                    notes: { type: 'string' },
                },
                required: ['studentId', 'month'],
            },
            MonthlyPaymentGroup: {
                type: 'object',
                description: 'Payment records for one month, with totals.',
                properties: {
                    month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
                    totalDue: { type: 'number' },
                    totalReceived: { type: 'number' },
                    totalOutstanding: { type: 'number' },
                    sessionsHeld: {
                        type: 'integer',
                        description: 'Classes taught across every student this month.',
                    },
                    records: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/PaymentRecord' },
                    },
                },
                required: [
                    'month',
                    'totalDue',
                    'totalReceived',
                    'totalOutstanding',
                    'sessionsHeld',
                    'records',
                ],
            },

            // ---- Testimonials (REQ-027) --------------------------------
            TestimonialStatus: {
                type: 'string',
                enum: ['Pending', 'Approved', 'Rejected'],
            },
            TestimonialRole: {
                type: 'string',
                enum: ['Parent', 'Student'],
            },
            Testimonial: {
                type: 'object',
                description:
                    'A family-submitted review. Only Approved ones are returned publicly.',
                properties: {
                    id: { type: 'integer', example: 3 },
                    authorName: { type: 'string', example: 'Nadia D.' },
                    role: { $ref: '#/components/schemas/TestimonialRole' },
                    subject: { type: 'string', example: 'Mathematics' },
                    year: { type: 'string', example: '10' },
                    rating: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 5,
                        example: 5,
                    },
                    quote: {
                        type: 'string',
                        description: 'Plain text; any HTML is stripped on write.',
                    },
                    status: { $ref: '#/components/schemas/TestimonialStatus' },
                    submittedOn: {
                        type: 'string',
                        format: 'date',
                        example: '2026-07-15',
                    },
                    moderatedOn: {
                        type: 'string',
                        format: 'date',
                        description: 'Absent while Pending.',
                    },
                },
                required: [
                    'id',
                    'authorName',
                    'role',
                    'rating',
                    'quote',
                    'status',
                    'submittedOn',
                ],
            },
            TestimonialInput: {
                type: 'object',
                description:
                    'Public submission. subject/year are optional; website is a honeypot real people leave blank.',
                properties: {
                    authorName: { type: 'string', maxLength: 80 },
                    role: { $ref: '#/components/schemas/TestimonialRole' },
                    subject: { type: 'string', maxLength: 60 },
                    year: { type: 'string', maxLength: 10 },
                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                    quote: { type: 'string', maxLength: 600 },
                    website: {
                        type: 'string',
                        description: 'Honeypot — leave empty.',
                    },
                },
                required: ['authorName', 'role', 'rating', 'quote'],
            },
            TestimonialUpdate: {
                type: 'object',
                description: 'Moderation. Only Approved or Rejected are settable.',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['Approved', 'Rejected'],
                    },
                },
                required: ['status'],
                example: { status: 'Approved' },
            },
            Contact: {
                type: 'object',
                description:
                    'Public contact details. Both fields are optional — an absent one means the teacher has removed that method.',
                properties: {
                    email: { type: 'string', maxLength: 254 },
                    phone: { type: 'string', maxLength: 40 },
                },
                example: {
                    email: 'hello@example.com',
                    phone: '+44 7700 900000',
                },
            },
            ContactInput: {
                type: 'object',
                description:
                    'Contact update. Both fields optional; a blank or omitted field removes that method.',
                properties: {
                    email: { type: 'string', maxLength: 254 },
                    phone: { type: 'string', maxLength: 40 },
                },
            },
        },
        responses: {
            BadRequest: {
                description: 'Validation failed.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
            Unauthorized: {
                description: 'Missing, invalid, or expired bearer token.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
            Forbidden: {
                description: 'Valid token, but not an allowed teacher.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
            NotFound: {
                description: 'No such resource.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                    },
                },
            },
        },
        parameters: {
            StudentIdPath: {
                name: 'id',
                in: 'path',
                required: true,
                description: 'Numeric student id.',
                schema: { type: 'integer' },
            },
            SessionIdPath: {
                name: 'id',
                in: 'path',
                required: true,
                description: 'Numeric session id.',
                schema: { type: 'integer' },
            },
            StudentIdQuery: {
                name: 'studentId',
                in: 'query',
                required: false,
                schema: { type: 'integer' },
            },
            MonthQuery: {
                name: 'month',
                in: 'query',
                required: false,
                schema: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            },
            PaymentStatusQuery: {
                name: 'status',
                in: 'query',
                required: false,
                schema: { $ref: '#/components/schemas/PaymentStatus' },
            },
            TestimonialIdPath: {
                name: 'id',
                in: 'path',
                required: true,
                description: 'Numeric testimonial id.',
                schema: { type: 'integer' },
            },
        },
    },
    // Applied to every operation; individual ops don't repeat it.
    security: bearer,
    paths: {
        '/students': {
            get: {
                tags: ['Students'],
                summary: 'List all students',
                operationId: 'getStudents',
                responses: {
                    '200': {
                        description: 'Every student.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Student' },
                                },
                            },
                        },
                    },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
            post: {
                tags: ['Students'],
                summary: 'Create or update a student',
                description: 'Creates when the body carries no id, updates when it does.',
                operationId: 'upsertStudent',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/StudentInput' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Updated existing student.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '201': {
                        description: 'Created a new student.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/students/{id}': {
            get: {
                tags: ['Students'],
                summary: 'Get a student by id',
                operationId: 'getStudent',
                parameters: [{ $ref: '#/components/parameters/StudentIdPath' }],
                responses: {
                    '200': {
                        description: 'The student.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
            put: {
                tags: ['Students'],
                summary: 'Update the student at this id',
                description: 'The route id takes precedence over any id in the body.',
                operationId: 'upsertStudentById',
                parameters: [{ $ref: '#/components/parameters/StudentIdPath' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/StudentInput' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Updated student.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '201': {
                        description: 'Created (id not previously present).',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
            delete: {
                tags: ['Students'],
                summary: 'Erase a student and all their data',
                description:
                    'Cascade delete of the student, their sessions and settlements (GDPR right to erasure, REQ-009 §10).',
                operationId: 'deleteStudent',
                parameters: [{ $ref: '#/components/parameters/StudentIdPath' }],
                responses: {
                    '204': { description: 'Erased.' },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/students/{id}/archive': {
            post: {
                tags: ['Students'],
                summary: 'Archive a student to Alumni',
                description:
                    'Moves the student off the active roster to the teacher-only Alumni view, keeping all their history (REQ-013). Any future class is cancelled as part of the archive. A closing note is required.',
                operationId: 'archiveStudent',
                parameters: [{ $ref: '#/components/parameters/StudentIdPath' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    notes: {
                                        type: 'string',
                                        description: 'Closing note (required).',
                                        example: 'Finished GCSE course — great result.',
                                    },
                                },
                                required: ['notes'],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Archived. Returns the updated student.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/students/{id}/restore': {
            post: {
                tags: ['Students'],
                summary: 'Restore an archived student',
                description:
                    'Returns an archived student to the active roster (REQ-013). The closing note is kept, as a record of the past.',
                operationId: 'restoreStudent',
                parameters: [{ $ref: '#/components/parameters/StudentIdPath' }],
                responses: {
                    '200': {
                        description: 'Restored. Returns the updated student.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Student' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/sessions': {
            get: {
                tags: ['Sessions'],
                summary: 'List scheduled classes',
                description: 'Date-ordered. Optionally filter by studentId.',
                operationId: 'getSessions',
                parameters: [{ $ref: '#/components/parameters/StudentIdQuery' }],
                responses: {
                    '200': {
                        description: 'Scheduled sessions.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/ScheduledSession',
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
            post: {
                tags: ['Sessions'],
                summary: 'Schedule a new class',
                description:
                    'Books a solo class (studentId) or a group class (studentIds). A solo booking returns a single object; a group booking returns the array of rows.',
                operationId: 'createSession',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SessionInput' },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Scheduled. Object for solo, array for group.',
                        content: {
                            'application/json': {
                                schema: {
                                    oneOf: [
                                        {
                                            $ref: '#/components/schemas/ScheduledSession',
                                        },
                                        {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/ScheduledSession',
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/sessions/{id}': {
            put: {
                tags: ['Sessions'],
                summary: 'Edit and/or cancel/restore a class',
                description:
                    'Body is any non-empty subset of the class fields. With applyToGroup=true the change spans the whole group, and the array of affected rows is returned; otherwise the single updated object.',
                operationId: 'updateSession',
                parameters: [{ $ref: '#/components/parameters/SessionIdPath' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SessionUpdate' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Updated. Object for one row, array for a group.',
                        content: {
                            'application/json': {
                                schema: {
                                    oneOf: [
                                        {
                                            $ref: '#/components/schemas/ScheduledSession',
                                        },
                                        {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/ScheduledSession',
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/payments': {
            get: {
                tags: ['Payments'],
                summary: 'List payment records',
                operationId: 'getPayments',
                parameters: [
                    { $ref: '#/components/parameters/StudentIdQuery' },
                    { $ref: '#/components/parameters/MonthQuery' },
                    { $ref: '#/components/parameters/PaymentStatusQuery' },
                ],
                responses: {
                    '200': {
                        description: 'Matching payment records.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/PaymentRecord',
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
            post: {
                tags: ['Payments'],
                summary: 'Record one or more payments',
                description:
                    'Accepts a single payment object or an array. Each is matched by (studentId, month) and upserted. Returns the saved records.',
                operationId: 'savePayments',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                oneOf: [
                                    { $ref: '#/components/schemas/PaymentInput' },
                                    {
                                        type: 'array',
                                        items: {
                                            $ref: '#/components/schemas/PaymentInput',
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Saved payment records.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/PaymentRecord',
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/payments/by-month': {
            get: {
                tags: ['Payments'],
                summary: 'Payment records grouped by month',
                description:
                    'Each group carries totalDue / totalReceived / totalOutstanding and sessionsHeld.',
                operationId: 'getPaymentsByMonth',
                parameters: [
                    { $ref: '#/components/parameters/StudentIdQuery' },
                    { $ref: '#/components/parameters/PaymentStatusQuery' },
                ],
                responses: {
                    '200': {
                        description: 'Monthly payment groups.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/MonthlyPaymentGroup',
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/testimonials': {
            get: {
                tags: ['Testimonials'],
                summary: 'List approved reviews (public)',
                description:
                    'Public. Returns Approved reviews only, newest first — never Pending or Rejected.',
                operationId: 'getTestimonials',
                // Public: override the global bearer requirement.
                security: [],
                responses: {
                    '200': {
                        description: 'Approved testimonials.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/Testimonial',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Testimonials'],
                summary: 'Submit a review (public)',
                description:
                    'Public. Records the review as Pending for teacher moderation; a filled honeypot is silently accepted and dropped. Responds with an acknowledgement, not the stored record.',
                operationId: 'createTestimonial',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/TestimonialInput',
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Submission received.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { ok: { type: 'boolean' } },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/testimonials/pending': {
            get: {
                tags: ['Testimonials'],
                summary: 'List pending reviews (teacher)',
                description: 'The moderation queue — Pending reviews, newest first.',
                operationId: 'getPendingTestimonials',
                responses: {
                    '200': {
                        description: 'Pending testimonials.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/Testimonial',
                                    },
                                },
                            },
                        },
                    },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/testimonials/{id}': {
            put: {
                tags: ['Testimonials'],
                summary: 'Approve or reject a review (teacher)',
                operationId: 'updateTestimonial',
                parameters: [
                    { $ref: '#/components/parameters/TestimonialIdPath' },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/TestimonialUpdate',
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'The moderated review.',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Testimonial',
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
            delete: {
                tags: ['Testimonials'],
                summary: 'Delete a review (teacher)',
                description:
                    'Removes a review entirely — spam/abuse, or the GDPR erasure path.',
                operationId: 'deleteTestimonial',
                parameters: [
                    { $ref: '#/components/parameters/TestimonialIdPath' },
                ],
                responses: {
                    '200': {
                        description: 'Deleted.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { id: { type: 'integer' } },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/contact': {
            get: {
                tags: ['Contact'],
                summary: 'Get contact details (public)',
                description:
                    'Public. The email and phone shown on the Contact page; an absent field means that method is not offered.',
                operationId: 'getContact',
                // Public: override the global bearer requirement.
                security: [],
                responses: {
                    '200': {
                        description: 'The contact details.',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Contact',
                                },
                            },
                        },
                    },
                },
            },
            put: {
                tags: ['Contact'],
                summary: 'Update contact details (teacher)',
                description:
                    'Replaces the contact details. A blank or omitted field removes that method. The saved record comes back.',
                operationId: 'updateContact',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ContactInput',
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'The saved contact details.',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Contact',
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '403': { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
    },
} as const

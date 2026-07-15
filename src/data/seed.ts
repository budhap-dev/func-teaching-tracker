import { Student, StudentMode } from '../models/student'
import { PaymentRecord, PaymentStatus } from '../models/payment'
import { ScheduledSession } from '../models/session'

// Each environment serves a distinct dataset — different people and a
// different volume — so dev/test/prod are easy to tell apart in the UI.
// Students are generated from per-environment name pools, so changing a
// count below is all that's needed to resize an environment's data.

interface EnvSeedConfig {
    /** Prefix for the human-facing student code, e.g. DEV-0001. */
    codePrefix: string
    /** Tag appended to each student's notes so the source env is obvious. */
    noteTag: string
    schools: string[]
    town: string
    phonePrefix: string
    /** Lowest monthly fee; each student varies deterministically from this. */
    baseFee: number
    /** How many students this environment serves. */
    studentCount: number
    /** How many scheduled classes this environment serves. */
    sessionCount: number
    names: [string, string][]
}

const subjectRotation: string[][] = [
    ['Mathematics', 'Physics'],
    ['Physics'],
    ['English'],
    ['Chemistry'],
    ['Biology', 'Chemistry'],
    ['Mathematics'],
    ['History', 'English'],
    ['English', 'Mathematics'],
]

const yearRotation = ['8', '9', '10', '11']

const parentFirstNames = [
    'Nadia',
    'Martin',
    'Helen',
    'David',
    'Laura',
    'James',
    'Sophie',
    'Richard',
    'Claire',
    'Timothy',
    'Anita',
    'Karen',
    'Mark',
    'Priya',
    'Daniel',
]

const envSeeds: Record<string, EnvSeedConfig> = {
    dev: {
        codePrefix: 'DEV',
        noteTag: '[dev] sample record',
        schools: ['Dev Sandbox Academy'],
        town: 'Localhost',
        phonePrefix: '+44 7000 0000',
        baseFee: 100,
        studentCount: 5,
        sessionCount: 4,
        names: [
            ['Ava', 'Devlin'],
            ['Sam', 'Bailey'],
            ['Priya', 'Nair'],
            ['Leo', 'Whitfield'],
            ['Zara', 'Ahmed'],
        ],
    },
    test: {
        codePrefix: 'TST',
        noteTag: '[test] QA fixture',
        schools: ['Riverside Test College', 'Stagingfield High'],
        town: 'Stagingtown',
        phonePrefix: '+44 7100 0000',
        baseFee: 110,
        studentCount: 10,
        sessionCount: 6,
        names: [
            ['Oliver', 'Grant'],
            ['Maya', 'Lindqvist'],
            ['Noah', 'Abassi'],
            ['Ella', 'Fontaine'],
            ['Ravi', 'Kapoor'],
            ['Sofia', 'Marino'],
            ['Jack', 'Turner'],
            ['Amara', 'Osei'],
            ['Ben', 'Fletcher'],
            ['Iris', 'Kovac'],
        ],
    },
    prod: {
        codePrefix: 'STU',
        noteTag: 'Progressing well.',
        schools: [
            'Kingston Grammar School',
            'St. Pauls School',
            'Epsom College',
            'Harrow School',
            'Wycombe Abbey',
        ],
        town: 'Guildford',
        phonePrefix: '+44 7700 9000',
        baseFee: 120,
        studentCount: 15,
        sessionCount: 8,
        names: [
            ['Asha', 'Perera'],
            ['Nimal', 'Fernando'],
            ['Kavindi', 'Silva'],
            ['Dilan', 'Jayawardena'],
            ['Rashmi', 'Weerasinghe'],
            ['Chaminda', 'Ratnayake'],
            ['Tharushi', 'Kumari'],
            ['Sanjaya', 'Bandara'],
            ['Mihiri', 'Gunasekara'],
            ['Kasun', 'Mendis'],
            ['Ishara', 'Dias'],
            ['Malith', 'Rajapaksa'],
            ['Nethmi', 'Wijesinghe'],
            ['Roshan', 'Alwis'],
            ['Dinuka', 'Senanayake'],
        ],
    },
}

/** Dataset used when ENVIRONMENT is unset or unrecognised (local dev). */
export const defaultEnv = 'dev'

/** Environments that have a seed dataset. */
export const seededEnvironments = Object.keys(envSeeds)

const buildStudents = (config: EnvSeedConfig): Student[] =>
    config.names.slice(0, config.studentCount).map(([firstName, lastName], i) => {
        const mode: StudentMode = i % 2 === 0 ? 'Face to Face' : 'Online'
        return {
            id: i + 1,
            studentId: `${config.codePrefix}-${String(i + 1).padStart(4, '0')}`,
            firstName,
            lastName,
            dob: `${2010 + (i % 4)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
            subjects: subjectRotation[i % subjectRotation.length],
            school: config.schools[i % config.schools.length],
            year: yearRotation[i % yearRotation.length],
            progress: 55 + ((i * 7) % 41),
            mode,
            fees: config.baseFee + (i % 4) * 15,
            notes: config.noteTag,
            parentName: `${parentFirstNames[i % parentFirstNames.length]} ${lastName}`,
            contactNumber: `${config.phonePrefix}${String(i + 1).padStart(2, '0')}`,
            address: `${i + 1} Sample Street, ${config.town}`,
        }
    })

const sessionNotes = [
    'Problem solving practice',
    'Lab preparation',
    'Reading and writing review',
    'Revision session',
    'Past paper walkthrough',
    'Coursework feedback',
    'Exam technique',
    'Catch-up session',
]

const sessionTimes = ['09:30', '11:00', '14:00', '16:00', '17:30']

/**
 * Builds scheduled classes for the given students. Dates are relative to today
 * so the dashboard's "upcoming sessions" list is always populated.
 */
const buildSessions = (
    students: Student[],
    sessionCount: number
): ScheduledSession[] => {
    const today = new Date()
    return students.slice(0, sessionCount).map((student, i) => {
        const date = new Date(today)
        date.setDate(date.getDate() + i + 1)
        return {
            id: 100 + i + 1,
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            year: student.year,
            subject: student.subjects[0],
            date: date.toISOString().slice(0, 10),
            time: sessionTimes[i % sessionTimes.length],
            notes: sessionNotes[i % sessionNotes.length],
        }
    })
}

const paymentStatusNotes: Record<PaymentStatus, string> = {
    Paid: 'Received in full',
    Partial: 'Partial payment received',
    Pending: 'Awaiting payment',
}

/**
 * Builds twelve monthly payment records per student for the given year, using
 * each student's agreed `fees` as the monthly amount. Deterministic so seeded
 * data is stable across restarts.
 */
export const buildSeedPayments = (
    students: Student[],
    year: number
): PaymentRecord[] => {
    const months = Array.from(
        { length: 12 },
        (_, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    )

    return students.flatMap((student) =>
        months.map((month, monthIndex) => {
            const monthlyFee = student.fees
            const pattern = (student.id + monthIndex) % 3
            const status: PaymentStatus =
                pattern === 0 ? 'Paid' : pattern === 1 ? 'Partial' : 'Pending'
            const amountPaid =
                status === 'Paid'
                    ? monthlyFee
                    : status === 'Partial'
                      ? Math.round(monthlyFee * 0.5)
                      : 0

            return {
                id: student.id * 100 + monthIndex,
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                month,
                monthlyFee,
                amountPaid,
                status,
                notes: paymentStatusNotes[status],
            }
        })
    )
}

/** Builds the full dataset (students + sessions) for one environment. */
export const buildSeedForEnv = (
    env: string
): { students: Student[]; sessions: ScheduledSession[] } => {
    const config = envSeeds[env] ?? envSeeds[defaultEnv]
    const students = buildStudents(config)
    return { students, sessions: buildSessions(students, config.sessionCount) }
}

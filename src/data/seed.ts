import { Student, StudentMode } from '../models/student'
import { ScheduledSession, SessionStatus } from '../models/session'

// Each environment serves a distinct dataset — different people and a
// different volume — so dev/prod are easy to tell apart in the UI.
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
    /** Every Nth class per student is seeded Cancelled. */
    cancelEvery: number
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
        cancelEvery: 9,
        names: [
            ['Ava', 'Devlin'],
            ['Sam', 'Bailey'],
            ['Priya', 'Nair'],
            ['Leo', 'Whitfield'],
            ['Zara', 'Ahmed'],
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
        cancelEvery: 11,
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
 * Builds a year of classes: each student has a weekly slot, on their own
 * weekday and time, running through the seed year.
 *
 * Recurring rather than a handful of one-offs because billing is per session —
 * with only a few classes near today, almost every month would bill nothing.
 * Every Nth class is cancelled so the state is visible without creating one.
 */
const buildSessions = (
    students: Student[],
    config: EnvSeedConfig,
    year: number
): ScheduledSession[] =>
    students.flatMap((student, studentIndex) => {
        // Each student keeps the same weekday (Mon–Fri) and time every week.
        const weekday = (studentIndex % 5) + 1
        const time = sessionTimes[studentIndex % sessionTimes.length]

        // First occurrence of that weekday in January.
        const first = new Date(Date.UTC(year, 0, 1))
        while (first.getUTCDay() !== weekday) {
            first.setUTCDate(first.getUTCDate() + 1)
        }

        const sessions: ScheduledSession[] = []
        const cursor = new Date(first)
        let week = 0
        while (cursor.getUTCFullYear() === year) {
            const status: SessionStatus =
                week > 0 && week % config.cancelEvery === 0
                    ? 'Cancelled'
                    : 'Scheduled'
            sessions.push({
                id: student.id * 1000 + week,
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                year: student.year,
                subject: student.subjects[week % student.subjects.length],
                date: cursor.toISOString().slice(0, 10),
                time,
                notes: sessionNotes[week % sessionNotes.length],
                status,
            })
            cursor.setUTCDate(cursor.getUTCDate() + 7)
            week += 1
        }
        return sessions
    })

/** The year the seed timetable covers. */
export const seedYear = 2026

/** Builds the full dataset (students + a year of classes) for one environment. */
export const buildSeedForEnv = (
    env: string
): { students: Student[]; sessions: ScheduledSession[] } => {
    const config = envSeeds[env] ?? envSeeds[defaultEnv]
    const students = buildStudents(config)
    return { students, sessions: buildSessions(students, config, seedYear) }
}

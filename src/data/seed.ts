import { Student } from '../models/student'
import { PaymentRecord, PaymentStatus } from '../models/payment'

export const seedStudents: Student[] = [
    {
        id: 1,
        studentId: 'STU-AX7M2P',
        firstName: 'Asha',
        lastName: 'Perera',
        dob: '2011-05-14',
        subjects: ['Mathematics', 'Physics'],
        school: 'Kingston Grammar School',
        year: '10',
        progress: 88,
        mode: 'Face to Face',
        notes: 'Excellent problem solving skills.',
        parentName: 'Nadia Patel',
        contactNumber: '+44 7700 900123',
        address: '12 Oak Road, Kingston upon Thames, KT2 6LP',
    },
    {
        id: 2,
        studentId: 'STU-CL4Q8R',
        firstName: 'Nimal',
        lastName: 'Fernando',
        dob: '2012-08-22',
        subjects: ['Physics'],
        school: 'St. Pauls School',
        year: '9',
        progress: 74,
        mode: 'Online',
        notes: 'Needs extra practice with experiments.',
        parentName: 'Martin Foster',
        contactNumber: '+44 7710 123456',
        address: '23 Elm Grove, Wimbledon, SW19 7HQ',
    },
    {
        id: 3,
        studentId: 'STU-KV9P1T',
        firstName: 'Kavindi',
        lastName: 'Silva',
        dob: '2013-01-11',
        subjects: ['English'],
        school: 'Epsom College',
        year: '8',
        progress: 82,
        mode: 'Face to Face',
        notes: 'Strong writing and reading confidence.',
        parentName: 'Helen Clarke',
        contactNumber: '+44 7720 456789',
        address: '5 Willow Lane, Guildford, GU1 2AB',
    },
    {
        id: 4,
        studentId: 'STU-DJ2L6N',
        firstName: 'Dilan',
        lastName: 'Jayawardena',
        dob: '2010-11-03',
        subjects: ['Chemistry'],
        school: 'Harrow School',
        year: '11',
        progress: 70,
        mode: 'Online',
        notes: 'Needs more consistent revision habits.',
        parentName: 'David Hughes',
        contactNumber: '+44 7730 987654',
        address: '88 High Street, Harrow, HA1 4DX',
    },
    {
        id: 5,
        studentId: 'STU-RP8N4W',
        firstName: 'Rashmi',
        lastName: 'Weerasinghe',
        dob: '2011-09-16',
        subjects: ['Biology', 'Chemistry'],
        school: 'Wycombe Abbey',
        year: '10',
        progress: 86,
        mode: 'Face to Face',
        notes: 'Very attentive during lab sessions.',
        parentName: 'Laura Bennett',
        contactNumber: '+44 7740 111222',
        address: '14 Lake View, Buckingham, MK18 1PT',
    },
]

const paymentStatusNotes: Record<PaymentStatus, string> = {
    Paid: 'Received in full',
    Partial: 'Partial payment received',
    Pending: 'Awaiting payment',
}

/**
 * Builds twelve monthly payment records per student for the given year,
 * using a deterministic pattern so seeded data is stable across restarts.
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
            const monthlyFee = 120 + (student.id % 4) * 10
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

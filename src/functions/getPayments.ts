import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { PaymentQuery, paymentStatuses, PaymentStatus } from '../models/payment'
import { listPayments } from '../services/paymentService'
import { badRequest, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * GET /api/payments — returns payment records.
 * Optional query params: studentId (number), month (YYYY-MM), status.
 */
export async function getPayments(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const auth = await requireTeacher(request, context)
    if (isRefusal(auth)) {
        return auth
    }

    const query: PaymentQuery = {}

    const studentIdParam = request.query.get('studentId')
    if (studentIdParam !== null) {
        const studentId = Number(studentIdParam)
        if (!Number.isInteger(studentId)) {
            return badRequest('studentId must be an integer.')
        }
        query.studentId = studentId
    }

    const month = request.query.get('month')
    if (month !== null) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
            return badRequest('month must be in YYYY-MM format.')
        }
        query.month = month
    }

    const status = request.query.get('status')
    if (status !== null) {
        if (!paymentStatuses.includes(status as PaymentStatus)) {
            return badRequest(
                `status must be one of: ${paymentStatuses.join(', ')}.`
            )
        }
        query.status = status as PaymentStatus
    }

    const payments = await listPayments(query)
    context.log(`Returning ${payments.length} payment records`)
    return ok(payments)
}

app.http('getPayments', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'payments',
    handler: getPayments,
})

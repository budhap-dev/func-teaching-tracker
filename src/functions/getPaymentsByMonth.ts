import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { PaymentQuery, paymentStatuses, PaymentStatus } from '../models/payment'
import { listPaymentsByMonth } from '../services/paymentService'
import { badRequest, ok } from '../shared/http'
import { isRefusal, requireTeacher } from '../shared/auth'

/**
 * GET /api/payments/by-month — payment records grouped by month, each with
 * totalExpected / totalReceived / totalOutstanding.
 * Optional query params: studentId (number), status.
 */
export async function getPaymentsByMonth(
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

    const status = request.query.get('status')
    if (status !== null) {
        if (!paymentStatuses.includes(status as PaymentStatus)) {
            return badRequest(
                `status must be one of: ${paymentStatuses.join(', ')}.`
            )
        }
        query.status = status as PaymentStatus
    }

    const groups = listPaymentsByMonth(query)
    context.log(`Returning ${groups.length} monthly payment groups`)
    return ok(groups)
}

app.http('getPaymentsByMonth', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'payments/by-month',
    handler: getPaymentsByMonth,
})

import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext,
} from '@azure/functions'
import { PaymentInput } from '../models/payment'
import { savePayments, validatePaymentInput } from '../services/paymentService'
import { badRequest, ok, parseJsonBody } from '../shared/http'

/**
 * POST /api/payments — create or update payment records.
 * Accepts a single payment object or an array of them. Each record is matched
 * by `id`, or by (studentId, month), and upserted.
 */
export async function savePaymentsHandler(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const body = await parseJsonBody<PaymentInput | PaymentInput[]>(request)
    if (body === undefined) {
        return badRequest('Request body must be a payment object or array.')
    }

    const inputs = Array.isArray(body) ? body : [body]
    if (inputs.length === 0) {
        return badRequest('At least one payment record is required.')
    }

    for (let i = 0; i < inputs.length; i += 1) {
        const error = validatePaymentInput(inputs[i], i)
        if (error) {
            return badRequest(error)
        }
    }

    const saved = savePayments(inputs)
    context.log(`Saved ${saved.length} payment records`)
    return ok(saved)
}

app.http('savePayments', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'payments',
    handler: savePaymentsHandler,
})

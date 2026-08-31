// Wraps the backend's PayablePaymentController (/api/payables/{payableId}/payments)
// — records a payment against one vendor bill (see usePayables.ts).

export interface PayablePayment {
  id: number
  payableId: number
  amount: number
  paymentDate: string
  method: string
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface CreatePayablePaymentPayload {
  amount: number
  paymentDate: string
  method: string
  referenceNumber?: string
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function usePayablePayments() {
  const api = useApi()

  async function list(payableId: number) {
    const res = await api<ApiEnvelope<PayablePayment[]>>(`/api/payables/${payableId}/payments`)
    return res.data
  }

  async function create(payableId: number, payload: CreatePayablePaymentPayload) {
    const res = await api<ApiEnvelope<PayablePayment>>(`/api/payables/${payableId}/payments`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, create }
}

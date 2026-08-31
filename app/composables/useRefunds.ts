// Wraps the backend's RefundController — refunds against a rent Invoice, nested
// under it for list/create (/api/invoices/{invoiceId}/refunds) but addressed
// directly by id for get/process (/api/refunds/{id}). Two-step lifecycle: a
// refund is created PENDING, then a separate call marks it REFUNDED. List/get
// are open to any authenticated user; create/process are ADMIN-only.

import type { PaymentMethod, RefundStatus } from '#shared/domain'

export interface Refund {
  id: number
  invoiceId: number
  amount: number
  reason: string | null
  refundDate: string
  method: PaymentMethod
  referenceNumber: string | null
  status: RefundStatus
  refundedAt: string | null
  recordedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRefundPayload {
  amount: number
  reason?: string
  refundDate: string
  method: PaymentMethod
  referenceNumber?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useRefunds() {
  const api = useApi()

  async function list(invoiceId: number) {
    const res = await api<ApiEnvelope<Refund[]>>(`/api/invoices/${invoiceId}/refunds`)
    return res.data
  }

  async function create(invoiceId: number, payload: CreateRefundPayload) {
    const res = await api<ApiEnvelope<Refund>>(`/api/invoices/${invoiceId}/refunds`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Refund>>(`/api/refunds/${id}`)
    return res.data
  }

  async function process(id: number) {
    const res = await api<ApiEnvelope<Refund>>(`/api/refunds/${id}/process`, { method: 'PUT' })
    return res.data
  }

  return { list, create, get, process }
}

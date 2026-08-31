// Wraps the backend's SaleRefundController
// (/api/sale-agreements/{saleAgreementId}/refund). At most one refund per sale
// agreement: `create` calculates it (totalPaid/refundAmount are server-derived
// from recorded payments minus deductions) as PENDING, `process` marks it
// REFUNDED. Folded into the Sale Agreements "Manage" modal.

export type RefundStatus = 'PENDING' | 'REFUNDED'

export interface SaleRefund {
  id: number
  saleAgreementId: number
  totalPaid: number
  deductions: number
  refundAmount: number
  status: RefundStatus
  notes: string | null
  refundedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSaleRefundPayload {
  deductions?: number
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useSaleRefunds() {
  const api = useApi()

  async function get(saleAgreementId: number) {
    const res = await api<ApiEnvelope<SaleRefund>>(`/api/sale-agreements/${saleAgreementId}/refund`)
    return res.data
  }

  async function create(saleAgreementId: number, payload: CreateSaleRefundPayload = {}) {
    const res = await api<ApiEnvelope<SaleRefund>>(`/api/sale-agreements/${saleAgreementId}/refund`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function process(saleAgreementId: number) {
    const res = await api<ApiEnvelope<SaleRefund>>(`/api/sale-agreements/${saleAgreementId}/refund/process`, {
      method: 'PUT'
    })
    return res.data
  }

  return { get, create, process }
}

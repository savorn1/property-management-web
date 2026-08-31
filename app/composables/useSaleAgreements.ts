// Wraps the backend's SaleAgreementController (/api/sale-agreements). The
// central sales-track record: created from a unit + buyer (optionally linked
// back to the SaleListing/SaleReservation it originated from), then extended
// with a payment plan, documents, handover, refund, and ownership transfer —
// all nested sub-resources, each in its own composable.

export type SaleAgreementStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface SaleAgreement {
  id: number
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  buyerId: number
  buyerName: string | null
  saleListingId: number | null
  reservationId: number | null
  agreementDate: string
  salePrice: number
  discountAmount: number
  discountReason: string | null
  netPrice: number
  status: SaleAgreementStatus
  agentId: number | null
  agentName: string | null
  commissionRate: number | null
  commissionAmount: number | null
  commissionPaid: boolean
  commissionPaidAt: string | null
  cancellationReason: string | null
  hasPaymentPlan: boolean
  hasHandover: boolean
  hasOwnershipTransfer: boolean
  hasRefund: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SaleAgreementFilter {
  unitId?: number
  buyerId?: number
  status?: SaleAgreementStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateSaleAgreementPayload {
  unitId: number
  buyerId: number
  saleListingId?: number
  reservationId?: number
  agreementDate: string
  salePrice: number
  notes?: string
}

export interface ApplyDiscountPayload {
  discountAmount: number
  discountReason?: string
}

export interface AssignAgentPayload {
  agentId: number
  commissionRate?: number
}

export interface SaleHistoryEntry {
  id: number
  action: string
  description: string | null
  performedBy: string | null
  createdAt: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

interface PageMetadata {
  hasNext: boolean
  hasPrev: boolean
  totalPage: number
  currentPage: number
  limit: number
  totalCount: number
}

interface PageEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T[]
  metadata: PageMetadata
}

export function useSaleAgreements() {
  const api = useApi()

  function list(filter: SaleAgreementFilter = {}) {
    return api<PageEnvelope<SaleAgreement>>('/api/sale-agreements', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<SaleAgreement>>(`/api/sale-agreements/${id}`)
    return res.data
  }

  async function create(payload: CreateSaleAgreementPayload) {
    const res = await api<ApiEnvelope<SaleAgreement>>('/api/sale-agreements', { method: 'POST', body: payload })
    return res.data
  }

  async function applyDiscount(id: number, payload: ApplyDiscountPayload) {
    const res = await api<ApiEnvelope<SaleAgreement>>(`/api/sale-agreements/${id}/discount`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function assignAgent(id: number, payload: AssignAgentPayload) {
    const res = await api<ApiEnvelope<SaleAgreement>>(`/api/sale-agreements/${id}/agent`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function markCommissionPaid(id: number) {
    const res = await api<ApiEnvelope<SaleAgreement>>(`/api/sale-agreements/${id}/commission/pay`, { method: 'PUT' })
    return res.data
  }

  async function cancel(id: number, reason?: string) {
    const res = await api<ApiEnvelope<SaleAgreement>>(`/api/sale-agreements/${id}/cancel`, {
      method: 'PUT',
      body: { reason }
    })
    return res.data
  }

  async function history(id: number) {
    const res = await api<ApiEnvelope<SaleHistoryEntry[]>>(`/api/sale-agreements/${id}/history`)
    return res.data
  }

  async function listPayments(id: number) {
    const res = await api<ApiEnvelope<import('./useSaleReservations').SalePayment[]>>(
      `/api/sale-agreements/${id}/payments`
    )
    return res.data
  }

  async function recordDownPayment(id: number, payload: import('./useSaleReservations').CreateSalePaymentPayload) {
    const res = await api<ApiEnvelope<import('./useSaleReservations').SalePayment>>(
      `/api/sale-agreements/${id}/down-payments`,
      { method: 'POST', body: payload }
    )
    return res.data
  }

  return {
    list,
    get,
    create,
    applyDiscount,
    assignAgent,
    markCommissionPaid,
    cancel,
    history,
    listPayments,
    recordDownPayment
  }
}

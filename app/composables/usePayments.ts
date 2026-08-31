// Wraps the backend's standalone PaymentController (/api/payments) — a
// read-only ledger view across all recorded rent/deposit payments. GET-only,
// open to any authenticated user. Payments themselves are recorded via
// Invoices' "Record payment" action or Leases' deposit-payment flow, not here.

export type PaymentType = 'RENT' | 'DEPOSIT'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHECK' | 'ONLINE' | 'OTHER'

export interface Payment {
  id: number
  leaseId: number | null
  invoiceId: number | null
  type: PaymentType
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface PaymentFilter {
  leaseId?: number
  invoiceId?: number
  type?: PaymentType
  method?: PaymentMethod
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
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

export function usePayments() {
  const api = useApi()

  function list(filter: PaymentFilter = {}) {
    return api<PageEnvelope<Payment>>('/api/payments', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Payment>>(`/api/payments/${id}`)
    return res.data
  }

  return { list, get }
}

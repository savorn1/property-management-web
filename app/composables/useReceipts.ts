// Wraps the backend's ReceiptController (/api/receipts) — a unified, read-only
// receipt ledger auto-created whenever a Payment/SalePayment/LoanPayment is
// recorded. GET-only, open to any authenticated user; no writes exposed here.

export type ReceiptSourceType = 'RENT_PAYMENT' | 'DEPOSIT_PAYMENT' | 'SALE_PAYMENT' | 'LOAN_PAYMENT'

export interface Receipt {
  id: number
  receiptNumber: string
  sourceType: ReceiptSourceType
  sourceId: number
  payerName: string
  amount: number
  paymentDate: string
  method: string
  referenceNumber: string | null
  issuedAt: string
}

export interface ReceiptFilter {
  sourceType?: ReceiptSourceType
  sourceId?: number
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

export function useReceipts() {
  const api = useApi()

  function list(filter: ReceiptFilter = {}) {
    return api<PageEnvelope<Receipt>>('/api/receipts', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Receipt>>(`/api/receipts/${id}`)
    return res.data
  }

  return { list, get }
}

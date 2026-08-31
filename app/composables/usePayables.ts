// Wraps the backend's PayableController (/api/payables). Accounts Payable — a
// vendor bill the business owes, the mirror image of a rent Invoice. Always
// references a Vendor by FK (vendorId, see useVendors.ts); property is
// optional (a bill can be company-wide or scoped to one property). No update
// endpoint, but a real DELETE exists. Paid down via usePayablePayments.ts.

export type PayableStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID'

export interface Payable {
  id: number
  vendorId: number
  vendorName: string
  propertyId: number | null
  propertyName: string | null
  billNumber: string | null
  description: string | null
  amount: number
  billDate: string
  dueDate: string
  amountPaid: number
  balanceDue: number
  status: PayableStatus
  overdue: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PayableFilter {
  vendorId?: number
  propertyId?: number
  status?: PayableStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreatePayablePayload {
  vendorId: number
  propertyId?: number
  billNumber?: string
  description?: string
  amount: number
  billDate: string
  dueDate: string
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

export function usePayables() {
  const api = useApi()

  function list(filter: PayableFilter = {}) {
    return api<PageEnvelope<Payable>>('/api/payables', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Payable>>(`/api/payables/${id}`)
    return res.data
  }

  async function create(payload: CreatePayablePayload) {
    const res = await api<ApiEnvelope<Payable>>('/api/payables', { method: 'POST', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/payables/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, remove }
}

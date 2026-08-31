// Wraps the backend's InvoiceController plus the invoice-nested payments
// endpoint (/api/invoices/**). GET endpoints are open to any authenticated
// user; generate/cancel/apply-late-fee/record-payment are ADMIN-only — pages
// using this composable must gate those actions on useAuth().isAdmin
// themselves rather than middleware, since viewing invoices is not admin-only.

export type InvoiceStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'

export interface Invoice {
  id: number
  leaseId: number
  tenantId: number
  tenantName: string | null
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  billingPeriodStart: string
  billingPeriodEnd: string
  dueDate: string
  rentAmount: number
  lateFeeAmount: number
  totalAmount: number
  amountPaid: number
  balanceDue: number
  status: InvoiceStatus
  overdue: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceFilter {
  leaseId?: number
  status?: InvoiceStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateInvoicePayload {
  leaseId: number
  // Required by the backend's CreateInvoiceRequest (@NotNull), despite
  // billingPeriodEnd/dueDate being optional (computed from the lease's rent
  // configuration when omitted).
  billingPeriodStart: string
  billingPeriodEnd?: string
  dueDate?: string
  notes?: string
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHECK' | 'ONLINE' | 'OTHER'

export interface Payment {
  id: number
  leaseId: number | null
  invoiceId: number | null
  type: string
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface CreatePaymentPayload {
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber?: string
  notes?: string
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

export function useInvoices() {
  const api = useApi()

  function list(filter: InvoiceFilter = {}) {
    return api<PageEnvelope<Invoice>>('/api/invoices', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Invoice>>(`/api/invoices/${id}`)
    return res.data
  }

  async function create(payload: CreateInvoicePayload) {
    const res = await api<ApiEnvelope<Invoice>>('/api/invoices', { method: 'POST', body: payload })
    return res.data
  }

  async function cancel(id: number) {
    const res = await api<ApiEnvelope<Invoice>>(`/api/invoices/${id}/cancel`, { method: 'PUT' })
    return res.data
  }

  async function applyLateFee(id: number) {
    const res = await api<ApiEnvelope<Invoice>>(`/api/invoices/${id}/apply-late-fee`, { method: 'PUT' })
    return res.data
  }

  async function listPayments(id: number) {
    const res = await api<ApiEnvelope<Payment[]>>(`/api/invoices/${id}/payments`)
    return res.data
  }

  async function createPayment(id: number, payload: CreatePaymentPayload) {
    const res = await api<ApiEnvelope<Payment>>(`/api/invoices/${id}/payments`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, get, create, cancel, applyLateFee, listPayments, createPayment }
}

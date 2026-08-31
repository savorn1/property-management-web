// Wraps the backend's ExpenseController (/api/expenses). An expense can be
// company-wide (propertyId null) or scoped to one property, and always
// belongs to an ExpenseCategory (see useExpenseCategories.ts) via categoryId —
// `category` is a normalized FK now, not the free-text enum it used to be.
// Expenses go through a PENDING -> APPROVED/REJECTED workflow: only a PENDING
// expense can be edited, approved, or rejected, and an APPROVED expense can no
// longer be deleted (it has already posted to accounting).

export type ExpenseApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Expense {
  id: number
  propertyId: number | null
  propertyName: string | null
  categoryId: number
  categoryName: string
  amount: number
  expenseDate: string
  vendor: string | null
  description: string | null
  recordedBy: string | null
  status: ExpenseApprovalStatus
  approvedBy: string | null
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseFilter {
  propertyId?: number
  categoryId?: number
  status?: ExpenseApprovalStatus
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface ExpensePayload {
  propertyId?: number
  categoryId: number
  amount: number
  expenseDate: string
  vendor?: string
  description?: string
}

export interface RejectExpensePayload {
  reason?: string
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

export function useExpenses() {
  const api = useApi()

  function list(filter: ExpenseFilter = {}) {
    return api<PageEnvelope<Expense>>('/api/expenses', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Expense>>(`/api/expenses/${id}`)
    return res.data
  }

  async function create(payload: ExpensePayload) {
    const res = await api<ApiEnvelope<Expense>>('/api/expenses', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: ExpensePayload) {
    const res = await api<ApiEnvelope<Expense>>(`/api/expenses/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function approve(id: number) {
    const res = await api<ApiEnvelope<Expense>>(`/api/expenses/${id}/approve`, { method: 'PUT' })
    return res.data
  }

  async function reject(id: number, payload: RejectExpensePayload = {}) {
    const res = await api<ApiEnvelope<Expense>>(`/api/expenses/${id}/reject`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/expenses/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, approve, reject, remove }
}

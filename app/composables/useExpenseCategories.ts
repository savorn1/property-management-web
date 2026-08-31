// Wraps the backend's ExpenseCategoryController (/api/expense-categories). A
// manageable expense-category catalog entry (e.g. "Maintenance", "Utilities").
// The controller exposes both a status toggle and a real delete endpoint.

export interface ExpenseCategory {
  id: number
  name: string
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ExpenseCategoryFilter {
  name?: string
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface ExpenseCategoryPayload {
  name: string
  description?: string
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

export function useExpenseCategories() {
  const api = useApi()

  function list(filter: ExpenseCategoryFilter = {}) {
    return api<PageEnvelope<ExpenseCategory>>('/api/expense-categories', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<ExpenseCategory>>(`/api/expense-categories/${id}`)
    return res.data
  }

  async function create(payload: ExpenseCategoryPayload) {
    const res = await api<ApiEnvelope<ExpenseCategory>>('/api/expense-categories', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: ExpenseCategoryPayload) {
    const res = await api<ApiEnvelope<ExpenseCategory>>(`/api/expense-categories/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<ExpenseCategory>>(`/api/expense-categories/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/expense-categories/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, updateStatus, remove }
}

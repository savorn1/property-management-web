// Wraps the backend's AccountingSchemeController (/api/accounting-schemes).
// A scheme is a named chart-of-accounts template that Accounts belong to.

export interface AccountingScheme {
  id: number
  name: string
  code: string
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AccountingSchemeFilter {
  name?: string
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateAccountingSchemePayload {
  name: string
  code: string
  description?: string
}

export interface UpdateAccountingSchemePayload {
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

export function useAccountingSchemes() {
  const api = useApi()

  function list(filter: AccountingSchemeFilter = {}) {
    return api<PageEnvelope<AccountingScheme>>('/api/accounting-schemes', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<AccountingScheme>>(`/api/accounting-schemes/${id}`)
    return res.data
  }

  async function create(payload: CreateAccountingSchemePayload) {
    const res = await api<ApiEnvelope<AccountingScheme>>('/api/accounting-schemes', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateAccountingSchemePayload) {
    const res = await api<ApiEnvelope<AccountingScheme>>(`/api/accounting-schemes/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<AccountingScheme>>(`/api/accounting-schemes/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  return { list, get, create, update, updateStatus }
}

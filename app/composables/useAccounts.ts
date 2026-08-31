// Wraps the backend's AccountController (/api/accounts). Every account
// belongs to an AccountingScheme and may nest under a parent account.

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export interface Account {
  id: number
  schemeId: number
  schemeName: string | null
  code: string
  name: string
  type: AccountType
  parentId: number | null
  parentName: string | null
  active: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountFilter {
  schemeId?: number
  type?: AccountType
  active?: boolean
  parentId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateAccountPayload {
  schemeId: number
  code: string
  name: string
  type: AccountType
  parentId?: number
  description?: string
}

export interface UpdateAccountPayload {
  code: string
  name: string
  type: AccountType
  parentId?: number
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

export function useAccounts() {
  const api = useApi()

  function list(filter: AccountFilter = {}) {
    return api<PageEnvelope<Account>>('/api/accounts', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Account>>(`/api/accounts/${id}`)
    return res.data
  }

  async function create(payload: CreateAccountPayload) {
    const res = await api<ApiEnvelope<Account>>('/api/accounts', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateAccountPayload) {
    const res = await api<ApiEnvelope<Account>>(`/api/accounts/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<Account>>(`/api/accounts/${id}/status`, { method: 'PUT', body: { active } })
    return res.data
  }

  return { list, get, create, update, updateStatus }
}

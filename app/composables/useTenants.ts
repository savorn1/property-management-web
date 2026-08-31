// Wraps the backend's TenantController (/api/tenants).

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'

export interface Tenant {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  nationalId: string | null
  dateOfBirth: string | null
  address: string | null
  occupation: string | null
  status: TenantStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface TenantFilter {
  fullName?: string
  email?: string
  phone?: string
  status?: TenantStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface TenantPayload {
  fullName: string
  email?: string
  phone?: string
  nationalId?: string
  dateOfBirth?: string
  address?: string
  occupation?: string
  notes?: string
}

export interface TenantHistoryEntry {
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

export function useTenants() {
  const api = useApi()

  function list(filter: TenantFilter = {}) {
    return api<PageEnvelope<Tenant>>('/api/tenants', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Tenant>>(`/api/tenants/${id}`)
    return res.data
  }

  async function create(payload: TenantPayload) {
    const res = await api<ApiEnvelope<Tenant>>('/api/tenants', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: TenantPayload) {
    const res = await api<ApiEnvelope<Tenant>>(`/api/tenants/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, status: TenantStatus) {
    const res = await api<ApiEnvelope<Tenant>>(`/api/tenants/${id}/status`, { method: 'PUT', body: { status } })
    return res.data
  }

  async function history(id: number) {
    const res = await api<ApiEnvelope<TenantHistoryEntry[]>>(`/api/tenants/${id}/history`)
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/tenants/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, updateStatus, history, remove }
}

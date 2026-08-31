// Wraps the backend's SalesAgentController (/api/sales-agents). A sales agent
// is a roster entry (not a login account) referenced by property-sale records.

export interface SalesAgent {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  defaultCommissionRate: number
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SalesAgentFilter {
  fullName?: string
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface SalesAgentPayload {
  fullName: string
  email?: string
  phone?: string
  defaultCommissionRate: number
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

export function useSalesAgents() {
  const api = useApi()

  function list(filter: SalesAgentFilter = {}) {
    return api<PageEnvelope<SalesAgent>>('/api/sales-agents', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<SalesAgent>>(`/api/sales-agents/${id}`)
    return res.data
  }

  async function create(payload: SalesAgentPayload) {
    const res = await api<ApiEnvelope<SalesAgent>>('/api/sales-agents', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: SalesAgentPayload) {
    const res = await api<ApiEnvelope<SalesAgent>>(`/api/sales-agents/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<SalesAgent>>(`/api/sales-agents/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  return { list, get, create, update, updateStatus }
}

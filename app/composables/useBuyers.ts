// Wraps the backend's BuyerController (/api/buyers) — the sales-track
// counterpart to Tenant. No status field and no delete endpoint.

export interface Buyer {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  nationalId: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface BuyerFilter {
  fullName?: string
  email?: string
  phone?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface BuyerPayload {
  fullName: string
  email?: string
  phone?: string
  nationalId?: string
  address?: string
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

export function useBuyers() {
  const api = useApi()

  function list(filter: BuyerFilter = {}) {
    return api<PageEnvelope<Buyer>>('/api/buyers', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Buyer>>(`/api/buyers/${id}`)
    return res.data
  }

  async function create(payload: BuyerPayload) {
    const res = await api<ApiEnvelope<Buyer>>('/api/buyers', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: BuyerPayload) {
    const res = await api<ApiEnvelope<Buyer>>(`/api/buyers/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  return { list, get, create, update }
}

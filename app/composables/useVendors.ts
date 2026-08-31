// Wraps the backend's VendorController (/api/vendors). A vendor is an external
// company supplying spare parts or contracted maintenance services.

export interface Vendor {
  id: number
  name: string
  category: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface VendorFilter {
  name?: string
  category?: string
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface VendorPayload {
  name: string
  category?: string
  contactPerson?: string
  phone?: string
  email?: string
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

export function useVendors() {
  const api = useApi()

  function list(filter: VendorFilter = {}) {
    return api<PageEnvelope<Vendor>>('/api/vendors', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Vendor>>(`/api/vendors/${id}`)
    return res.data
  }

  async function create(payload: VendorPayload) {
    const res = await api<ApiEnvelope<Vendor>>('/api/vendors', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: VendorPayload) {
    const res = await api<ApiEnvelope<Vendor>>(`/api/vendors/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<Vendor>>(`/api/vendors/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  return { list, get, create, update, updateStatus }
}

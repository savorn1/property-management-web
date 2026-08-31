// Wraps the backend's TechnicianController (/api/technicians). A technician is
// a roster entry (not a login account) that a MaintenanceRequest can be assigned to.

export interface Technician {
  id: number
  fullName: string
  specialty: string | null
  phone: string | null
  email: string | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface TechnicianFilter {
  fullName?: string
  specialty?: string
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface TechnicianPayload {
  fullName: string
  specialty?: string
  phone?: string
  email?: string
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

export function useTechnicians() {
  const api = useApi()

  function list(filter: TechnicianFilter = {}) {
    return api<PageEnvelope<Technician>>('/api/technicians', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Technician>>(`/api/technicians/${id}`)
    return res.data
  }

  async function create(payload: TechnicianPayload) {
    const res = await api<ApiEnvelope<Technician>>('/api/technicians', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: TechnicianPayload) {
    const res = await api<ApiEnvelope<Technician>>(`/api/technicians/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<Technician>>(`/api/technicians/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  return { list, get, create, update, updateStatus }
}

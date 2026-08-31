// Wraps the backend's AmenityController (/api/amenities). An amenity is a
// reusable catalog entry (e.g. "Swimming Pool", "Gym") assigned to units via
// UnitAmenity. Unlike most catalog resources, amenities have no active/status
// field — the controller only exposes create/update/delete.

export interface Amenity {
  id: number
  name: string
  category: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface AmenityFilter {
  name?: string
  category?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface AmenityPayload {
  name: string
  category?: string
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

export function useAmenities() {
  const api = useApi()

  function list(filter: AmenityFilter = {}) {
    return api<PageEnvelope<Amenity>>('/api/amenities', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Amenity>>(`/api/amenities/${id}`)
    return res.data
  }

  async function create(payload: AmenityPayload) {
    const res = await api<ApiEnvelope<Amenity>>('/api/amenities', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: AmenityPayload) {
    const res = await api<ApiEnvelope<Amenity>>(`/api/amenities/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/amenities/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

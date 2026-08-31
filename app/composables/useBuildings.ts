// Wraps the backend's BuildingController (/api/buildings). Every building
// belongs to a property.

export interface Building {
  id: number
  propertyId: number
  propertyName: string | null
  name: string
  code: string | null
  totalFloors: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface BuildingFilter {
  propertyId?: number
  name?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateBuildingPayload {
  propertyId: number
  name: string
  code?: string
  totalFloors?: number
  description?: string
}

export interface UpdateBuildingPayload {
  name?: string
  code?: string
  totalFloors?: number
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

export function useBuildings() {
  const api = useApi()

  function list(filter: BuildingFilter = {}) {
    return api<PageEnvelope<Building>>('/api/buildings', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Building>>(`/api/buildings/${id}`)
    return res.data
  }

  async function create(payload: CreateBuildingPayload) {
    const res = await api<ApiEnvelope<Building>>('/api/buildings', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateBuildingPayload) {
    const res = await api<ApiEnvelope<Building>>(`/api/buildings/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/buildings/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

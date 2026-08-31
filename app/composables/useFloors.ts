// Wraps the backend's FloorController (/api/floors). Every floor belongs to
// a building.

export interface Floor {
  id: number
  buildingId: number
  buildingName: string | null
  floorNumber: number
  name: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface FloorFilter {
  buildingId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateFloorPayload {
  buildingId: number
  floorNumber: number
  name?: string
  description?: string
}

export interface UpdateFloorPayload {
  floorNumber: number
  name?: string
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

export function useFloors() {
  const api = useApi()

  function list(filter: FloorFilter = {}) {
    return api<PageEnvelope<Floor>>('/api/floors', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Floor>>(`/api/floors/${id}`)
    return res.data
  }

  async function create(payload: CreateFloorPayload) {
    const res = await api<ApiEnvelope<Floor>>('/api/floors', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateFloorPayload) {
    const res = await api<ApiEnvelope<Floor>>(`/api/floors/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/floors/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

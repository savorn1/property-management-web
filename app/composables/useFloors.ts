// Wraps the backend's FloorController (/api/floors). Every floor belongs to
// a building.
//
// NOTE: `status` isn't a real backend field yet — checked against the live
// backend's /v3/api-docs, which confirmed it's absent (same situation as
// BuildingStatus in useBuildings.ts, whose shape this mirrors for consistency
// even though the one status-like field verified to exist in this backend,
// Zone.active, is actually a boolean with its own PUT /status endpoint).

export type FloorStatus = 'ACTIVE' | 'UNDER_CONSTRUCTION' | 'RENOVATION' | 'INACTIVE'

export interface Floor {
  id: number
  buildingId: number
  buildingName: string | null
  floorNumber: number
  name: string | null
  description: string | null
  status: FloorStatus | null
  createdAt: string
  updatedAt: string
}

export interface FloorFilter {
  buildingId?: number
  status?: FloorStatus
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
  status?: FloorStatus
}

export interface UpdateFloorPayload {
  floorNumber: number
  name?: string
  description?: string
  status?: FloorStatus
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

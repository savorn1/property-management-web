// Wraps the backend's UnitController (/api/units). Every unit belongs to a
// unit type (which in turn belongs to a floor/building/property).

export type UnitStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'UNAVAILABLE' | 'SOLD'

export interface Unit {
  id: number
  unitTypeId: number
  unitTypeName: string | null
  floorId: number | null
  floorNumber: number | null
  buildingId: number | null
  buildingName: string | null
  propertyId: number | null
  propertyName: string | null
  unitNumber: string
  status: UnitStatus
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface UnitFilter {
  unitTypeId?: number
  status?: UnitStatus
  unitNumber?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateUnitPayload {
  unitTypeId: number
  unitNumber: string
  status?: UnitStatus
  description?: string
}

export interface UpdateUnitPayload {
  unitNumber?: string
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

export function useUnits() {
  const api = useApi()

  function list(filter: UnitFilter = {}) {
    return api<PageEnvelope<Unit>>('/api/units', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Unit>>(`/api/units/${id}`)
    return res.data
  }

  async function create(payload: CreateUnitPayload) {
    const res = await api<ApiEnvelope<Unit>>('/api/units', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateUnitPayload) {
    const res = await api<ApiEnvelope<Unit>>(`/api/units/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, status: UnitStatus) {
    const res = await api<ApiEnvelope<Unit>>(`/api/units/${id}/status`, { method: 'PUT', body: { status } })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/units/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, updateStatus, remove }
}

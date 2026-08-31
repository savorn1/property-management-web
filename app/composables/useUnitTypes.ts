// Wraps the backend's UnitTypeController (/api/unit-types). Every unit type
// belongs to a floor (e.g. "2BR Deluxe" on floor 3) and is the template units
// on that floor are created from.

export interface UnitType {
  id: number
  floorId: number
  floorNumber: number | null
  buildingId: number | null
  buildingName: string | null
  name: string
  bedrooms: number | null
  bathrooms: number | null
  areaSqft: number | null
  basePrice: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface UnitTypeFilter {
  floorId?: number
  name?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateUnitTypePayload {
  floorId: number
  name: string
  bedrooms?: number
  bathrooms?: number
  areaSqft?: number
  basePrice?: number
  description?: string
}

export interface UpdateUnitTypePayload {
  name?: string
  bedrooms?: number
  bathrooms?: number
  areaSqft?: number
  basePrice?: number
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

export function useUnitTypes() {
  const api = useApi()

  function list(filter: UnitTypeFilter = {}) {
    return api<PageEnvelope<UnitType>>('/api/unit-types', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<UnitType>>(`/api/unit-types/${id}`)
    return res.data
  }

  async function create(payload: CreateUnitTypePayload) {
    const res = await api<ApiEnvelope<UnitType>>('/api/unit-types', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateUnitTypePayload) {
    const res = await api<ApiEnvelope<UnitType>>(`/api/unit-types/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/unit-types/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

// Wraps the backend's (planned) StreetController (/api/streets). A street
// belongs to a zone and is, in turn, referenced by Plot.streetId (see
// usePlots.ts) — the level between Zone and Plot in the property hierarchy.
//
// NOTE: as of this writing the backend has no StreetController yet — every
// call below will 404 until that's added there. Written to the same shape as
// every other entity in this app (see useBuildings.ts) so the frontend is
// ready the moment the backend catches up.

// Mirrors BuildingStatus exactly (ACTIVE/UNDER_CONSTRUCTION/RENOVATION/
// INACTIVE already have colors registered in StatusBadge) — a street's own
// lifecycle (open, being built, being resurfaced, closed) maps the same way.
export type StreetStatus = 'ACTIVE' | 'UNDER_CONSTRUCTION' | 'RENOVATION' | 'INACTIVE'
export type SurfaceType = 'ASPHALT' | 'CONCRETE' | 'GRAVEL' | 'DIRT' | 'PAVED_BLOCK'

export interface Street {
  id: number
  zoneId: number
  zoneName: string | null
  code: string | null
  name: string
  width: number | null
  length: number | null
  area: number | null
  surfaceType: SurfaceType | null
  status: StreetStatus | null
  createdAt: string
  updatedAt: string
}

export interface StreetFilter {
  zoneId?: number
  name?: string
  status?: StreetStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateStreetPayload {
  zoneId: number
  code?: string
  name: string
  width?: number
  length?: number
  area?: number
  surfaceType?: SurfaceType
  status?: StreetStatus
}

export interface UpdateStreetPayload {
  code?: string
  name?: string
  width?: number
  length?: number
  area?: number
  surfaceType?: SurfaceType
  status?: StreetStatus
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

export function useStreets() {
  const api = useApi()

  function list(filter: StreetFilter = {}) {
    return api<PageEnvelope<Street>>('/api/streets', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Street>>(`/api/streets/${id}`)
    return res.data
  }

  async function create(payload: CreateStreetPayload) {
    const res = await api<ApiEnvelope<Street>>('/api/streets', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateStreetPayload) {
    const res = await api<ApiEnvelope<Street>>(`/api/streets/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/streets/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

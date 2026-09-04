// Wraps the backend's ZoneController (/api/zones). A zone is a sub-division
// within a Property (e.g. "Zone A", "Phase 2") — the level between Property
// and Street: Property -> Zone -> Street -> Plot -> Building -> Floor ->
// Unit. The controller exposes both a status toggle and a real delete endpoint.

export interface Zone {
  id: number
  propertyId: number | null
  propertyName: string | null
  name: string
  code: string | null
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ZoneFilter {
  propertyId?: number
  name?: string
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateZonePayload {
  propertyId: number
  name: string
  code?: string
  description?: string
}

export interface UpdateZonePayload {
  name: string
  code?: string
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

export function useZones() {
  const api = useApi()

  function list(filter: ZoneFilter = {}) {
    return api<PageEnvelope<Zone>>('/api/zones', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Zone>>(`/api/zones/${id}`)
    return res.data
  }

  async function create(payload: CreateZonePayload) {
    const res = await api<ApiEnvelope<Zone>>('/api/zones', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateZonePayload) {
    const res = await api<ApiEnvelope<Zone>>(`/api/zones/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<Zone>>(`/api/zones/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/zones/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, updateStatus, remove }
}

// Wraps the backend's PropertyController (/api/properties). Properties are
// the top of the rentals hierarchy: Property -> Building -> Floor -> UnitType -> Unit.
// Field shapes here (including `type` and `zoneId`) are verified against the
// live backend's /v3/api-docs, not guessed.

export type PropertyType =
  | 'APARTMENT'
  | 'CONDOMINIUM'
  | 'OFFICE'
  | 'SHOPPING_MALL'
  | 'WAREHOUSE'
  | 'VILLA'
  | 'HOUSE'
  | 'LAND'
  | 'MIXED_USE'

export interface PropertyItem {
  id: number
  name: string
  code: string | null
  type: PropertyType | null
  zoneId: number | null
  zoneName: string | null
  address: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface PropertyFilter {
  name?: string
  code?: string
  city?: string
  type?: PropertyType
  zoneId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface PropertyPayload {
  name: string
  type: PropertyType
  code?: string
  zoneId?: number
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
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

export function useProperties() {
  const api = useApi()

  function list(filter: PropertyFilter = {}) {
    return api<PageEnvelope<PropertyItem>>('/api/properties', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<PropertyItem>>(`/api/properties/${id}`)
    return res.data
  }

  async function create(payload: PropertyPayload) {
    const res = await api<ApiEnvelope<PropertyItem>>('/api/properties', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: PropertyPayload) {
    const res = await api<ApiEnvelope<PropertyItem>>(`/api/properties/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/properties/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

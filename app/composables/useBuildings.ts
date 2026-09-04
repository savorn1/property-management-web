// Wraps the backend's BuildingController (/api/buildings). Every building's
// one true parent is a Plot (Property -> Zone -> Street -> Plot -> Building
// -> Floor -> Unit); propertyId/propertyName are derived transitively
// through the plot and included read-only for display and filtering.

export type BuildingStatus = 'ACTIVE' | 'UNDER_CONSTRUCTION' | 'RENOVATION' | 'INACTIVE'

export interface Building {
  id: number
  plotId: number | null
  plotNumber: string | null
  propertyId: number | null
  propertyName: string | null
  name: string
  code: string | null
  totalFloors: number | null
  description: string | null
  status: BuildingStatus | null
  createdAt: string
  updatedAt: string
}

export interface BuildingFilter {
  plotId?: number
  propertyId?: number
  name?: string
  status?: BuildingStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateBuildingPayload {
  plotId: number
  name: string
  code?: string
  totalFloors?: number
  description?: string
  status?: BuildingStatus
}

export interface UpdateBuildingPayload {
  name?: string
  code?: string
  totalFloors?: number
  description?: string
  status?: BuildingStatus
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

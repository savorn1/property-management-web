// Wraps the backend's ParkingSpotController (/api/parking-spots). A parking
// spot belongs to a Building (not directly to a Property).

export type ParkingSpotType = 'STANDARD' | 'COMPACT' | 'HANDICAP' | 'VISITOR' | 'MOTORCYCLE'
export type ParkingSpotStatus = 'AVAILABLE' | 'ASSIGNED' | 'RESERVED' | 'MAINTENANCE' | 'UNAVAILABLE'

export interface ParkingSpot {
  id: number
  buildingId: number
  buildingName: string | null
  propertyName: string | null
  spotNumber: string
  type: ParkingSpotType
  status: ParkingSpotStatus
  monthlyFee: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ParkingSpotFilter {
  buildingId?: number
  type?: ParkingSpotType
  status?: ParkingSpotStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateParkingSpotPayload {
  buildingId: number
  spotNumber: string
  type: ParkingSpotType
  monthlyFee?: number
  description?: string
}

export interface UpdateParkingSpotPayload {
  spotNumber: string
  type: ParkingSpotType
  monthlyFee?: number
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

export function useParkingSpots() {
  const api = useApi()

  function list(filter: ParkingSpotFilter = {}) {
    return api<PageEnvelope<ParkingSpot>>('/api/parking-spots', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<ParkingSpot>>(`/api/parking-spots/${id}`)
    return res.data
  }

  async function create(payload: CreateParkingSpotPayload) {
    const res = await api<ApiEnvelope<ParkingSpot>>('/api/parking-spots', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateParkingSpotPayload) {
    const res = await api<ApiEnvelope<ParkingSpot>>(`/api/parking-spots/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, status: ParkingSpotStatus) {
    const res = await api<ApiEnvelope<ParkingSpot>>(`/api/parking-spots/${id}/status`, {
      method: 'PUT',
      body: { status }
    })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/parking-spots/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, updateStatus, remove }
}

// Wraps the backend's ParkingAssignmentController (/api/parking-assignments).
// An assignment links a parking spot to a Unit (not directly to a tenant or
// lease). No update endpoint — only create and end (ACTIVE -> ENDED).

export type ParkingAssignmentStatus = 'ACTIVE' | 'ENDED'

export interface ParkingAssignment {
  id: number
  parkingSpotId: number
  spotNumber: string | null
  unitId: number
  unitNumber: string | null
  startDate: string
  endDate: string | null
  status: ParkingAssignmentStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ParkingAssignmentFilter {
  parkingSpotId?: number
  unitId?: number
  status?: ParkingAssignmentStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateParkingAssignmentPayload {
  parkingSpotId: number
  unitId: number
  startDate: string
  endDate?: string
  notes?: string
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

export function useParkingAssignments() {
  const api = useApi()

  function list(filter: ParkingAssignmentFilter = {}) {
    return api<PageEnvelope<ParkingAssignment>>('/api/parking-assignments', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<ParkingAssignment>>(`/api/parking-assignments/${id}`)
    return res.data
  }

  async function create(payload: CreateParkingAssignmentPayload) {
    const res = await api<ApiEnvelope<ParkingAssignment>>('/api/parking-assignments', {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function end(id: number) {
    const res = await api<ApiEnvelope<ParkingAssignment>>(`/api/parking-assignments/${id}/end`, { method: 'PUT' })
    return res.data
  }

  return { list, get, create, end }
}

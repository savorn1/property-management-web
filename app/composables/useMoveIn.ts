// Wraps the backend's MoveInController (/api/move-in-requests). A lease-scoped
// workflow: request -> approve/reject -> record inspection + key handovers ->
// complete. Reads are open to any authenticated user; writes are ADMIN-only.

export type MoveInStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type InspectionCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'

export interface MoveInRequest {
  id: number
  leaseId: number
  tenantId: number
  tenantName: string | null
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  requestedMoveInDate: string
  status: MoveInStatus
  rejectionReason: string | null
  notes: string | null
  hasInspection: boolean
  keyHandoverCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MoveInFilter {
  leaseId?: number
  status?: MoveInStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateMoveInPayload {
  leaseId: number
  requestedMoveInDate: string
  notes?: string
}

export interface MoveInInspection {
  id: number
  moveInRequestId: number
  inspectionDate: string
  inspectedBy: string
  condition: InspectionCondition
  notes: string | null
  createdAt: string
}

export interface CreateInspectionPayload {
  inspectionDate: string
  inspectedBy: string
  condition: InspectionCondition
  notes?: string
}

export interface KeyHandover {
  id: number
  moveInRequestId: number
  keyType: string
  quantity: number
  handoverDate: string
  handedOverBy: string
  returned: boolean
  returnedDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateKeyHandoverPayload {
  keyType: string
  quantity: number
  handoverDate: string
  handedOverBy: string
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

export function useMoveIn() {
  const api = useApi()

  function list(filter: MoveInFilter = {}) {
    return api<PageEnvelope<MoveInRequest>>('/api/move-in-requests', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<MoveInRequest>>(`/api/move-in-requests/${id}`)
    return res.data
  }

  async function create(payload: CreateMoveInPayload) {
    const res = await api<ApiEnvelope<MoveInRequest>>('/api/move-in-requests', { method: 'POST', body: payload })
    return res.data
  }

  async function approve(id: number) {
    const res = await api<ApiEnvelope<MoveInRequest>>(`/api/move-in-requests/${id}/approve`, { method: 'PUT' })
    return res.data
  }

  async function reject(id: number, reason?: string) {
    const res = await api<ApiEnvelope<MoveInRequest>>(`/api/move-in-requests/${id}/reject`, {
      method: 'PUT',
      body: reason ? { reason } : undefined
    })
    return res.data
  }

  async function complete(id: number) {
    const res = await api<ApiEnvelope<MoveInRequest>>(`/api/move-in-requests/${id}/complete`, { method: 'PUT' })
    return res.data
  }

  async function getInspection(id: number) {
    const res = await api<ApiEnvelope<MoveInInspection>>(`/api/move-in-requests/${id}/inspection`)
    return res.data
  }

  async function recordInspection(id: number, payload: CreateInspectionPayload) {
    const res = await api<ApiEnvelope<MoveInInspection>>(`/api/move-in-requests/${id}/inspection`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function getKeyHandovers(id: number) {
    const res = await api<ApiEnvelope<KeyHandover[]>>(`/api/move-in-requests/${id}/keys`)
    return res.data
  }

  async function recordKeyHandover(id: number, payload: CreateKeyHandoverPayload) {
    const res = await api<ApiEnvelope<KeyHandover>>(`/api/move-in-requests/${id}/keys`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function returnKey(id: number, keyId: number) {
    const res = await api<ApiEnvelope<KeyHandover>>(`/api/move-in-requests/${id}/keys/${keyId}/return`, {
      method: 'PUT'
    })
    return res.data
  }

  return {
    list,
    get,
    create,
    approve,
    reject,
    complete,
    getInspection,
    recordInspection,
    getKeyHandovers,
    recordKeyHandover,
    returnKey
  }
}

// Wraps the backend's MoveOutController (/api/move-out-requests). A
// lease-scoped workflow: request -> approve/reject -> inspection -> damage
// charges -> deposit settlement -> unit release. Reads are open to any
// authenticated user; writes are ADMIN-only.

export type MoveOutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type SettlementStatus = 'PENDING' | 'SETTLED'

export interface MoveOutRequest {
  id: number
  leaseId: number
  tenantId: number
  tenantName: string | null
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  requestedMoveOutDate: string
  reason: string | null
  status: MoveOutStatus
  rejectionReason: string | null
  notes: string | null
  hasInspection: boolean
  totalDamageCharges: number | null
  hasSettlement: boolean
  refundAmount: number | null
  unitReleased: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MoveOutFilter {
  leaseId?: number
  status?: MoveOutStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateMoveOutPayload {
  leaseId: number
  requestedMoveOutDate: string
  reason?: string
  notes?: string
}

export interface DamageCharge {
  id: number
  moveOutInspectionId: number
  description: string
  amount: number
  createdAt: string
}

export interface CreateDamageChargePayload {
  description: string
  amount: number
}

export interface MoveOutInspection {
  id: number
  moveOutRequestId: number
  inspectionDate: string
  inspectedBy: string
  condition: string
  notes: string | null
  totalDamageCharges: number
  damageCharges: DamageCharge[]
  createdAt: string
}

export interface CreateInspectionPayload {
  inspectionDate: string
  inspectedBy: string
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  notes?: string
}

export interface DepositSettlement {
  id: number
  moveOutRequestId: number
  depositAmount: number
  totalDamageCharges: number
  otherDeductions: number
  refundAmount: number
  status: SettlementStatus
  notes: string | null
  settledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSettlementPayload {
  otherDeductions?: number
  notes?: string
}

export interface UnitRelease {
  id: number
  moveOutRequestId: number
  unitId: number
  unitNumber: string | null
  releaseDate: string
  releasedBy: string | null
  notes: string | null
  createdAt: string
}

export interface ReleaseUnitPayload {
  releaseDate?: string
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

export function useMoveOut() {
  const api = useApi()

  function list(filter: MoveOutFilter = {}) {
    return api<PageEnvelope<MoveOutRequest>>('/api/move-out-requests', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<MoveOutRequest>>(`/api/move-out-requests/${id}`)
    return res.data
  }

  async function create(payload: CreateMoveOutPayload) {
    const res = await api<ApiEnvelope<MoveOutRequest>>('/api/move-out-requests', { method: 'POST', body: payload })
    return res.data
  }

  async function approve(id: number) {
    const res = await api<ApiEnvelope<MoveOutRequest>>(`/api/move-out-requests/${id}/approve`, { method: 'PUT' })
    return res.data
  }

  async function reject(id: number, reason?: string) {
    const res = await api<ApiEnvelope<MoveOutRequest>>(`/api/move-out-requests/${id}/reject`, {
      method: 'PUT',
      body: reason ? { reason } : undefined
    })
    return res.data
  }

  async function getInspection(id: number) {
    const res = await api<ApiEnvelope<MoveOutInspection>>(`/api/move-out-requests/${id}/inspection`)
    return res.data
  }

  async function recordInspection(id: number, payload: CreateInspectionPayload) {
    const res = await api<ApiEnvelope<MoveOutInspection>>(`/api/move-out-requests/${id}/inspection`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function addDamageCharge(id: number, payload: CreateDamageChargePayload) {
    const res = await api<ApiEnvelope<DamageCharge>>(`/api/move-out-requests/${id}/damage-charges`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function getSettlement(id: number) {
    const res = await api<ApiEnvelope<DepositSettlement>>(`/api/move-out-requests/${id}/settlement`)
    return res.data
  }

  async function createSettlement(id: number, payload: CreateSettlementPayload = {}) {
    const res = await api<ApiEnvelope<DepositSettlement>>(`/api/move-out-requests/${id}/settlement`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function settleDeposit(id: number) {
    const res = await api<ApiEnvelope<DepositSettlement>>(`/api/move-out-requests/${id}/settlement/settle`, {
      method: 'PUT'
    })
    return res.data
  }

  async function getUnitRelease(id: number) {
    const res = await api<ApiEnvelope<UnitRelease>>(`/api/move-out-requests/${id}/release`)
    return res.data
  }

  async function releaseUnit(id: number, payload: ReleaseUnitPayload = {}) {
    const res = await api<ApiEnvelope<UnitRelease>>(`/api/move-out-requests/${id}/release`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return {
    list,
    get,
    create,
    approve,
    reject,
    getInspection,
    recordInspection,
    addDamageCharge,
    getSettlement,
    createSettlement,
    settleDeposit,
    getUnitRelease,
    releaseUnit
  }
}

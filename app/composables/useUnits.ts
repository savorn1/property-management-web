// Wraps the backend's UnitController (/api/units). Every unit belongs to a
// unit type (which in turn belongs to a floor/building/property).
//
// Status is three independent dimensions — occupancy, sale, and maintenance —
// each with its own PUT endpoint and optional `reason`.
//
// NOTE: only occupancy-status and sale-status are confirmed against the live
// backend's /v3/api-docs, and only with a different value set than used here
// (occupancy also had RESERVED/UNAVAILABLE; sale used FOR_SALE, not
// AVAILABLE). This file was deliberately moved ahead of that verified
// contract onto a newer 3-axis model — maintenance-status doesn't exist on
// the backend at all yet. Until the backend is redesigned to match, calls
// here will either 404 (maintenance-status) or be rejected for an unknown
// enum value (sale-status's AVAILABLE).

export type OccupancyStatus = 'VACANT' | 'OCCUPIED'
export type SaleStatus = 'NOT_FOR_SALE' | 'AVAILABLE' | 'RESERVED' | 'SOLD'
export type UnitMaintenanceStatus = 'NORMAL' | 'MAINTENANCE'

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
  name: string | null
  occupancyStatus: OccupancyStatus | null
  saleStatus: SaleStatus | null
  maintenanceStatus: UnitMaintenanceStatus | null
  kitchen: boolean | null
  balcony: boolean | null
  furnished: boolean | null
  view: string | null
  orientation: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface UnitFilter {
  unitTypeId?: number
  occupancyStatus?: OccupancyStatus
  saleStatus?: SaleStatus
  maintenanceStatus?: UnitMaintenanceStatus
  unitNumber?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateUnitPayload {
  unitTypeId: number
  unitNumber: string
  name?: string
  occupancyStatus?: OccupancyStatus
  saleStatus?: SaleStatus
  maintenanceStatus?: UnitMaintenanceStatus
  kitchen?: boolean
  balcony?: boolean
  furnished?: boolean
  view?: string
  orientation?: string
  description?: string
}

// No status fields here — those only change through their own dedicated
// endpoints below, not the general update.
export interface UpdateUnitPayload {
  unitNumber?: string
  name?: string
  kitchen?: boolean
  balcony?: boolean
  furnished?: boolean
  view?: string
  orientation?: string
  description?: string
}

export interface UpdateOccupancyStatusPayload {
  occupancyStatus: OccupancyStatus
  reason?: string
}

export interface UpdateSaleStatusPayload {
  saleStatus: SaleStatus
  reason?: string
}

export interface UpdateUnitMaintenanceStatusPayload {
  maintenanceStatus: UnitMaintenanceStatus
  reason?: string
}

export interface UnitStatusHistoryEntry {
  id: number
  unitId: number
  statusField: string
  previousStatus: string | null
  newStatus: string
  reason: string | null
  changedBy: string | null
  createdAt: string
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

  async function updateOccupancyStatus(id: number, payload: UpdateOccupancyStatusPayload) {
    const res = await api<ApiEnvelope<Unit>>(`/api/units/${id}/occupancy-status`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateSaleStatus(id: number, payload: UpdateSaleStatusPayload) {
    const res = await api<ApiEnvelope<Unit>>(`/api/units/${id}/sale-status`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateMaintenanceStatus(id: number, payload: UpdateUnitMaintenanceStatusPayload) {
    const res = await api<ApiEnvelope<Unit>>(`/api/units/${id}/maintenance-status`, { method: 'PUT', body: payload })
    return res.data
  }

  async function getStatusHistory(id: number) {
    const res = await api<ApiEnvelope<UnitStatusHistoryEntry[]>>(`/api/units/${id}/status-history`)
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/units/${id}`, { method: 'DELETE' })
  }

  return {
    list,
    get,
    create,
    update,
    updateOccupancyStatus,
    updateSaleStatus,
    updateMaintenanceStatus,
    getStatusHistory,
    remove
  }
}

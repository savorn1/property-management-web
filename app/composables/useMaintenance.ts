// Wraps the backend's MaintenanceController (/api/maintenance-requests). A
// maintenance request doubles as its own "work order": technician/schedule/cost
// fields are populated in place as it moves through its lifecycle rather than
// spawning a separate work-order record. Sub-resources (costs, spare-part usage)
// live in their own composables — see useMaintenanceCosts / useSparePartUsage.

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type MaintenanceStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface MaintenanceRequestItem {
  id: number
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  tenantId: number | null
  tenantName: string | null
  title: string
  description: string | null
  priority: MaintenancePriority
  status: MaintenanceStatus
  technicianId: number | null
  technicianName: string | null
  technicianContact: string | null
  scheduledDate: string | null
  completedAt: string | null
  estimatedCost: number | null
  actualCost: number | null
  completionNotes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MaintenanceHistoryEntry {
  id: number
  action: 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'COST_UPDATED'
  description: string | null
  performedBy: string | null
  createdAt: string
}

export interface MaintenanceFilter {
  unitId?: number
  tenantId?: number
  status?: MaintenanceStatus
  priority?: MaintenancePriority
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateMaintenancePayload {
  unitId: number
  tenantId?: number
  title: string
  description?: string
  priority: MaintenancePriority
  estimatedCost?: number
}

export interface AssignTechnicianPayload {
  // When set, technicianName/technicianContact are ignored server-side and
  // populated from the roster entry instead. Leave unset to assign a
  // one-off/external technician not in the roster, using the free-text fields.
  technicianId?: number
  technicianName?: string
  technicianContact?: string
  scheduledDate?: string
}

export interface UpdateMaintenanceStatusPayload {
  status: MaintenanceStatus
  completionNotes?: string
}

export interface UpdateMaintenanceCostPayload {
  estimatedCost?: number
  actualCost?: number
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

export function useMaintenance() {
  const api = useApi()

  function list(filter: MaintenanceFilter = {}) {
    return api<PageEnvelope<MaintenanceRequestItem>>('/api/maintenance-requests', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<MaintenanceRequestItem>>(`/api/maintenance-requests/${id}`)
    return res.data
  }

  async function create(payload: CreateMaintenancePayload) {
    const res = await api<ApiEnvelope<MaintenanceRequestItem>>('/api/maintenance-requests', {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function assign(id: number, payload: AssignTechnicianPayload) {
    const res = await api<ApiEnvelope<MaintenanceRequestItem>>(`/api/maintenance-requests/${id}/assign`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function updateStatus(id: number, payload: UpdateMaintenanceStatusPayload) {
    const res = await api<ApiEnvelope<MaintenanceRequestItem>>(`/api/maintenance-requests/${id}/status`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function updateCost(id: number, payload: UpdateMaintenanceCostPayload) {
    const res = await api<ApiEnvelope<MaintenanceRequestItem>>(`/api/maintenance-requests/${id}/cost`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function history(id: number) {
    const res = await api<ApiEnvelope<MaintenanceHistoryEntry[]>>(`/api/maintenance-requests/${id}/history`)
    return res.data
  }

  return { list, get, create, assign, updateStatus, updateCost, history }
}

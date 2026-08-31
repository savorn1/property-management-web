// Wraps the backend's MaintenanceCostController
// (/api/maintenance-requests/{requestId}/costs). An itemized cost line against a
// maintenance request — LABOR/VENDOR_SERVICE/OTHER are entered directly here;
// PARTS entries are created automatically when spare-part usage is recorded
// (see useSparePartUsage), not through this endpoint. This is the itemized
// detail behind the request's flat estimatedCost/actualCost summary fields.

export type MaintenanceCostType = 'LABOR' | 'PARTS' | 'VENDOR_SERVICE' | 'OTHER'

export interface MaintenanceCost {
  id: number
  maintenanceRequestId: number
  type: MaintenanceCostType
  description: string | null
  amount: number
  vendorId: number | null
  vendorName: string | null
  costDate: string
  recordedBy: string | null
  createdAt: string
}

export interface CreateMaintenanceCostPayload {
  type: MaintenanceCostType
  description?: string
  amount: number
  vendorId?: number
  costDate: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useMaintenanceCosts() {
  const api = useApi()

  async function list(requestId: number) {
    const res = await api<ApiEnvelope<MaintenanceCost[]>>(`/api/maintenance-requests/${requestId}/costs`)
    return res.data
  }

  async function create(requestId: number, payload: CreateMaintenanceCostPayload) {
    const res = await api<ApiEnvelope<MaintenanceCost>>(`/api/maintenance-requests/${requestId}/costs`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, create }
}

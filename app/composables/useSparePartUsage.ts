// Wraps the backend's SparePartUsageController
// (/api/maintenance-requests/{requestId}/parts-usage). Recording usage here
// decrements the spare part's quantityOnHand and creates a matching PARTS line
// in useMaintenanceCosts automatically — this endpoint is the only way to
// consume stock against a maintenance request.

export interface SparePartUsageEntry {
  id: number
  maintenanceRequestId: number
  sparePartId: number
  sparePartName: string | null
  quantity: number
  unitCost: number
  totalCost: number
  usedDate: string
  notes: string | null
  createdAt: string
}

export interface CreateSparePartUsagePayload {
  sparePartId: number
  quantity: number
  // Optional override — defaults to the spare part's current unitCost when omitted.
  unitCost?: number
  usedDate: string
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useSparePartUsage() {
  const api = useApi()

  async function list(requestId: number) {
    const res = await api<ApiEnvelope<SparePartUsageEntry[]>>(`/api/maintenance-requests/${requestId}/parts-usage`)
    return res.data
  }

  async function create(requestId: number, payload: CreateSparePartUsagePayload) {
    const res = await api<ApiEnvelope<SparePartUsageEntry>>(`/api/maintenance-requests/${requestId}/parts-usage`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, create }
}

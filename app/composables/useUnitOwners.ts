// Wraps the backend's UnitOwnerController (/api/units/{unitId}/owners). The
// ownership registry/history for a unit — a null ownershipEndDate means the
// record is the current owner. Populated automatically by the sales module's
// OwnershipTransfer flow, or entered/ended manually here for owners that
// predate this system.

export interface UnitOwner {
  id: number
  unitId: number
  buyerId: number | null
  ownerName: string
  ownerContact: string | null
  ownershipStartDate: string
  ownershipEndDate: string | null
  current: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateUnitOwnerPayload {
  ownerName: string
  ownerContact?: string
  ownershipStartDate: string
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useUnitOwners() {
  const api = useApi()

  async function list(unitId: number) {
    const res = await api<ApiEnvelope<UnitOwner[]>>(`/api/units/${unitId}/owners`)
    return res.data
  }

  async function getCurrent(unitId: number) {
    const res = await api<ApiEnvelope<UnitOwner>>(`/api/units/${unitId}/owners/current`)
    return res.data
  }

  async function create(unitId: number, payload: CreateUnitOwnerPayload) {
    const res = await api<ApiEnvelope<UnitOwner>>(`/api/units/${unitId}/owners`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function end(unitId: number, ownerId: number, endDate?: string) {
    const res = await api<ApiEnvelope<UnitOwner>>(`/api/units/${unitId}/owners/${ownerId}/end`, {
      method: 'PUT',
      query: endDate ? { endDate } : undefined
    })
    return res.data
  }

  return { list, getCurrent, create, end }
}

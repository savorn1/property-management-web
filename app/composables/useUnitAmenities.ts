// Wraps the backend's UnitAmenityController (/api/units/{unitId}/amenities).
// A simple join between a Unit and the Amenity catalog (see useAmenities) —
// list what's assigned, assign one by amenityId, remove one by the join
// record's own id (not the amenityId).

export interface UnitAmenity {
  id: number
  unitId: number
  amenityId: number
  amenityName: string
  amenityCategory: string | null
  notes: string | null
  createdAt: string
}

export interface AssignUnitAmenityPayload {
  amenityId: number
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useUnitAmenities() {
  const api = useApi()

  async function list(unitId: number) {
    const res = await api<ApiEnvelope<UnitAmenity[]>>(`/api/units/${unitId}/amenities`)
    return res.data
  }

  async function assign(unitId: number, payload: AssignUnitAmenityPayload) {
    const res = await api<ApiEnvelope<UnitAmenity>>(`/api/units/${unitId}/amenities`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function remove(unitId: number, unitAmenityId: number) {
    await api(`/api/units/${unitId}/amenities/${unitAmenityId}`, { method: 'DELETE' })
  }

  return { list, assign, remove }
}

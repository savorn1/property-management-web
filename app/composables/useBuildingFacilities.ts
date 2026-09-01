// Wraps the backend's BuildingFacilityController
// (/api/buildings/{buildingId}/facilities) — mirrors useUnitAmenities.ts but
// scoped to a Building rather than a Unit. Shares the same Amenity catalog
// (see useAmenities) as the reusable list of assignable items; a "facility"
// is just an amenity assigned at the building level instead of (or in
// addition to) the unit level, distinct from a unit's own UnitAmenity rows.

export interface BuildingFacility {
  id: number
  buildingId: number
  amenityId: number
  amenityName: string
  amenityCategory: string | null
  notes: string | null
  createdAt: string
}

export interface AssignBuildingFacilityPayload {
  amenityId: number
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useBuildingFacilities() {
  const api = useApi()

  async function list(buildingId: number) {
    const res = await api<ApiEnvelope<BuildingFacility[]>>(`/api/buildings/${buildingId}/facilities`)
    return res.data
  }

  async function assign(buildingId: number, payload: AssignBuildingFacilityPayload) {
    const res = await api<ApiEnvelope<BuildingFacility>>(`/api/buildings/${buildingId}/facilities`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function remove(buildingId: number, buildingFacilityId: number) {
    await api(`/api/buildings/${buildingId}/facilities/${buildingFacilityId}`, { method: 'DELETE' })
  }

  return { list, assign, remove }
}

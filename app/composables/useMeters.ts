// Wraps the backend's MeterController (/api/meters). A meter belongs to a
// Unit. The consumption endpoint (previous vs. current reading) lives here
// too since it's meter-scoped, even though readings themselves are recorded
// through useMeterReadings.

export type MeterType = 'ELECTRICITY' | 'WATER' | 'GAS'

export interface Meter {
  id: number
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  meterType: MeterType
  meterNumber: string
  unitOfMeasure: string
  active: boolean
  installedDate: string | null
  createdAt: string
  updatedAt: string
}

export interface MeterFilter {
  unitId?: number
  meterType?: MeterType
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateMeterPayload {
  unitId: number
  meterType: MeterType
  meterNumber: string
  unitOfMeasure: string
  installedDate?: string
}

export interface UpdateMeterPayload {
  meterNumber: string
  unitOfMeasure: string
  installedDate?: string
}

export interface ConsumptionInfo {
  meterId: number
  meterNumber: string | null
  unitOfMeasure: string | null
  previousReadingId: number | null
  previousReadingDate: string | null
  previousReadingValue: number | null
  currentReadingId: number | null
  currentReadingDate: string | null
  currentReadingValue: number | null
  consumption: number | null
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

export function useMeters() {
  const api = useApi()

  function list(filter: MeterFilter = {}) {
    return api<PageEnvelope<Meter>>('/api/meters', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Meter>>(`/api/meters/${id}`)
    return res.data
  }

  async function consumption(id: number) {
    const res = await api<ApiEnvelope<ConsumptionInfo>>(`/api/meters/${id}/consumption`)
    return res.data
  }

  async function create(payload: CreateMeterPayload) {
    const res = await api<ApiEnvelope<Meter>>('/api/meters', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateMeterPayload) {
    const res = await api<ApiEnvelope<Meter>>(`/api/meters/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<Meter>>(`/api/meters/${id}/status`, { method: 'PUT', body: { active } })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/meters/${id}`, { method: 'DELETE' })
  }

  return { list, get, consumption, create, update, updateStatus, remove }
}

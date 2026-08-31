// Wraps the backend's MeterReadingController (/api/meter-readings). A
// top-level, filterable resource (not nested under /api/meters/{id}) — filter
// by meterId to get one meter's history.

export interface MeterReading {
  id: number
  meterId: number
  meterNumber: string | null
  readingDate: string
  readingValue: number
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface MeterReadingFilter {
  meterId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateMeterReadingPayload {
  meterId: number
  readingDate: string
  readingValue: number
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

export function useMeterReadings() {
  const api = useApi()

  function list(filter: MeterReadingFilter = {}) {
    return api<PageEnvelope<MeterReading>>('/api/meter-readings', { query: filter })
  }

  async function create(payload: CreateMeterReadingPayload) {
    const res = await api<ApiEnvelope<MeterReading>>('/api/meter-readings', { method: 'POST', body: payload })
    return res.data
  }

  return { list, create }
}

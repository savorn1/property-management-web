// Wraps the backend's FinancialPeriodController (/api/financial-periods).
// No update/delete — periods are only ever created, then closed or reopened.

export type FinancialPeriodStatus = 'OPEN' | 'CLOSED'

export interface FinancialPeriod {
  id: number
  name: string
  startDate: string
  endDate: string
  status: FinancialPeriodStatus
  closedAt: string | null
  closedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface FinancialPeriodFilter {
  status?: FinancialPeriodStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateFinancialPeriodPayload {
  name: string
  startDate: string
  endDate: string
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

export function useFinancialPeriods() {
  const api = useApi()

  function list(filter: FinancialPeriodFilter = {}) {
    return api<PageEnvelope<FinancialPeriod>>('/api/financial-periods', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<FinancialPeriod>>(`/api/financial-periods/${id}`)
    return res.data
  }

  async function create(payload: CreateFinancialPeriodPayload) {
    const res = await api<ApiEnvelope<FinancialPeriod>>('/api/financial-periods', { method: 'POST', body: payload })
    return res.data
  }

  async function close(id: number) {
    const res = await api<ApiEnvelope<FinancialPeriod>>(`/api/financial-periods/${id}/close`, { method: 'PUT' })
    return res.data
  }

  async function reopen(id: number) {
    const res = await api<ApiEnvelope<FinancialPeriod>>(`/api/financial-periods/${id}/reopen`, { method: 'PUT' })
    return res.data
  }

  return { list, get, create, close, reopen }
}

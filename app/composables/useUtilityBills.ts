// Wraps the backend's UtilityBillController (/api/utility-bills). A bill is
// scoped to a Meter, not a Lease/Unit directly — creating one only takes a
// meterId + ratePerUnit; the backend derives the billing period, previous/
// current readings, and consumption from the meter's two most recent
// readings. No update or delete endpoint exists, only status (PENDING/PAID).

export type UtilityBillStatus = 'PENDING' | 'PAID'

export interface UtilityBill {
  id: number
  meterId: number
  meterNumber: string | null
  meterType: string | null
  unitId: number | null
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  billingPeriodStart: string
  billingPeriodEnd: string
  previousReadingValue: number
  currentReadingValue: number
  consumption: number
  unitOfMeasure: string | null
  ratePerUnit: number
  totalAmount: number
  status: UtilityBillStatus
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UtilityBillFilter {
  meterId?: number
  status?: UtilityBillStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateUtilityBillPayload {
  meterId: number
  ratePerUnit: number
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

export function useUtilityBills() {
  const api = useApi()

  function list(filter: UtilityBillFilter = {}) {
    return api<PageEnvelope<UtilityBill>>('/api/utility-bills', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<UtilityBill>>(`/api/utility-bills/${id}`)
    return res.data
  }

  async function create(payload: CreateUtilityBillPayload) {
    const res = await api<ApiEnvelope<UtilityBill>>('/api/utility-bills', { method: 'POST', body: payload })
    return res.data
  }

  async function updateStatus(id: number, status: UtilityBillStatus) {
    const res = await api<ApiEnvelope<UtilityBill>>(`/api/utility-bills/${id}/status`, {
      method: 'PUT',
      body: { status }
    })
    return res.data
  }

  return { list, get, create, updateStatus }
}

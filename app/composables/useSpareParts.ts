// Wraps the backend's SparePartController (/api/spare-parts). A spare part is a
// catalog/inventory entry; consuming one against a maintenance request decrements
// quantityOnHand elsewhere (see SparePartUsage) — the dedicated stock endpoint here
// is only for restocking/manual corrections.

export interface SparePart {
  id: number
  name: string
  sku: string | null
  unit: string | null
  unitCost: number | null
  quantityOnHand: number
  vendorId: number | null
  vendorName: string | null
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SparePartFilter {
  name?: string
  vendorId?: number
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateSparePartPayload {
  name: string
  sku?: string
  unit?: string
  unitCost?: number
  quantityOnHand?: number
  vendorId?: number
  notes?: string
}

export interface UpdateSparePartPayload {
  name: string
  sku?: string
  unit?: string
  unitCost?: number
  vendorId?: number
  notes?: string
}

export interface AdjustSparePartStockPayload {
  quantityChange: number
  reason?: string
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

export function useSpareParts() {
  const api = useApi()

  function list(filter: SparePartFilter = {}) {
    return api<PageEnvelope<SparePart>>('/api/spare-parts', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<SparePart>>(`/api/spare-parts/${id}`)
    return res.data
  }

  async function create(payload: CreateSparePartPayload) {
    const res = await api<ApiEnvelope<SparePart>>('/api/spare-parts', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateSparePartPayload) {
    const res = await api<ApiEnvelope<SparePart>>(`/api/spare-parts/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<SparePart>>(`/api/spare-parts/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  async function adjustStock(id: number, payload: AdjustSparePartStockPayload) {
    const res = await api<ApiEnvelope<SparePart>>(`/api/spare-parts/${id}/stock`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  return { list, get, create, update, updateStatus, adjustStock }
}

// Wraps the backend's SaleListingController (/api/sale-listings). A sale
// listing is a unit being marketed for sale at an asking price — the sales
// track's counterpart to a lease's unit-scoping, but standalone (not nested
// under Unit) since a unit can be re-listed after a withdrawn/expired attempt.

export type SaleListingStatus = 'ACTIVE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN'

export interface SaleListing {
  id: number
  unitId: number
  unitNumber: string | null
  buildingName: string | null
  propertyName: string | null
  askingPrice: number
  status: SaleListingStatus
  listedDate: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface SaleListingFilter {
  unitId?: number
  status?: SaleListingStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateSaleListingPayload {
  unitId: number
  askingPrice: number
  listedDate: string
  description?: string
}

export interface UpdateSaleListingPayload {
  description?: string
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

export function useSaleListings() {
  const api = useApi()

  function list(filter: SaleListingFilter = {}) {
    return api<PageEnvelope<SaleListing>>('/api/sale-listings', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<SaleListing>>(`/api/sale-listings/${id}`)
    return res.data
  }

  async function create(payload: CreateSaleListingPayload) {
    const res = await api<ApiEnvelope<SaleListing>>('/api/sale-listings', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateSaleListingPayload) {
    const res = await api<ApiEnvelope<SaleListing>>(`/api/sale-listings/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updatePrice(id: number, askingPrice: number) {
    const res = await api<ApiEnvelope<SaleListing>>(`/api/sale-listings/${id}/price`, {
      method: 'PUT',
      body: { askingPrice }
    })
    return res.data
  }

  async function withdraw(id: number) {
    const res = await api<ApiEnvelope<SaleListing>>(`/api/sale-listings/${id}/withdraw`, { method: 'PUT' })
    return res.data
  }

  return { list, get, create, update, updatePrice, withdraw }
}

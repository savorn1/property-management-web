// Wraps the backend's LeadController (/api/leads). One pipeline, two purposes:
// a RENTAL lead converts into a Tenant (`convert`), a SALE lead converts into
// a Buyer + SaleReservation (`convertToReservation`) — status/history/documents
// are shared across both purposes.

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'CONVERTED'
export type LeadPurpose = 'RENTAL' | 'SALE'

export interface Lead {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  source: string | null
  purpose: LeadPurpose
  interestedUnitId: number | null
  interestedUnitNumber: string | null
  status: LeadStatus
  convertedTenantId: number | null
  convertedBuyerId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadFilter {
  fullName?: string
  email?: string
  phone?: string
  status?: LeadStatus
  purpose?: LeadPurpose
  source?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateLeadPayload {
  fullName: string
  email?: string
  phone?: string
  source?: string
  purpose: LeadPurpose
  interestedUnitId?: number
  notes?: string
}

export interface UpdateLeadPayload {
  fullName: string
  email?: string
  phone?: string
  source?: string
  interestedUnitId?: number
  notes?: string
}

export interface ConvertLeadPayload {
  nationalId?: string
  dateOfBirth?: string
  address?: string
  occupation?: string
  notes?: string
}

export interface ConvertLeadToReservationPayload {
  nationalId?: string
  address?: string
  reservationDate?: string
  expiryDate?: string
  notes?: string
}

export interface LeadHistoryEntry {
  id: number
  action: string
  description: string | null
  performedBy: string | null
  createdAt: string
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

export function useLeads() {
  const api = useApi()

  function list(filter: LeadFilter = {}) {
    return api<PageEnvelope<Lead>>('/api/leads', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Lead>>(`/api/leads/${id}`)
    return res.data
  }

  async function create(payload: CreateLeadPayload) {
    const res = await api<ApiEnvelope<Lead>>('/api/leads', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateLeadPayload) {
    const res = await api<ApiEnvelope<Lead>>(`/api/leads/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, status: LeadStatus) {
    const res = await api<ApiEnvelope<Lead>>(`/api/leads/${id}/status`, { method: 'PUT', body: { status } })
    return res.data
  }

  // RENTAL leads only — converts to a Tenant.
  async function convert(id: number, payload: ConvertLeadPayload) {
    const res = await api<ApiEnvelope<Lead>>(`/api/leads/${id}/convert`, { method: 'PUT', body: payload })
    return res.data
  }

  // SALE leads only — converts to a Buyer + a new SaleReservation. Requires
  // the lead's interestedUnit to have an ACTIVE sale listing already.
  async function convertToReservation(id: number, payload: ConvertLeadToReservationPayload) {
    const res = await api<ApiEnvelope<import('./useSaleReservations').SaleReservation>>(
      `/api/leads/${id}/convert-to-reservation`,
      { method: 'PUT', body: payload }
    )
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/leads/${id}`, { method: 'DELETE' })
  }

  async function history(id: number) {
    const res = await api<ApiEnvelope<LeadHistoryEntry[]>>(`/api/leads/${id}/history`)
    return res.data
  }

  return { list, get, create, update, updateStatus, convert, convertToReservation, remove, history }
}

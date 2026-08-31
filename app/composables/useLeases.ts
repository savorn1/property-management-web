// Wraps the backend's LeaseController plus the lease-nested rent-configuration
// and deposit-payment endpoints (/api/leases/**).

export type LeaseStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'TERMINATED'

export interface Lease {
  id: number
  tenantId: number
  tenantName: string | null
  unitId: number
  unitNumber: string | null
  unitTypeName: string | null
  buildingId: number | null
  buildingName: string | null
  propertyId: number | null
  propertyName: string | null
  startDate: string
  endDate: string
  rentAmount: number
  depositAmount: number | null
  depositPaid: number | null
  depositBalance: number | null
  status: LeaseStatus
  terminationDate: string | null
  terminationReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LeaseFilter {
  tenantId?: number
  unitId?: number
  status?: LeaseStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateLeasePayload {
  tenantId: number
  unitId: number
  startDate: string
  endDate: string
  rentAmount: number
  depositAmount?: number
  notes?: string
}

export interface RenewLeasePayload {
  newEndDate: string
  newRentAmount?: number
}

export interface TerminateLeasePayload {
  terminationDate?: string
  reason?: string
}

export interface LeaseHistoryEntry {
  id: number
  action: string
  description: string | null
  performedBy: string | null
  createdAt: string
}

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type LateFeeType = 'NONE' | 'FIXED' | 'PERCENTAGE'

export interface RentConfiguration {
  id: number
  leaseId: number
  billingCycle: BillingCycle
  dueDayOfMonth: number
  lateFeeType: LateFeeType
  lateFeeAmount: number | null
  gracePeriodDays: number | null
  createdAt: string
  updatedAt: string
}

export interface RentConfigurationPayload {
  billingCycle: BillingCycle
  dueDayOfMonth: number
  lateFeeType: LateFeeType
  lateFeeAmount?: number
  gracePeriodDays?: number
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHECK' | 'ONLINE' | 'OTHER'

export interface DepositPayment {
  id: number
  leaseId: number
  invoiceId: number | null
  type: string
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface CreateDepositPaymentPayload {
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber?: string
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

export function useLeases() {
  const api = useApi()

  function list(filter: LeaseFilter = {}) {
    return api<PageEnvelope<Lease>>('/api/leases', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Lease>>(`/api/leases/${id}`)
    return res.data
  }

  async function create(payload: CreateLeasePayload) {
    const res = await api<ApiEnvelope<Lease>>('/api/leases', { method: 'POST', body: payload })
    return res.data
  }

  async function approve(id: number) {
    const res = await api<ApiEnvelope<Lease>>(`/api/leases/${id}/approve`, { method: 'PUT' })
    return res.data
  }

  async function renew(id: number, payload: RenewLeasePayload) {
    const res = await api<ApiEnvelope<Lease>>(`/api/leases/${id}/renew`, { method: 'PUT', body: payload })
    return res.data
  }

  async function terminate(id: number, payload: TerminateLeasePayload) {
    const res = await api<ApiEnvelope<Lease>>(`/api/leases/${id}/terminate`, { method: 'PUT', body: payload })
    return res.data
  }

  async function history(id: number) {
    const res = await api<ApiEnvelope<LeaseHistoryEntry[]>>(`/api/leases/${id}/history`)
    return res.data
  }

  // No GET-existence check exposed separately — callers try getRentConfiguration
  // and fall back to createRentConfiguration on a 404 (no config saved yet).
  async function getRentConfiguration(leaseId: number) {
    const res = await api<ApiEnvelope<RentConfiguration>>(`/api/leases/${leaseId}/rent-configuration`)
    return res.data
  }

  async function createRentConfiguration(leaseId: number, payload: RentConfigurationPayload) {
    const res = await api<ApiEnvelope<RentConfiguration>>(`/api/leases/${leaseId}/rent-configuration`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function updateRentConfiguration(leaseId: number, payload: RentConfigurationPayload) {
    const res = await api<ApiEnvelope<RentConfiguration>>(`/api/leases/${leaseId}/rent-configuration`, {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function listDepositPayments(leaseId: number) {
    const res = await api<ApiEnvelope<DepositPayment[]>>(`/api/leases/${leaseId}/deposit-payments`)
    return res.data
  }

  async function createDepositPayment(leaseId: number, payload: CreateDepositPaymentPayload) {
    const res = await api<ApiEnvelope<DepositPayment>>(`/api/leases/${leaseId}/deposit-payments`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return {
    list,
    get,
    create,
    approve,
    renew,
    terminate,
    history,
    getRentConfiguration,
    createRentConfiguration,
    updateRentConfiguration,
    listDepositPayments,
    createDepositPayment
  }
}

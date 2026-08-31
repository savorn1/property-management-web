// Wraps the backend's SaleReservationController (/api/sale-reservations) plus
// its nested reservation-deposit-payments endpoints. A reservation holds a
// sale listing for a buyer ahead of a full SaleAgreement — either created
// directly here, or produced by Lead.convertToReservation.

import type { PaymentMethod } from '#shared/domain'

export type ReservationStatus = 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED'

export interface SaleReservation {
  id: number
  saleListingId: number
  unitId: number
  unitNumber: string | null
  buyerId: number
  buyerName: string | null
  reservationDate: string
  expiryDate: string | null
  status: ReservationStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SaleReservationFilter {
  saleListingId?: number
  buyerId?: number
  status?: ReservationStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateSaleReservationPayload {
  saleListingId: number
  buyerId: number
  reservationDate: string
  expiryDate?: string
  notes?: string
}

export interface SalePayment {
  id: number
  reservationId: number | null
  saleAgreementId: number | null
  installmentId: number | null
  type: 'RESERVATION_DEPOSIT' | 'DOWN_PAYMENT' | 'INSTALLMENT' | 'OTHER'
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface CreateSalePaymentPayload {
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

export function useSaleReservations() {
  const api = useApi()

  function list(filter: SaleReservationFilter = {}) {
    return api<PageEnvelope<SaleReservation>>('/api/sale-reservations', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<SaleReservation>>(`/api/sale-reservations/${id}`)
    return res.data
  }

  async function create(payload: CreateSaleReservationPayload) {
    const res = await api<ApiEnvelope<SaleReservation>>('/api/sale-reservations', { method: 'POST', body: payload })
    return res.data
  }

  async function cancel(id: number, reason?: string) {
    const res = await api<ApiEnvelope<SaleReservation>>(`/api/sale-reservations/${id}/cancel`, {
      method: 'PUT',
      body: { reason }
    })
    return res.data
  }

  async function listDepositPayments(id: number) {
    const res = await api<ApiEnvelope<SalePayment[]>>(`/api/sale-reservations/${id}/deposit-payments`)
    return res.data
  }

  async function createDepositPayment(id: number, payload: CreateSalePaymentPayload) {
    const res = await api<ApiEnvelope<SalePayment>>(`/api/sale-reservations/${id}/deposit-payments`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, get, create, cancel, listDepositPayments, createDepositPayment }
}

// Wraps the backend's LoanController (/api/loans). A loan the business owes to
// a lender (e.g. a mortgage), the liability-side counterpart to a sales
// Installment. No update/delete — just list/get/create, plus the amortization
// schedule (GET/POST /api/loans/{id}/schedule) and its payment history
// (GET /api/loans/{id}/payments). Recording a payment against one installment
// goes through useLoanInstallments.ts (LoanInstallmentController).

import type { InstallmentStatus } from '#shared/domain'

export type LoanStatus = 'ACTIVE' | 'CLOSED'

export interface Loan {
  id: number
  propertyId: number | null
  propertyName: string | null
  lender: string
  loanNumber: string | null
  principalAmount: number
  interestRate: number
  termMonths: number
  startDate: string
  status: LoanStatus
  scheduleGenerated: boolean
  outstandingBalance: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LoanFilter {
  propertyId?: number
  status?: LoanStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateLoanPayload {
  propertyId?: number
  lender: string
  loanNumber?: string
  principalAmount: number
  interestRate: number
  termMonths: number
  startDate: string
  notes?: string
}

export interface LoanInstallment {
  id: number
  loanId: number
  installmentNumber: number
  dueDate: string
  principalAmount: number
  interestAmount: number
  totalAmount: number
  amountPaid: number
  balanceDue: number
  status: InstallmentStatus
  overdue: boolean
  createdAt: string
  updatedAt: string
}

export interface LoanPayment {
  id: number
  loanId: number
  installmentId: number
  amount: number
  principalPortion: number
  interestPortion: number
  paymentDate: string
  method: string
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
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

export function useLoans() {
  const api = useApi()

  function list(filter: LoanFilter = {}) {
    return api<PageEnvelope<Loan>>('/api/loans', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Loan>>(`/api/loans/${id}`)
    return res.data
  }

  async function create(payload: CreateLoanPayload) {
    const res = await api<ApiEnvelope<Loan>>('/api/loans', { method: 'POST', body: payload })
    return res.data
  }

  async function getSchedule(id: number) {
    const res = await api<ApiEnvelope<LoanInstallment[]>>(`/api/loans/${id}/schedule`)
    return res.data
  }

  async function generateSchedule(id: number) {
    const res = await api<ApiEnvelope<LoanInstallment[]>>(`/api/loans/${id}/schedule`, { method: 'POST' })
    return res.data
  }

  async function getPayments(id: number) {
    const res = await api<ApiEnvelope<LoanPayment[]>>(`/api/loans/${id}/payments`)
    return res.data
  }

  return { list, get, create, getSchedule, generateSchedule, getPayments }
}

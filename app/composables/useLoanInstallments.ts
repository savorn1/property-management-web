// Wraps the backend's LoanInstallmentController
// (/api/loan-installments/{installmentId}/payments) — records a payment
// against one amortization installment of a loan (see useLoans.ts).

import type { LoanPayment } from './useLoans'

export interface CreateLoanPaymentPayload {
  amount: number
  paymentDate: string
  method: string
  referenceNumber?: string
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useLoanInstallments() {
  const api = useApi()

  async function listPayments(installmentId: number) {
    const res = await api<ApiEnvelope<LoanPayment[]>>(`/api/loan-installments/${installmentId}/payments`)
    return res.data
  }

  async function createPayment(installmentId: number, payload: CreateLoanPaymentPayload) {
    const res = await api<ApiEnvelope<LoanPayment>>(`/api/loan-installments/${installmentId}/payments`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { listPayments, createPayment }
}

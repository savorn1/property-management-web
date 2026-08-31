// Wraps the backend's PaymentPlanController
// (/api/sale-agreements/{saleAgreementId}/payment-plan and its /schedule
// sub-path). One plan per sale agreement; the schedule of installments is
// generated separately once the plan exists.

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type InstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID'

export interface PaymentPlan {
  id: number
  saleAgreementId: number
  downPaymentAmount: number
  installmentCount: number
  installmentFrequency: BillingCycle
  firstInstallmentDate: string
  scheduleGenerated: boolean
  createdAt: string
  updatedAt: string
}

export interface CreatePaymentPlanPayload {
  downPaymentAmount: number
  installmentCount: number
  installmentFrequency: BillingCycle
  firstInstallmentDate: string
}

export interface Installment {
  id: number
  paymentPlanId: number
  installmentNumber: number
  dueDate: string
  amount: number
  amountPaid: number
  balanceDue: number
  status: InstallmentStatus
  overdue: boolean
  createdAt: string
  updatedAt: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function usePaymentPlans() {
  const api = useApi()

  async function get(saleAgreementId: number) {
    const res = await api<ApiEnvelope<PaymentPlan>>(`/api/sale-agreements/${saleAgreementId}/payment-plan`)
    return res.data
  }

  async function create(saleAgreementId: number, payload: CreatePaymentPlanPayload) {
    const res = await api<ApiEnvelope<PaymentPlan>>(`/api/sale-agreements/${saleAgreementId}/payment-plan`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  async function getSchedule(saleAgreementId: number) {
    const res = await api<ApiEnvelope<Installment[]>>(`/api/sale-agreements/${saleAgreementId}/payment-plan/schedule`)
    return res.data
  }

  async function generateSchedule(saleAgreementId: number) {
    const res = await api<ApiEnvelope<Installment[]>>(`/api/sale-agreements/${saleAgreementId}/payment-plan/schedule`, {
      method: 'POST'
    })
    return res.data
  }

  return { get, create, getSchedule, generateSchedule }
}

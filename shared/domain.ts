// Cross-cutting domain types reused by multiple composables. Previously each
// composable redefined these locally (copy-pasted, byte-identical) — since
// Nuxt auto-imports every composables/*.ts export into one global namespace,
// that produced "duplicated import" warnings and silently let whichever file
// loaded first win. Import from here instead of redefining locally.

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHECK' | 'ONLINE' | 'OTHER'
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type InspectionCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
export type InstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID'
export type RefundStatus = 'PENDING' | 'REFUNDED'
export type PaymentType = 'RENT' | 'DEPOSIT'

export type JournalSourceType =
  | 'MANUAL'
  | 'RENT_PAYMENT'
  | 'DEPOSIT_PAYMENT'
  | 'DEPOSIT_REFUND'
  | 'UTILITY_BILL'
  | 'SALE_PAYMENT'
  | 'SALE_REFUND'
  | 'EXPENSE'
  | 'COMMISSION'
  | 'LOAN_PAYMENT'
  | 'RENT_REFUND'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'PAYABLE_PAYMENT'

export interface Payment {
  id: number
  leaseId: number | null
  invoiceId: number | null
  type: PaymentType
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

export interface CreateInspectionPayload {
  inspectionDate: string
  inspectedBy: string
  condition: InspectionCondition
  notes?: string
}

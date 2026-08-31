// Wraps the backend's SaleHandoverController
// (/api/sale-agreements/{saleAgreementId}/handover). At most one handover per
// sale agreement (get-or-404, create-once — no update endpoint), so it's
// folded into the Sale Agreements "Manage" modal rather than a standalone page.

import type { InspectionCondition } from '#shared/domain'

export interface SaleHandover {
  id: number
  saleAgreementId: number
  handoverDate: string
  handedOverBy: string
  condition: InspectionCondition
  notes: string | null
  createdAt: string
}

export interface CreateSaleHandoverPayload {
  handoverDate: string
  handedOverBy: string
  condition: InspectionCondition
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useSaleHandovers() {
  const api = useApi()

  async function get(saleAgreementId: number) {
    const res = await api<ApiEnvelope<SaleHandover>>(`/api/sale-agreements/${saleAgreementId}/handover`)
    return res.data
  }

  async function create(saleAgreementId: number, payload: CreateSaleHandoverPayload) {
    const res = await api<ApiEnvelope<SaleHandover>>(`/api/sale-agreements/${saleAgreementId}/handover`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { get, create }
}

// Wraps the backend's OwnershipTransferController
// (/api/sale-agreements/{saleAgreementId}/ownership-transfer). At most one
// transfer per sale agreement (get-or-404, create-once). Creating a transfer
// also records a new UnitOwner row server-side (OwnershipTransferServiceImpl
// calls unitOwnerService.recordTransfer(unit, buyer, transferDate)) — this is
// the workflow that produces the UnitOwner history seen under
// /api/units/{unitId}/owners, not a separate/redundant concept. Folded into
// the Sale Agreements "Manage" modal since it's strictly agreement-scoped.

export interface OwnershipTransfer {
  id: number
  saleAgreementId: number
  unitId: number
  unitNumber: string | null
  transferDate: string
  registeredBy: string
  documentReference: string | null
  notes: string | null
  createdAt: string
}

export interface CreateOwnershipTransferPayload {
  transferDate: string
  registeredBy: string
  documentReference?: string
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useOwnershipTransfers() {
  const api = useApi()

  async function get(saleAgreementId: number) {
    const res = await api<ApiEnvelope<OwnershipTransfer>>(`/api/sale-agreements/${saleAgreementId}/ownership-transfer`)
    return res.data
  }

  async function create(saleAgreementId: number, payload: CreateOwnershipTransferPayload) {
    const res = await api<ApiEnvelope<OwnershipTransfer>>(
      `/api/sale-agreements/${saleAgreementId}/ownership-transfer`,
      { method: 'POST', body: payload }
    )
    return res.data
  }

  return { get, create }
}

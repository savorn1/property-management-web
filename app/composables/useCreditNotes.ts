// Wraps the backend's CreditNoteController, nested under an invoice
// (/api/invoices/{invoiceId}/credit-notes). Reduces the total amount owed on
// an Invoice without cash changing hands — applied immediately on creation.
// List is open to any authenticated user; create is ADMIN-only.

export interface CreditNote {
  id: number
  invoiceId: number
  amount: number
  reason: string | null
  noteDate: string
  issuedBy: string | null
  createdAt: string
}

export interface CreateCreditNotePayload {
  amount: number
  reason?: string
  noteDate: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useCreditNotes() {
  const api = useApi()

  async function list(invoiceId: number) {
    const res = await api<ApiEnvelope<CreditNote[]>>(`/api/invoices/${invoiceId}/credit-notes`)
    return res.data
  }

  async function create(invoiceId: number, payload: CreateCreditNotePayload) {
    const res = await api<ApiEnvelope<CreditNote>>(`/api/invoices/${invoiceId}/credit-notes`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, create }
}

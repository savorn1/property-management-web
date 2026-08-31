// Wraps the backend's DebitNoteController, nested under an invoice
// (/api/invoices/{invoiceId}/debit-notes). Increases the total amount owed on
// an Invoice after issuance — the mirror image of CreditNote. List is open to
// any authenticated user; create is ADMIN-only.

export interface DebitNote {
  id: number
  invoiceId: number
  amount: number
  reason: string | null
  noteDate: string
  issuedBy: string | null
  createdAt: string
}

export interface CreateDebitNotePayload {
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

export function useDebitNotes() {
  const api = useApi()

  async function list(invoiceId: number) {
    const res = await api<ApiEnvelope<DebitNote[]>>(`/api/invoices/${invoiceId}/debit-notes`)
    return res.data
  }

  async function create(invoiceId: number, payload: CreateDebitNotePayload) {
    const res = await api<ApiEnvelope<DebitNote>>(`/api/invoices/${invoiceId}/debit-notes`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, create }
}

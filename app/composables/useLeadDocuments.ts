// Wraps the backend's LeadDocumentController (/api/leads/{leadId}/documents).
// Upload is multipart/form-data — no composable elsewhere in this app does a
// FormData POST yet, so this is the first: build a FormData and post it via
// the raw useApi() request function with no Content-Type header (the browser
// sets the multipart boundary itself).

export interface LeadDocument {
  id: number
  leadId: number
  fileName: string
  contentType: string
  fileSize: number
  description: string | null
  uploadedBy: string | null
  createdAt: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useLeadDocuments() {
  const api = useApi()

  async function list(leadId: number) {
    const res = await api<ApiEnvelope<LeadDocument[]>>(`/api/leads/${leadId}/documents`)
    return res.data
  }

  async function upload(leadId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<LeadDocument>>(`/api/leads/${leadId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(leadId: number, documentId: number) {
    await api(`/api/leads/${leadId}/documents/${documentId}`, { method: 'DELETE' })
  }

  // Downloads require the Bearer token, so a plain <a href> to the API can't
  // be used directly — fetch as a blob (through the authenticated client) and
  // trigger the save via a temporary object URL instead.
  async function download(leadId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/leads/${leadId}/documents/${documentId}/content`, {
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return { list, upload, remove, download }
}

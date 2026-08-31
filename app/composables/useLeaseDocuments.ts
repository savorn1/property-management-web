// Wraps the backend's LeaseDocumentController (/api/leases/{leaseId}/documents).
// Same multipart upload/download shape as useLeadDocuments and
// useSaleAgreementDocuments — build a FormData and post it via the raw
// useApi() request function with no Content-Type header (the browser sets
// the multipart boundary itself); downloads are fetched as a blob through
// the authenticated client since a plain <a href> can't carry the Bearer token.

export interface LeaseDocument {
  id: number
  leaseId: number
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

export function useLeaseDocuments() {
  const api = useApi()

  async function list(leaseId: number) {
    const res = await api<ApiEnvelope<LeaseDocument[]>>(`/api/leases/${leaseId}/documents`)
    return res.data
  }

  async function upload(leaseId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<LeaseDocument>>(`/api/leases/${leaseId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(leaseId: number, documentId: number) {
    await api(`/api/leases/${leaseId}/documents/${documentId}`, { method: 'DELETE' })
  }

  async function download(leaseId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/leases/${leaseId}/documents/${documentId}/content`, {
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

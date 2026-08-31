// Wraps the backend's TenantDocumentController (/api/tenants/{tenantId}/documents).
// Same multipart upload/download shape as useLeadDocuments and
// useSaleAgreementDocuments — build a FormData and post it via the raw
// useApi() request function with no Content-Type header (the browser sets
// the multipart boundary itself); downloads are fetched as a blob through
// the authenticated client since a plain <a href> can't carry the Bearer token.

export interface TenantDocument {
  id: number
  tenantId: number
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

export function useTenantDocuments() {
  const api = useApi()

  async function list(tenantId: number) {
    const res = await api<ApiEnvelope<TenantDocument[]>>(`/api/tenants/${tenantId}/documents`)
    return res.data
  }

  async function upload(tenantId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<TenantDocument>>(`/api/tenants/${tenantId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(tenantId: number, documentId: number) {
    await api(`/api/tenants/${tenantId}/documents/${documentId}`, { method: 'DELETE' })
  }

  async function download(tenantId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/tenants/${tenantId}/documents/${documentId}/content`, {
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

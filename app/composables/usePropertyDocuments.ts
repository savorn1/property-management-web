// Wraps the backend's PropertyDocumentController (/api/properties/{propertyId}/documents).
// Same multipart upload shape as useLeadDocuments/useSaleAgreementDocuments.

export interface PropertyDocument {
  id: number
  propertyId: number
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

export function usePropertyDocuments() {
  const api = useApi()

  async function list(propertyId: number) {
    const res = await api<ApiEnvelope<PropertyDocument[]>>(`/api/properties/${propertyId}/documents`)
    return res.data
  }

  async function upload(propertyId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<PropertyDocument>>(`/api/properties/${propertyId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(propertyId: number, documentId: number) {
    await api(`/api/properties/${propertyId}/documents/${documentId}`, { method: 'DELETE' })
  }

  // Downloads require the Bearer token, so a plain <a href> to the API can't
  // be used directly — fetch as a blob (through the authenticated client) and
  // trigger the save via a temporary object URL instead.
  async function download(propertyId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/properties/${propertyId}/documents/${documentId}/content`, {
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

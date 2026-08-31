// Wraps the backend's PropertyCertificateController
// (/api/properties/{propertyId}/certificates). Structurally identical to
// PropertyDocument on the backend (same fields, same upload/list/download/
// delete shape) — certificates are just semantically distinct (title deeds,
// occupancy permits, etc.) rather than a different data shape, so this
// composable mirrors usePropertyDocuments.ts exactly.

export interface PropertyCertificate {
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

export function usePropertyCertificates() {
  const api = useApi()

  async function list(propertyId: number) {
    const res = await api<ApiEnvelope<PropertyCertificate[]>>(`/api/properties/${propertyId}/certificates`)
    return res.data
  }

  async function upload(propertyId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<PropertyCertificate>>(`/api/properties/${propertyId}/certificates`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(propertyId: number, certificateId: number) {
    await api(`/api/properties/${propertyId}/certificates/${certificateId}`, { method: 'DELETE' })
  }

  // Downloads require the Bearer token, so a plain <a href> to the API can't
  // be used directly — fetch as a blob (through the authenticated client) and
  // trigger the save via a temporary object URL instead.
  async function download(propertyId: number, certificateId: number, fileName: string) {
    const blob = await api<Blob>(`/api/properties/${propertyId}/certificates/${certificateId}/content`, {
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

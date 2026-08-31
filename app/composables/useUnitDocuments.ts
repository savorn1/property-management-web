// Wraps the backend's UnitDocumentController (/api/units/{unitId}/documents).
// General paperwork/contracts for a unit — structurally identical to
// UnitCertificate (same fields, same multipart shape) but semantically
// distinct: certificates are official documents (title deed, occupancy
// permit), documents are everything else (contracts, misc attachments).

export interface UnitDocument {
  id: number
  unitId: number
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

export function useUnitDocuments() {
  const api = useApi()

  async function list(unitId: number) {
    const res = await api<ApiEnvelope<UnitDocument[]>>(`/api/units/${unitId}/documents`)
    return res.data
  }

  async function upload(unitId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<UnitDocument>>(`/api/units/${unitId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(unitId: number, documentId: number) {
    await api(`/api/units/${unitId}/documents/${documentId}`, { method: 'DELETE' })
  }

  async function download(unitId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/units/${unitId}/documents/${documentId}/content`, {
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

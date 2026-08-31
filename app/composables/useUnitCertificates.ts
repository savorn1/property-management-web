// Wraps the backend's UnitCertificateController (/api/units/{unitId}/certificates).
// Official certificates for a unit (title deed, occupancy permit, etc.) — distinct
// from UnitDocument, which is for general paperwork/contracts. Same multipart
// upload shape as useLeadDocuments.

export interface UnitCertificate {
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

export function useUnitCertificates() {
  const api = useApi()

  async function list(unitId: number) {
    const res = await api<ApiEnvelope<UnitCertificate[]>>(`/api/units/${unitId}/certificates`)
    return res.data
  }

  async function upload(unitId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<UnitCertificate>>(`/api/units/${unitId}/certificates`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(unitId: number, certificateId: number) {
    await api(`/api/units/${unitId}/certificates/${certificateId}`, { method: 'DELETE' })
  }

  // Downloads require the Bearer token, so a plain <a href> to the API can't
  // be used directly — fetch as a blob (through the authenticated client) and
  // trigger the save via a temporary object URL instead.
  async function download(unitId: number, certificateId: number, fileName: string) {
    const blob = await api<Blob>(`/api/units/${unitId}/certificates/${certificateId}/content`, {
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

// Wraps the backend's (proposed) BuildingDocumentController
// (/api/buildings/{buildingId}/documents). Same shape as usePropertyDocuments
// / useUnitDocuments — see that comment for the multipart upload pattern.
//
// NOTE: this backend endpoint doesn't exist yet — same situation as
// useBuildingFacilities.ts. Calls here will 404 until it's added.

export interface BuildingDocument {
  id: number
  buildingId: number
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

export function useBuildingDocuments() {
  const api = useApi()

  async function list(buildingId: number) {
    const res = await api<ApiEnvelope<BuildingDocument[]>>(`/api/buildings/${buildingId}/documents`)
    return res.data
  }

  async function upload(buildingId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<BuildingDocument>>(`/api/buildings/${buildingId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(buildingId: number, documentId: number) {
    await api(`/api/buildings/${buildingId}/documents/${documentId}`, { method: 'DELETE' })
  }

  async function download(buildingId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/buildings/${buildingId}/documents/${documentId}/content`, {
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

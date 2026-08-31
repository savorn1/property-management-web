// Wraps the backend's UnitImageController (/api/units/{unitId}/images).
// A marketing/listing photo gallery for a unit — distinct from UnitDocument
// and UnitCertificate (paperwork), this is specifically photos, with one
// flagged `primary` at a time. Same multipart upload shape as
// useLeadDocuments, plus a caption/primary flag and a set-primary action.

export interface UnitImage {
  id: number
  unitId: number
  fileName: string
  contentType: string
  fileSize: number
  primary: boolean
  caption: string | null
  uploadedBy: string | null
  createdAt: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useUnitImages() {
  const api = useApi()

  async function list(unitId: number) {
    const res = await api<ApiEnvelope<UnitImage[]>>(`/api/units/${unitId}/images`)
    return res.data
  }

  async function upload(unitId: number, file: File, caption?: string, primary?: boolean) {
    const formData = new FormData()
    formData.append('file', file)
    if (caption) formData.append('caption', caption)
    if (primary) formData.append('primary', 'true')
    const res = await api<ApiEnvelope<UnitImage>>(`/api/units/${unitId}/images`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function setPrimary(unitId: number, imageId: number) {
    const res = await api<ApiEnvelope<UnitImage>>(`/api/units/${unitId}/images/${imageId}/primary`, {
      method: 'PUT'
    })
    return res.data
  }

  async function remove(unitId: number, imageId: number) {
    await api(`/api/units/${unitId}/images/${imageId}`, { method: 'DELETE' })
  }

  // Downloads (and inline display) require the Bearer token, so a plain
  // <a href>/<img src> pointed at the API can't be used directly — fetch as a
  // blob through the authenticated client instead.
  async function download(unitId: number, imageId: number, fileName: string) {
    const blob = await api<Blob>(`/api/units/${unitId}/images/${imageId}/content`, {
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  // For inline <img> thumbnails: fetch the image bytes as a blob and hand
  // back an object URL the caller can bind to `src`. Caller owns the URL's
  // lifetime and should URL.revokeObjectURL it when no longer displayed.
  async function getObjectUrl(unitId: number, imageId: number) {
    const blob = await api<Blob>(`/api/units/${unitId}/images/${imageId}/content`, {
      responseType: 'blob'
    })
    return URL.createObjectURL(blob)
  }

  return { list, upload, setPrimary, remove, download, getObjectUrl }
}

// Wraps the backend's PropertyImageController (/api/properties/{propertyId}/images).
// A marketing/listing photo gallery for a property — distinct from
// PropertyDocument and PropertyCertificate (paperwork), this is specifically
// photos, with one flagged `primary` at a time. Mirrors useUnitImages.ts.

export interface PropertyImage {
  id: number
  propertyId: number
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

export function usePropertyImages() {
  const api = useApi()

  async function list(propertyId: number) {
    const res = await api<ApiEnvelope<PropertyImage[]>>(`/api/properties/${propertyId}/images`)
    return res.data
  }

  async function upload(propertyId: number, file: File, caption?: string, primary?: boolean) {
    const formData = new FormData()
    formData.append('file', file)
    if (caption) formData.append('caption', caption)
    if (primary) formData.append('primary', 'true')
    const res = await api<ApiEnvelope<PropertyImage>>(`/api/properties/${propertyId}/images`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function setPrimary(propertyId: number, imageId: number) {
    const res = await api<ApiEnvelope<PropertyImage>>(`/api/properties/${propertyId}/images/${imageId}/primary`, {
      method: 'PUT'
    })
    return res.data
  }

  async function remove(propertyId: number, imageId: number) {
    await api(`/api/properties/${propertyId}/images/${imageId}`, { method: 'DELETE' })
  }

  // Downloads (and inline display) require the Bearer token, so a plain
  // <a href>/<img src> pointed at the API can't be used directly — fetch as a
  // blob through the authenticated client instead.
  async function download(propertyId: number, imageId: number, fileName: string) {
    const blob = await api<Blob>(`/api/properties/${propertyId}/images/${imageId}/content`, {
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
  async function getObjectUrl(propertyId: number, imageId: number) {
    const blob = await api<Blob>(`/api/properties/${propertyId}/images/${imageId}/content`, {
      responseType: 'blob'
    })
    return URL.createObjectURL(blob)
  }

  return { list, upload, setPrimary, remove, download, getObjectUrl }
}

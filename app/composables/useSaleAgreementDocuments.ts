// Wraps the backend's SaleAgreementDocumentController
// (/api/sale-agreements/{saleAgreementId}/documents). Same multipart upload
// shape as useLeadDocuments.

export interface SaleAgreementDocument {
  id: number
  saleAgreementId: number
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

export function useSaleAgreementDocuments() {
  const api = useApi()

  async function list(saleAgreementId: number) {
    const res = await api<ApiEnvelope<SaleAgreementDocument[]>>(`/api/sale-agreements/${saleAgreementId}/documents`)
    return res.data
  }

  async function upload(saleAgreementId: number, file: File, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const res = await api<ApiEnvelope<SaleAgreementDocument>>(`/api/sale-agreements/${saleAgreementId}/documents`, {
      method: 'POST',
      body: formData
    })
    return res.data
  }

  async function remove(saleAgreementId: number, documentId: number) {
    await api(`/api/sale-agreements/${saleAgreementId}/documents/${documentId}`, { method: 'DELETE' })
  }

  async function download(saleAgreementId: number, documentId: number, fileName: string) {
    const blob = await api<Blob>(`/api/sale-agreements/${saleAgreementId}/documents/${documentId}/content`, {
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

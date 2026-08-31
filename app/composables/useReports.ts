// Wraps the backend's ReportController (/api/reports/**) — pre-aggregated
// figures for the dashboard, rather than recomputing them client-side from
// paginated list endpoints.

export interface OccupancyReport {
  totalUnits: number
  availableUnits: number
  occupiedUnits: number
  reservedUnits: number
  maintenanceUnits: number
  unavailableUnits: number
  soldUnits: number
  occupancyRate: number
}

export interface CollectionsReport {
  outstandingInvoiceCount: number
  outstandingInvoiceAmount: number
  overdueInvoiceCount: number
  overdueInvoiceAmount: number
  outstandingInstallmentCount: number
  outstandingInstallmentAmount: number
  overdueInstallmentCount: number
  overdueInstallmentAmount: number
  totalOutstanding: number
}

export interface RevenueReport {
  startDate: string
  endDate: string
  rentCollected: number
  depositCollected: number
  utilityCollected: number
  salesCollected: number
  totalIncome: number
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useReports() {
  const api = useApi()

  async function getOccupancy() {
    const res = await api<ApiEnvelope<OccupancyReport>>('/api/reports/occupancy')
    return res.data
  }

  async function getCollections() {
    const res = await api<ApiEnvelope<CollectionsReport>>('/api/reports/collections')
    return res.data
  }

  async function getRevenue(startDate: string, endDate: string) {
    const res = await api<ApiEnvelope<RevenueReport>>('/api/reports/revenue', { query: { startDate, endDate } })
    return res.data
  }

  return { getOccupancy, getCollections, getRevenue }
}

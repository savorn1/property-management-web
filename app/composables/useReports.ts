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

export interface PropertyReport {
  totalProperties: number
  totalBuildings: number
  totalFloors: number
  totalUnits: number
  propertiesByType: Record<string, number>
  propertiesByZone: Record<string, number>
  activePropertyCount: number
}

export interface RentalReport {
  totalLeases: number
  activeLeases: number
  activeTenants: number
  pendingApprovalLeases: number
  terminatedLeases: number
  expiringWithin30Days: number
  monthlyRentRoll: number
  averageLeaseDurationDays: number
}

export interface SalesPipelineReport {
  totalBuyers: number
  newLeads: number
  contactedLeads: number
  qualifiedLeads: number
  lostLeads: number
  convertedLeads: number
  activeReservations: number
  convertedReservations: number
  expiredReservations: number
  cancelledReservations: number
  activeAgreements: number
  completedAgreements: number
  cancelledAgreements: number
  activeAgreementsValue: number
  completedAgreementsValue: number
}

export interface MaintenanceReport {
  startDate: string
  endDate: string
  totalRequests: number
  openCount: number
  assignedCount: number
  inProgressCount: number
  completedCount: number
  cancelledCount: number
  totalEstimatedCost: number
  totalActualCost: number
  averageResolutionDays: number
}

export interface FinancialSummaryReport {
  startDate: string
  endDate: string
  totalIncome: number
  totalExpenses: number
  netIncome: number
  expensesByCategory: Record<string, number>
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

  async function getProperty() {
    const res = await api<ApiEnvelope<PropertyReport>>('/api/reports/property')
    return res.data
  }

  async function getRental() {
    const res = await api<ApiEnvelope<RentalReport>>('/api/reports/rental')
    return res.data
  }

  async function getSalesPipeline() {
    const res = await api<ApiEnvelope<SalesPipelineReport>>('/api/reports/sales-pipeline')
    return res.data
  }

  async function getMaintenance(startDate: string, endDate: string) {
    const res = await api<ApiEnvelope<MaintenanceReport>>('/api/reports/maintenance', { query: { startDate, endDate } })
    return res.data
  }

  async function getFinancialSummary(startDate: string, endDate: string) {
    const res = await api<ApiEnvelope<FinancialSummaryReport>>('/api/reports/financial-summary', {
      query: { startDate, endDate }
    })
    return res.data
  }

  return {
    getOccupancy,
    getCollections,
    getRevenue,
    getProperty,
    getRental,
    getSalesPipeline,
    getMaintenance,
    getFinancialSummary
  }
}

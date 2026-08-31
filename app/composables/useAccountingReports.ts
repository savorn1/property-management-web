// Wraps the backend's AccountingReportController's general-ledger and
// trial-balance endpoints (/api/accounting/**). Both are GET-with-query-params,
// non-paginated, single-result reports — no create/edit/delete.

export interface GeneralLedgerEntry {
  journalEntryId: number
  entryDate: string
  description: string | null
  debit: number
  credit: number
  runningBalance: number
}

export interface GeneralLedgerReport {
  accountId: number
  accountCode: string
  accountName: string
  startDate: string
  endDate: string
  openingBalance: number
  entries: GeneralLedgerEntry[]
  closingBalance: number
}

export interface GeneralLedgerParams {
  accountId: number
  startDate: string
  endDate: string
}

export interface TrialBalanceLine {
  accountId: number
  accountCode: string
  accountName: string
  accountType: string
  debitBalance: number
  creditBalance: number
}

export interface TrialBalanceReport {
  asOfDate: string
  lines: TrialBalanceLine[]
  totalDebits: number
  totalCredits: number
  balanced: boolean
}

export interface TrialBalanceParams {
  schemeId: number
  asOfDate: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useAccountingReports() {
  const api = useApi()

  async function getGeneralLedger(params: GeneralLedgerParams) {
    const res = await api<ApiEnvelope<GeneralLedgerReport>>('/api/accounting/general-ledger', { query: params })
    return res.data
  }

  async function getTrialBalance(params: TrialBalanceParams) {
    const res = await api<ApiEnvelope<TrialBalanceReport>>('/api/accounting/trial-balance', { query: params })
    return res.data
  }

  return { getGeneralLedger, getTrialBalance }
}

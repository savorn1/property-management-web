// Wraps the backend's JournalEntryController (/api/journal-entries). Manual
// entries are created here; entries with sourceType !== 'MANUAL' are posted
// automatically elsewhere (payments/expenses/etc. via a JournalTemplate) and
// only ever show up read-only in this list.

import type { JournalSourceType } from '#shared/domain'

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID'

export interface JournalEntryLine {
  id: number
  lineNumber: number
  accountId: number
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description: string | null
}

export interface JournalEntry {
  id: number
  entryDate: string
  description: string | null
  financialPeriodId: number
  financialPeriodName: string | null
  status: JournalEntryStatus
  sourceType: JournalSourceType
  sourceId: number | null
  createdBy: string | null
  postedAt: string | null
  postedBy: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  totalDebit: number
  totalCredit: number
  lines: JournalEntryLine[]
  createdAt: string
  updatedAt: string
}

export interface JournalEntryFilter {
  status?: JournalEntryStatus
  sourceType?: JournalSourceType
  financialPeriodId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateJournalEntryLinePayload {
  accountId: number
  debit?: number
  credit?: number
  description?: string
}

export interface CreateJournalEntryPayload {
  entryDate: string
  description?: string
  lines: CreateJournalEntryLinePayload[]
}

export interface VoidJournalEntryPayload {
  reason?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

interface PageMetadata {
  hasNext: boolean
  hasPrev: boolean
  totalPage: number
  currentPage: number
  limit: number
  totalCount: number
}

interface PageEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T[]
  metadata: PageMetadata
}

export function useJournalEntries() {
  const api = useApi()

  function list(filter: JournalEntryFilter = {}) {
    return api<PageEnvelope<JournalEntry>>('/api/journal-entries', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<JournalEntry>>(`/api/journal-entries/${id}`)
    return res.data
  }

  async function create(payload: CreateJournalEntryPayload) {
    const res = await api<ApiEnvelope<JournalEntry>>('/api/journal-entries', { method: 'POST', body: payload })
    return res.data
  }

  async function post(id: number) {
    const res = await api<ApiEnvelope<JournalEntry>>(`/api/journal-entries/${id}/post`, { method: 'PUT' })
    return res.data
  }

  // Named voidEntry (not `void`) since `void` is a reserved word in JS/TS.
  async function voidEntry(id: number, payload: VoidJournalEntryPayload) {
    const res = await api<ApiEnvelope<JournalEntry>>(`/api/journal-entries/${id}/void`, { method: 'PUT', body: payload })
    return res.data
  }

  return { list, get, create, post, voidEntry }
}

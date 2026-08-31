// Wraps the backend's JournalTemplateController (/api/journal-templates). A
// template is a posting rule: whenever its triggerEvent business event fires
// elsewhere in the app, its lines tell AccountingPostingService which
// accounts/sides/amount-components to post a JournalEntry from.

import type { JournalSourceType } from '#shared/domain'

export type JournalLineSide = 'DEBIT' | 'CREDIT'

export interface JournalTemplateLine {
  id: number
  lineNumber: number
  accountId: number
  accountCode: string
  accountName: string
  side: JournalLineSide
  amountComponent: string
}

export interface JournalTemplate {
  id: number
  name: string
  code: string
  triggerEvent: JournalSourceType
  description: string | null
  active: boolean
  lines: JournalTemplateLine[]
  createdAt: string
  updatedAt: string
}

export interface JournalTemplateFilter {
  triggerEvent?: JournalSourceType
  active?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateJournalTemplateLinePayload {
  accountId: number
  side: JournalLineSide
  amountComponent: string
}

export interface CreateJournalTemplatePayload {
  name: string
  code: string
  triggerEvent: JournalSourceType
  description?: string
  lines: CreateJournalTemplateLinePayload[]
}

// triggerEvent isn't editable after create (per UpdateJournalTemplateRequest).
export interface UpdateJournalTemplatePayload {
  name: string
  description?: string
  lines: CreateJournalTemplateLinePayload[]
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

export function useJournalTemplates() {
  const api = useApi()

  function list(filter: JournalTemplateFilter = {}) {
    return api<PageEnvelope<JournalTemplate>>('/api/journal-templates', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<JournalTemplate>>(`/api/journal-templates/${id}`)
    return res.data
  }

  async function create(payload: CreateJournalTemplatePayload) {
    const res = await api<ApiEnvelope<JournalTemplate>>('/api/journal-templates', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdateJournalTemplatePayload) {
    const res = await api<ApiEnvelope<JournalTemplate>>(`/api/journal-templates/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateStatus(id: number, active: boolean) {
    const res = await api<ApiEnvelope<JournalTemplate>>(`/api/journal-templates/${id}/status`, {
      method: 'PUT',
      body: { active }
    })
    return res.data
  }

  return { list, get, create, update, updateStatus }
}

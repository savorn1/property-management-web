// Wraps the backend's UnitPriceController (/api/units/{unitId}/prices). A
// price history/schedule for a unit, keyed by PriceType (RENT or SALE) —
// distinct from UnitType.basePrice, which is just the template default new
// units inherit. The most recent entry for a given (unit, priceType) as of a
// date is the current price.

export type PriceType = 'RENT' | 'SALE'

export interface UnitPrice {
  id: number
  unitId: number
  priceType: PriceType
  amount: number
  effectiveDate: string
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export interface CreateUnitPricePayload {
  priceType: PriceType
  amount: number
  effectiveDate: string
  notes?: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useUnitPrices() {
  const api = useApi()

  async function list(unitId: number, priceType?: PriceType) {
    const res = await api<ApiEnvelope<UnitPrice[]>>(`/api/units/${unitId}/prices`, {
      query: priceType ? { priceType } : undefined
    })
    return res.data
  }

  async function getCurrent(unitId: number, priceType: PriceType) {
    const res = await api<ApiEnvelope<UnitPrice>>(`/api/units/${unitId}/prices/current`, {
      query: { priceType }
    })
    return res.data
  }

  async function create(unitId: number, payload: CreateUnitPricePayload) {
    const res = await api<ApiEnvelope<UnitPrice>>(`/api/units/${unitId}/prices`, {
      method: 'POST',
      body: payload
    })
    return res.data
  }

  return { list, getCurrent, create }
}

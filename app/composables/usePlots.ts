// Wraps the backend's PlotController (/api/plots). A plot is a surveyed
// parcel of land — the cadastral record a Property sits on. Its one true
// parent is streetId (Property -> Zone -> Street -> Plot -> Building ->
// Floor -> Unit); propertyId/propertyName and zoneId/zoneName are derived
// transitively through the street and included read-only for display and
// filtering, not settable directly.

// Three status fields, not one flat `status` — mirrors how Unit already
// keeps occupancyStatus and saleStatus separate, just with a third axis
// (reservation) on top. Names are prefixed `Plot*` — this app auto-imports
// every composable's exports into one global namespace, and
// `ReservationStatus`/`SaleStatus` already exist (useSaleReservations.ts /
// useUnits.ts) with different value sets, so the bare names would collide.
export type PlotAvailabilityStatus = 'AVAILABLE' | 'HOLD' | 'BLOCKED' | 'NOT_FOR_SALE'
export type PlotReservationStatus = 'NONE' | 'RESERVED' | 'EXPIRED'
export type PlotSaleStatus = 'NOT_SOLD' | 'CONTRACTED' | 'FULLY_PAID' | 'TRANSFERRED' | 'CANCELLED'
export type LandType = 'RESIDENTIAL' | 'COMMERCIAL' | 'AGRICULTURAL' | 'INDUSTRIAL' | 'MIXED_USE'

// The three fields above aren't independently free-combining — only six
// (availability, reservation, sale) triples actually occur in the plot
// lifecycle. This is the single source of truth for that state machine:
// pages should offer a "Stage" picker built from this list (setting all
// three fields at once) rather than three independent dropdowns, which would
// let someone create a combination — e.g. AVAILABLE + RESERVED + TRANSFERRED
// — that doesn't correspond to any real state.
//
// Key choice: reuses the matching raw field's own literal value as the stage
// key wherever one exists (AVAILABLE/HOLD/RESERVED/FULLY_PAID/TRANSFERRED are
// themselves valid values of one of the three fields below) — that's what
// lets StatusBadge render every stage with no separate color registration;
// only UNDER_CONTRACT has no single-field equivalent and needed its own.
export interface PlotStage {
  key: string
  label: string
  availabilityStatus: PlotAvailabilityStatus
  reservationStatus: PlotReservationStatus
  saleStatus: PlotSaleStatus
}

export const PLOT_STAGES: PlotStage[] = [
  { key: 'AVAILABLE', label: 'Available', availabilityStatus: 'AVAILABLE', reservationStatus: 'NONE', saleStatus: 'NOT_SOLD' },
  { key: 'HOLD', label: 'Hold', availabilityStatus: 'HOLD', reservationStatus: 'NONE', saleStatus: 'NOT_SOLD' },
  { key: 'RESERVED', label: 'Reserved', availabilityStatus: 'HOLD', reservationStatus: 'RESERVED', saleStatus: 'NOT_SOLD' },
  { key: 'UNDER_CONTRACT', label: 'Under contract', availabilityStatus: 'BLOCKED', reservationStatus: 'RESERVED', saleStatus: 'CONTRACTED' },
  { key: 'FULLY_PAID', label: 'Fully paid', availabilityStatus: 'BLOCKED', reservationStatus: 'NONE', saleStatus: 'FULLY_PAID' },
  { key: 'TRANSFERRED', label: 'Transferred', availabilityStatus: 'NOT_FOR_SALE', reservationStatus: 'NONE', saleStatus: 'TRANSFERRED' },
  // Exception paths, not the happy path above — a reservation that times out,
  // or a signed contract that falls through. Both dump the plot back to
  // Available (re-listable) rather than leaving it stuck mid-flow; kept as
  // their own named stages (rather than silently collapsing into Available)
  // so the history/table can still show *why* it's back on the market.
  { key: 'EXPIRED', label: 'Expired', availabilityStatus: 'AVAILABLE', reservationStatus: 'EXPIRED', saleStatus: 'NOT_SOLD' },
  { key: 'CANCELLED', label: 'Cancelled', availabilityStatus: 'AVAILABLE', reservationStatus: 'NONE', saleStatus: 'CANCELLED' }
]

// The plot flow only allows specific stage -> stage moves (not "any of the
// eight, freely"): Available can go on Hold or straight to Reserved; a Hold
// only ever releases back to Available; from Reserved it's mostly a one-way
// chain through to Transferred, except Reserved can also time out to Expired
// and Under contract can fall through to Cancelled — both of those dead-end
// back at Available. Pages should build their "next stage" picker from this
// (current stage + whatever it maps to here), not the full PLOT_STAGES list,
// so the UI itself can't offer a move the business process forbids.
export const PLOT_STAGE_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['HOLD', 'RESERVED'],
  HOLD: ['AVAILABLE'],
  RESERVED: ['UNDER_CONTRACT', 'EXPIRED'],
  UNDER_CONTRACT: ['FULLY_PAID', 'CANCELLED'],
  FULLY_PAID: ['TRANSFERRED'],
  TRANSFERRED: [],
  EXPIRED: ['AVAILABLE'],
  CANCELLED: ['AVAILABLE']
}

// Reverse lookup for display — a row's three raw fields -> its named stage.
// Returns undefined for a combination outside the six known stages (e.g.
// data from a cancelled sale, or a state the backend allows that isn't in
// the list above yet) — callers should fall back to showing the raw fields.
export function findPlotStage(plot: Pick<Plot, 'availabilityStatus' | 'reservationStatus' | 'saleStatus'>): PlotStage | undefined {
  return PLOT_STAGES.find(
    (s) =>
      s.availabilityStatus === plot.availabilityStatus &&
      s.reservationStatus === plot.reservationStatus &&
      s.saleStatus === plot.saleStatus
  )
}

// The stages selectable from a given current stage key — itself (so editing
// doesn't force a change) plus whatever PLOT_STAGE_TRANSITIONS allows next.
// `currentKey` undefined (new plot, or existing data outside the six known
// stages) returns every stage, since there's no "current" move to restrict from.
export function selectablePlotStages(currentKey: string | undefined): PlotStage[] {
  if (currentKey === undefined) return PLOT_STAGES
  const allowedKeys = new Set([currentKey, ...(PLOT_STAGE_TRANSITIONS[currentKey] ?? [])])
  return PLOT_STAGES.filter((s) => allowedKeys.has(s.key))
}

export interface Plot {
  id: number
  propertyId: number | null
  propertyName: string | null
  zoneId: number | null
  zoneName: string | null
  streetId: number
  code: string | null
  plotNumber: string
  landArea: number | null
  frontage: number | null
  depth: number | null
  width: number | null
  length: number | null
  landType: LandType | null
  salePrice: number | null
  pricePerM2: number | null
  availabilityStatus: PlotAvailabilityStatus | null
  reservationStatus: PlotReservationStatus | null
  saleStatus: PlotSaleStatus | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface PlotFilter {
  propertyId?: number
  zoneId?: number
  streetId?: number
  availabilityStatus?: PlotAvailabilityStatus
  reservationStatus?: PlotReservationStatus
  saleStatus?: PlotSaleStatus
  plotNumber?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreatePlotPayload {
  streetId: number
  code?: string
  plotNumber: string
  landArea?: number
  frontage?: number
  depth?: number
  width?: number
  length?: number
  landType?: LandType
  salePrice?: number
  pricePerM2?: number
  availabilityStatus?: PlotAvailabilityStatus
  reservationStatus?: PlotReservationStatus
  saleStatus?: PlotSaleStatus
  description?: string
}

export interface UpdatePlotPayload {
  code?: string
  plotNumber?: string
  landArea?: number
  frontage?: number
  depth?: number
  width?: number
  length?: number
  landType?: LandType
  salePrice?: number
  pricePerM2?: number
  availabilityStatus?: PlotAvailabilityStatus
  reservationStatus?: PlotReservationStatus
  saleStatus?: PlotSaleStatus
  description?: string
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

export function usePlots() {
  const api = useApi()

  function list(filter: PlotFilter = {}) {
    return api<PageEnvelope<Plot>>('/api/plots', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<Plot>>(`/api/plots/${id}`)
    return res.data
  }

  async function create(payload: CreatePlotPayload) {
    const res = await api<ApiEnvelope<Plot>>('/api/plots', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: UpdatePlotPayload) {
    const res = await api<ApiEnvelope<Plot>>(`/api/plots/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/plots/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}

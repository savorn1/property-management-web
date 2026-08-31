<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      class="mb-6"
      :title="error"
      icon="i-lucide-triangle-alert"
    />

    <section class="mb-8">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Property overview
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Total properties" :value="fmt(counts.properties)" icon="i-lucide-building" :loading="loading" to="/properties" />
        <StatTile label="Total buildings" :value="fmt(counts.buildings)" icon="i-lucide-building-2" :loading="loading" to="/buildings" />
        <StatTile label="Total floors" :value="fmt(counts.floors)" icon="i-lucide-layers" :loading="loading" to="/floors" />
        <StatTile label="Total units" :value="fmt(occupancy?.totalUnits)" icon="i-lucide-door-open" :loading="loading" to="/units" />
        <StatTile
          label="Active properties"
          :value="fmt(activePropertyCount)"
          sublabel="≥ 1 active lease"
          icon="i-lucide-badge-check"
          color="success"
          :loading="loading"
          to="/properties"
        />
      </div>
    </section>

    <section class="mb-8">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Unit overview
      </h2>

      <UCard class="mb-4">
        <div v-if="loading" class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <template v-else-if="occupancy && occupancy.totalUnits > 0">
          <div class="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <div
              v-for="segment in unitSegments"
              :key="segment.key"
              :style="{ width: `${(segment.value / occupancy.totalUnits) * 100}%` }"
              :class="segment.barClass"
              :title="`${segment.label}: ${segment.value} (${((segment.value / occupancy!.totalUnits) * 100).toFixed(1)}%)`"
              class="h-full border-r-2 border-white dark:border-gray-950 last:border-r-0"
            />
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
            <span v-for="segment in unitSegments" :key="segment.key" class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="segment.dotClass" />
              {{ segment.label }}
              <span class="font-medium text-gray-900 dark:text-white">{{ segment.value }}</span>
            </span>
          </div>
        </template>
        <EmptyState v-else icon="i-lucide-door-open" title="No units yet" description="Add units to see the occupancy breakdown here." />
      </UCard>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile label="Occupied" :value="fmt(occupancy?.occupiedUnits)" icon="i-lucide-door-closed" color="info" :loading="loading" to="/units?occupancyStatus=OCCUPIED" />
        <StatTile label="Available" :value="fmt(occupancy?.availableUnits)" icon="i-lucide-check-circle" color="success" :loading="loading" to="/units?occupancyStatus=VACANT" />
        <StatTile label="Reserved" :value="fmt(occupancy?.reservedUnits)" icon="i-lucide-bookmark" color="warning" :loading="loading" to="/units?occupancyStatus=RESERVED" />
        <StatTile label="Maintenance" :value="fmt(occupancy?.maintenanceUnits)" icon="i-lucide-wrench" color="warning" :loading="loading" to="/units?occupancyStatus=MAINTENANCE" />
        <StatTile label="Blocked" :value="fmt(occupancy?.unavailableUnits)" icon="i-lucide-ban" color="neutral" :loading="loading" to="/units?occupancyStatus=UNAVAILABLE" />
        <StatTile label="Occupancy rate" :value="occupancyRateLabel" icon="i-lucide-percent" color="primary" :loading="loading" />
      </div>
    </section>

    <section>
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Rental overview
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatTile label="Active tenants" :value="fmt(counts.activeTenants)" icon="i-lucide-user-round" :loading="loading" to="/tenants?status=ACTIVE" />
        <StatTile label="Active leases" :value="fmt(counts.activeLeases)" icon="i-lucide-file-signature" :loading="loading" to="/leases?status=ACTIVE" />

        <UCard class="sm:col-span-2" :ui="{ body: 'h-full flex flex-col justify-center' }">
          <div v-if="loading" class="space-y-2">
            <div class="h-4 w-40 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div class="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
          <template v-else-if="monthlyRent > 0">
            <div class="flex items-baseline justify-between mb-1.5">
              <p class="text-sm text-gray-500 dark:text-gray-400">Rent collected this month</p>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ collectionRateLabel }}</p>
            </div>
            <div class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-success transition-[width]"
                :style="{ width: `${collectionRatePercent}%` }"
              />
            </div>
            <p class="text-sm mt-2">
              <span class="font-semibold text-gray-900 dark:text-white">{{ fmtCurrency(revenue?.rentCollected) }}</span>
              <span class="text-gray-400 dark:text-gray-500"> of {{ fmtCurrency(monthlyRent) }} expected</span>
            </p>
          </template>
          <EmptyState v-else icon="i-lucide-wallet" title="No active leases" description="Rent collection tracking appears once a lease is active." />
        </UCard>

        <StatTile label="Outstanding rent" :value="fmtCurrency(collections?.outstandingInvoiceAmount)" icon="i-lucide-hourglass" color="warning" :loading="loading" />
        <StatTile label="Overdue rent" :value="fmtCurrency(collections?.overdueInvoiceAmount)" icon="i-lucide-triangle-alert" color="warning" :loading="loading" />
      </div>
    </section>

    <section>
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Sales overview
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatTile label="Buyers" :value="fmt(counts.buyers)" icon="i-lucide-handshake" :loading="loading" to="/buyers" />
        <StatTile label="Active reservations" :value="fmt(counts.activeReservations)" icon="i-lucide-bookmark" :loading="loading" to="/sale-reservations?status=ACTIVE" />
        <StatTile label="Active sale agreements" :value="fmt(counts.activeSaleAgreements)" icon="i-lucide-file-signature" :loading="loading" to="/sale-agreements?status=ACTIVE" />
        <StatTile label="Sales collected" :sublabel="periodLabel" :value="fmtCurrency(revenue?.salesCollected)" icon="i-lucide-wallet" color="success" :loading="loading" />
        <StatTile label="Outstanding installments" :value="fmtCurrency(collections?.outstandingInstallmentAmount)" icon="i-lucide-hourglass" color="warning" :loading="loading" />
        <StatTile label="Overdue installments" :value="fmtCurrency(collections?.overdueInstallmentAmount)" icon="i-lucide-triangle-alert" color="warning" :loading="loading" />
      </div>
    </section>

    <section>
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Operations overview
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Open maintenance requests" :value="fmt(counts.openMaintenanceRequests)" icon="i-lucide-wrench" color="warning" :loading="loading" to="/maintenance?status=OPEN" />
        <StatTile label="Pending utility bills" :value="fmt(counts.pendingUtilityBills)" icon="i-lucide-zap" color="warning" :loading="loading" to="/utility-bills?status=PENDING" />
        <StatTile label="Available parking spots" :value="fmt(counts.availableParkingSpots)" icon="i-lucide-square-parking" color="success" :loading="loading" to="/parking-spots?status=AVAILABLE" />
        <StatTile label="Utility collected" :sublabel="periodLabel" :value="fmtCurrency(revenue?.utilityCollected)" icon="i-lucide-wallet" color="success" :loading="loading" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Lease } from '~/composables/useLeases'
import type { CollectionsReport, OccupancyReport, RevenueReport } from '~/composables/useReports'

const { list: listProperties } = useProperties()
const { list: listBuildings } = useBuildings()
const { list: listFloors } = useFloors()
const { list: listTenants } = useTenants()
const { list: listLeases } = useLeases()
const { list: listBuyers } = useBuyers()
const { list: listSaleReservations } = useSaleReservations()
const { list: listSaleAgreements } = useSaleAgreements()
const { list: listMaintenance } = useMaintenance()
const { list: listUtilityBills } = useUtilityBills()
const { list: listParkingSpots } = useParkingSpots()
const { getOccupancy, getCollections, getRevenue } = useReports()

const loading = ref(true)
const error = ref('')

const counts = reactive({
  properties: undefined as number | undefined,
  buildings: undefined as number | undefined,
  floors: undefined as number | undefined,
  activeTenants: undefined as number | undefined,
  activeLeases: undefined as number | undefined,
  buyers: undefined as number | undefined,
  activeReservations: undefined as number | undefined,
  activeSaleAgreements: undefined as number | undefined,
  openMaintenanceRequests: undefined as number | undefined,
  pendingUtilityBills: undefined as number | undefined,
  availableParkingSpots: undefined as number | undefined
})

const occupancy = ref<OccupancyReport | null>(null)
const collections = ref<CollectionsReport | null>(null)
const revenue = ref<RevenueReport | null>(null)
const activeLeaseRows = ref<Lease[]>([])

const monthlyRent = computed(() => activeLeaseRows.value.reduce((sum, l) => sum + (l.rentAmount ?? 0), 0))
const activePropertyCount = computed(() => new Set(activeLeaseRows.value.map((l) => l.propertyId).filter(Boolean)).size)

// occupancyRate's exact convention (0–1 fraction vs. 0–100 percent) isn't
// pinned down by the OpenAPI schema (just "number") — handle both so this
// doesn't silently show "7550%" or "0.76%" depending on which the backend
// actually sends.
const occupancyRateLabel = computed(() => {
  const rate = occupancy.value?.occupancyRate
  if (rate === undefined || rate === null) return '—'
  const percent = rate <= 1 ? rate * 100 : rate
  return `${percent.toFixed(1)}%`
})

// Five distinct hues (not the same tokens StatusBadge uses for these
// statuses one-at-a-time) — Reserved and Maintenance both read as "warning"
// on a badge, but sitting side by side in one bar they need to stay visually
// separable, so Maintenance takes secondary (violet) here instead.
const unitSegments = computed(() => {
  if (!occupancy.value) return []
  return [
    { key: 'occupied', label: 'Occupied', value: occupancy.value.occupiedUnits, barClass: 'bg-info', dotClass: 'bg-info' },
    { key: 'available', label: 'Available', value: occupancy.value.availableUnits, barClass: 'bg-success', dotClass: 'bg-success' },
    { key: 'reserved', label: 'Reserved', value: occupancy.value.reservedUnits, barClass: 'bg-warning', dotClass: 'bg-warning' },
    { key: 'maintenance', label: 'Maintenance', value: occupancy.value.maintenanceUnits, barClass: 'bg-secondary', dotClass: 'bg-secondary' },
    { key: 'blocked', label: 'Blocked', value: occupancy.value.unavailableUnits, barClass: 'bg-gray-400 dark:bg-gray-600', dotClass: 'bg-gray-400 dark:bg-gray-600' },
    { key: 'sold', label: 'Sold', value: occupancy.value.soldUnits, barClass: 'bg-gray-200 dark:bg-gray-700', dotClass: 'bg-gray-200 dark:bg-gray-700' }
  ].filter((s) => s.value > 0)
})

const collectionRatePercent = computed(() => {
  if (monthlyRent.value <= 0) return 0
  return Math.min(100, ((revenue.value?.rentCollected ?? 0) / monthlyRent.value) * 100)
})
const collectionRateLabel = computed(() => `${collectionRatePercent.value.toFixed(0)}%`)

function fmt(value: number | undefined) {
  return value === undefined ? '—' : String(value)
}

function fmtCurrency(value: number | undefined) {
  return formatCurrency(value)
}

const periodLabel = 'This month'

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const toIso = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: toIso(start), endDate: toIso(now) }
}

async function load() {
  loading.value = true
  error.value = ''
  const { startDate, endDate } = monthRange()
  try {
    const [
      propertiesRes,
      buildingsRes,
      floorsRes,
      tenantsRes,
      leasesRes,
      buyersRes,
      reservationsRes,
      saleAgreementsRes,
      openMaintenanceRes,
      pendingUtilityBillsRes,
      availableParkingSpotsRes,
      occupancyRes,
      collectionsRes,
      revenueRes
    ] = await Promise.all([
      listProperties({ size: 1 }),
      listBuildings({ size: 1 }),
      listFloors({ size: 1 }),
      listTenants({ status: 'ACTIVE', size: 1 }),
      listLeases({ status: 'ACTIVE', size: 500 }),
      listBuyers({ size: 1 }),
      listSaleReservations({ status: 'ACTIVE', size: 1 }),
      listSaleAgreements({ status: 'ACTIVE', size: 1 }),
      listMaintenance({ status: 'OPEN', size: 1 }),
      listUtilityBills({ status: 'PENDING', size: 1 }),
      listParkingSpots({ status: 'AVAILABLE', size: 1 }),
      getOccupancy(),
      getCollections(),
      getRevenue(startDate, endDate)
    ])
    counts.properties = propertiesRes.metadata.totalCount
    counts.buildings = buildingsRes.metadata.totalCount
    counts.floors = floorsRes.metadata.totalCount
    counts.activeTenants = tenantsRes.metadata.totalCount
    counts.activeLeases = leasesRes.metadata.totalCount
    counts.buyers = buyersRes.metadata.totalCount
    counts.activeReservations = reservationsRes.metadata.totalCount
    counts.activeSaleAgreements = saleAgreementsRes.metadata.totalCount
    counts.openMaintenanceRequests = openMaintenanceRes.metadata.totalCount
    counts.pendingUtilityBills = pendingUtilityBillsRes.metadata.totalCount
    counts.availableParkingSpots = availableParkingSpotsRes.metadata.totalCount
    activeLeaseRows.value = leasesRes.data
    occupancy.value = occupancyRes
    collections.value = collectionsRes
    revenue.value = revenueRes
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

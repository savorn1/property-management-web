<template>
  <div>
    <UButton to="/properties" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" class="mb-4">
      Properties
    </UButton>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div v-if="loading && !property" class="space-y-4">
      <div class="h-8 w-64 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div class="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
    </div>

    <template v-else-if="property">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ property.name }}</h1>
            <UBadge v-if="property.type" color="neutral" variant="subtle" size="sm">{{ formatEnum(property.type) }}</UBadge>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ addressLine }}
            <span v-if="property.code" class="text-gray-400 dark:text-gray-500"> · {{ property.code }}</span>
            <span v-if="property.zoneName" class="text-gray-400 dark:text-gray-500"> · {{ property.zoneName }}</span>
          </p>
        </div>
        <UButton icon="i-lucide-building-2" color="neutral" variant="soft" :to="`/buildings?propertyId=${property.id}`">
          {{ buildingCount ?? 0 }} building{{ buildingCount === 1 ? '' : 's' }}
        </UButton>
      </div>

      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Units
        </h2>
        <UCard>
          <div v-if="loading" class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <template v-else-if="units.length > 0">
            <div class="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              <div
                v-for="segment in unitSegments"
                :key="segment.key"
                :style="{ width: `${(segment.value / units.length) * 100}%` }"
                :class="segment.barClass"
                :title="`${segment.label}: ${segment.value}`"
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
          <EmptyState v-else icon="i-lucide-door-open" title="No units yet" description="Units for this property will show up here once added." />
        </UCard>
      </section>

      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Rental
        </h2>
        <UCard>
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
            <span class="text-gray-500 dark:text-gray-400">
              Active leases <span class="font-semibold text-gray-900 dark:text-white">{{ activeLeases.length }}</span>
            </span>
            <span class="text-gray-500 dark:text-gray-400">
              Total monthly rent <span class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(activeRentTotal) }}</span>
            </span>
          </div>
          <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="leases.length === 0" class="text-sm text-gray-400">No leases for this property yet.</div>
          <div v-else class="space-y-1.5">
            <div
              v-for="lease in leases"
              :key="lease.id"
              class="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <div class="min-w-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ lease.tenantName ?? 'Tenant' }}</span>
                <span class="text-gray-400"> · Unit {{ lease.unitNumber ?? '—' }}</span>
                <span class="text-gray-400"> · {{ formatDate(lease.startDate) }} – {{ formatDate(lease.endDate) }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(lease.rentAmount) }}</span>
                <StatusBadge :status="lease.status" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" @click="navigateTo(`/leases?unitId=${lease.unitId}`)" />
              </div>
            </div>
          </div>
        </UCard>
      </section>

      <section>
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Sales
        </h2>
        <UCard>
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
            <span class="text-gray-500 dark:text-gray-400">
              Active agreements <span class="font-semibold text-gray-900 dark:text-white">{{ activeSaleAgreements.length }}</span>
            </span>
            <span class="text-gray-500 dark:text-gray-400">
              Total sale value <span class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(activeSaleValueTotal) }}</span>
            </span>
          </div>
          <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="saleAgreements.length === 0" class="text-sm text-gray-400">No sale agreements for this property yet.</div>
          <div v-else class="space-y-1.5">
            <div
              v-for="agreement in saleAgreements"
              :key="agreement.id"
              class="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <div class="min-w-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ agreement.buyerName ?? 'Buyer' }}</span>
                <span class="text-gray-400"> · Unit {{ agreement.unitNumber ?? '—' }}</span>
                <span class="text-gray-400"> · {{ formatDate(agreement.agreementDate) }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(agreement.netPrice) }}</span>
                <StatusBadge :status="agreement.status" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" @click="navigateTo(`/sale-agreements?unitId=${agreement.unitId}`)" />
              </div>
            </div>
          </div>
        </UCard>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PropertyItem } from '~/composables/useProperties'
import type { Unit } from '~/composables/useUnits'
import type { Lease } from '~/composables/useLeases'
import type { SaleAgreement } from '~/composables/useSaleAgreements'

const route = useRoute()
const propertyId = computed(() => Number(route.params.id))

const { get: getProperty } = useProperties()
const { list: listBuildings } = useBuildings()
const { list: listUnits } = useUnits()
const { list: listLeases } = useLeases()
const { list: listSaleAgreements } = useSaleAgreements()

const loading = ref(true)
const error = ref('')

const property = ref<PropertyItem | null>(null)
const buildingCount = ref<number | undefined>(undefined)
const units = ref<Unit[]>([])
const leases = ref<Lease[]>([])
const saleAgreements = ref<SaleAgreement[]>([])

const addressLine = computed(() => {
  if (!property.value) return '—'
  const parts = [property.value.address, property.value.city, property.value.state, property.value.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '—'
})

const activeLeases = computed(() => leases.value.filter((l) => l.status === 'ACTIVE'))
const activeRentTotal = computed(() => activeLeases.value.reduce((sum, l) => sum + l.rentAmount, 0))
const activeSaleAgreements = computed(() => saleAgreements.value.filter((a) => a.status === 'ACTIVE'))
const activeSaleValueTotal = computed(() => activeSaleAgreements.value.reduce((sum, a) => sum + a.netPrice, 0))

// Occupancy only (VACANT/OCCUPIED) — sale status (NOT_FOR_SALE/AVAILABLE/
// RESERVED/SOLD) and maintenance status (NORMAL/MAINTENANCE) are separate
// dimensions on Unit, not part of occupancy (see useUnits.ts).
const UNIT_OCCUPANCY_SEGMENTS: { key: string; label: string; status: Unit['occupancyStatus']; barClass: string; dotClass: string }[] = [
  { key: 'occupied', label: 'Occupied', status: 'OCCUPIED', barClass: 'bg-info', dotClass: 'bg-info' },
  { key: 'vacant', label: 'Vacant', status: 'VACANT', barClass: 'bg-success', dotClass: 'bg-success' }
]
const unitSegments = computed(() =>
  UNIT_OCCUPANCY_SEGMENTS.map((segment) => ({
    ...segment,
    value: units.value.filter((u) => u.occupancyStatus === segment.status).length
  })).filter((s) => s.value > 0)
)

function is404(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status === 404
}

// Units, leases, and sale agreements can't be filtered by propertyId
// server-side (UnitFilter only takes unitTypeId; LeaseFilter/SaleAgreementFilter
// only take unitId) — so, same as the dashboard's activePropertyCount, we fetch
// broadly and filter client-side using each row's denormalized propertyId/unitId.
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [propertyRes, buildingsRes, unitsRes, leasesRes, saleAgreementsRes] = await Promise.all([
      getProperty(propertyId.value),
      listBuildings({ propertyId: propertyId.value, size: 1 }),
      listUnits({ size: 500 }),
      listLeases({ size: 500 }),
      listSaleAgreements({ size: 500 })
    ])
    property.value = propertyRes
    buildingCount.value = buildingsRes.metadata.totalCount
    units.value = unitsRes.data.filter((u) => u.propertyId === propertyId.value)
    const unitIds = new Set(units.value.map((u) => u.id))
    leases.value = leasesRes.data.filter((l) => l.propertyId === propertyId.value)
    saleAgreements.value = saleAgreementsRes.data.filter((a) => unitIds.has(a.unitId))
  } catch (err) {
    error.value = is404(err) ? 'Property not found.' : apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

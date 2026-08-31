<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Sale reservations</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New reservation</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.saleListingId" :items="listingFilterOptions" placeholder="Listing" class="w-56" />
        <USelect v-model="filter.buyerId" :items="buyerFilterOptions" placeholder="Buyer" class="w-56" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-44" />
        <UButton
          v-if="hasActiveFilter"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="clearFilters"
        >
          Clear filters
        </UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="sale-reservations"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="isAdmin && row.status === 'ACTIVE'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-file-signature"
              @click="createAgreementFrom(row)"
            >
              Create agreement
            </UButton>
            <UButton
              v-if="isAdmin && row.status === 'ACTIVE'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-ban"
              @click="openCancelWith(row)"
            >
              Cancel
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-settings-2" @click="openManageWith(row)">
              Deposits
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No reservations match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-bookmark" title="No sale reservations yet" description="Reserve a listing for a buyer to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New reservation</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New sale reservation">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="createFields"
          :loading="creating"
          :error="createError"
          submit-label="Create"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showCancel" :title="`Cancel reservation for '${cancelTarget?.buyerName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="cancelForm"
          :fields="cancelFields"
          :loading="cancelLoading"
          :error="cancelError"
          submit-label="Cancel reservation"
          cancelable
          @submit="onCancelSubmit"
          @cancel="showCancel = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showManage" :title="`Deposit payments · ${manageTarget?.buyerName ?? ''} — Unit ${manageTarget?.unitNumber ?? ''}`">
      <template #body>
        <div v-if="depositsLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="deposits.length === 0" class="text-sm text-gray-400 mb-3">No deposit payments recorded yet.</div>
        <div v-else class="space-y-1.5 mb-4">
          <div
            v-for="p in deposits"
            :key="p.id"
            class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
          >
            <span class="text-gray-600 dark:text-gray-300">
              {{ formatDate(p.paymentDate) }} · {{ formatEnum(p.method) }}
              <span v-if="p.referenceNumber" class="text-gray-400">({{ p.referenceNumber }})</span>
            </span>
            <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(p.amount) }}</span>
          </div>
        </div>
        <DynamicForm
          v-if="isAdmin && manageTarget?.status === 'ACTIVE'"
          v-model="depositForm"
          :fields="depositFields"
          :loading="depositSaving"
          :error="depositError"
          submit-label="Add payment"
          @submit="onAddDeposit"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { SaleReservation, ReservationStatus, SalePayment } from '~/composables/useSaleReservations'

const { list, create, cancel, listDepositPayments, createDepositPayment } = useSaleReservations()
const { list: listListings } = useSaleListings()
const { list: listBuyers } = useBuyers()
const { isAdmin } = useAuth()
const toast = useToast()
const router = useRouter()
const route = useRoute()

const rows = ref<SaleReservation[]>([])
const loading = ref(false)
const error = ref('')

const initialStatus = (route.query.status as ReservationStatus | undefined) || undefined
const filter = reactive<{ saleListingId: number | undefined; buyerId: number | undefined; status: ReservationStatus | undefined }>({
  saleListingId: undefined,
  buyerId: undefined,
  status: initialStatus
})

const listingOptions = ref<{ label: string; value: number }[]>([])
const activeListingOptions = ref<{ label: string; value: number }[]>([])
const buyerOptions = ref<{ label: string; value: number }[]>([])
const listingFilterOptions = computed(() => [{ label: 'All listings', value: undefined }, ...listingOptions.value])
const buyerFilterOptions = computed(() => [{ label: 'All buyers', value: undefined }, ...buyerOptions.value])

async function loadOptions() {
  const [listingsRes, buyersRes] = await Promise.all([listListings({ size: 200 }), listBuyers({ size: 200 })])
  listingOptions.value = listingsRes.data.map((l) => ({
    label: `${l.unitNumber ?? '—'} · ${formatCurrency(l.askingPrice)} (${formatEnum(l.status)})`,
    value: l.id
  }))
  activeListingOptions.value = listingsRes.data
    .filter((l) => l.status === 'ACTIVE')
    .map((l) => ({ label: `${l.unitNumber ?? '—'} · ${formatCurrency(l.askingPrice)}`, value: l.id }))
  buyerOptions.value = buyersRes.data.map((b) => ({ label: b.fullName, value: b.id }))
}

const STATUS_OPTIONS: { label: string; value: ReservationStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Converted', value: 'CONVERTED' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Cancelled', value: 'CANCELLED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'id', direction: 'desc' })
const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<SaleReservation>[] = [
  { key: 'buyerName', label: 'Buyer', value: (row) => row.buyerName ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'reservationDate', label: 'Reserved', type: 'date' },
  { key: 'expiryDate', label: 'Expires', type: 'date' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      saleListingId: filter.saleListingId,
      buyerId: filter.buyerId,
      status: filter.status,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      size: 200
    })
    rows.value = res.data
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const createFields = computed<FieldDef[]>(() => [
  { name: 'saleListingId', label: 'Listing', type: 'select', required: true, options: activeListingOptions.value },
  { name: 'buyerId', label: 'Buyer', type: 'select', required: true, options: buyerOptions.value },
  { name: 'reservationDate', label: 'Reservation date', type: 'date', required: true, wrapper: 'half', default: new Date().toISOString().slice(0, 10) },
  { name: 'expiryDate', label: 'Expiry date', type: 'date', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})
function openCreate() {
  createForm.value = { reservationDate: new Date().toISOString().slice(0, 10) }
  createError.value = ''
  showCreate.value = true
}
async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  try {
    await create({
      saleListingId: values.saleListingId,
      buyerId: values.buyerId,
      reservationDate: values.reservationDate,
      expiryDate: values.expiryDate || undefined,
      notes: values.notes || undefined
    })
    toast.add({ title: 'Sale reservation created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Cancel
const {
  open: showCancel,
  target: cancelTarget,
  loading: cancelLoading,
  error: cancelError,
  openWith: openCancelWith
} = useTargetModal<SaleReservation>()
const cancelForm = ref<Record<string, any>>({})
const cancelFields: FieldDef[] = [{ name: 'reason', type: 'textarea' }]
watch(showCancel, (value) => {
  if (value) cancelForm.value = {}
})
async function onCancelSubmit(values: Record<string, any>) {
  if (!cancelTarget.value) return
  cancelLoading.value = true
  cancelError.value = ''
  try {
    await cancel(cancelTarget.value.id, values.reason || undefined)
    showCancel.value = false
    toast.add({ title: 'Reservation cancelled', color: 'success' })
    await load()
  } catch (err) {
    cancelError.value = apiErrorMessage(err)
  } finally {
    cancelLoading.value = false
  }
}

// Create sale agreement from an active reservation — hands off to the Sale
// Agreements page, which reads these query params to prefill & open its
// create modal (CreateSaleAgreementRequest.unitId/buyerId are required;
// saleListingId/reservationId are optional back-references).
function createAgreementFrom(row: SaleReservation) {
  router.push({
    path: '/sale-agreements',
    query: {
      reservationId: row.id,
      saleListingId: row.saleListingId,
      unitId: row.unitId,
      buyerId: row.buyerId
    }
  })
}

// Manage — deposit payments (SalePaymentType.RESERVATION_DEPOSIT)
const {
  open: showManage,
  target: manageTarget,
  openWith: openManageWith
} = useTargetModal<SaleReservation>()
const deposits = ref<SalePayment[]>([])
const depositsLoading = ref(false)
const depositForm = ref<Record<string, any>>({})
const depositSaving = ref(false)
const depositError = ref('')
const depositFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
watch(showManage, async (value) => {
  if (!value || !manageTarget.value) return
  depositForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
  depositError.value = ''
  depositsLoading.value = true
  try {
    deposits.value = await listDepositPayments(manageTarget.value.id)
  } catch (err) {
    depositError.value = apiErrorMessage(err)
  } finally {
    depositsLoading.value = false
  }
})
async function onAddDeposit(values: Record<string, any>) {
  if (!manageTarget.value) return
  depositSaving.value = true
  depositError.value = ''
  try {
    await createDepositPayment(manageTarget.value.id, {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method,
      referenceNumber: values.referenceNumber || undefined,
      notes: values.notes || undefined
    })
    deposits.value = await listDepositPayments(manageTarget.value.id)
    depositForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Deposit payment recorded', color: 'success' })
  } catch (err) {
    depositError.value = apiErrorMessage(err)
  } finally {
    depositSaving.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.saleListingId, filter.buyerId, filter.status], load)

const hasActiveFilter = computed(
  () => filter.saleListingId !== undefined || filter.buyerId !== undefined || filter.status !== undefined
)
function clearFilters() {
  filter.saleListingId = undefined
  filter.buyerId = undefined
  filter.status = undefined
  load()
}
</script>

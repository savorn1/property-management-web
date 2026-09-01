<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Sale listings</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New listing</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.unitId" :items="unitFilterOptions" placeholder="Unit" class="w-56" />
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
        export-filename="sale-listings"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div v-if="isAdmin" class="flex flex-wrap items-center gap-2">
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
              Edit
            </UButton>
            <UButton
              v-if="row.status === 'ACTIVE' || row.status === 'RESERVED'"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-tag"
              @click="openPriceWith(row)"
            >
              Update price
            </UButton>
            <UButton
              v-if="row.status === 'ACTIVE' || row.status === 'RESERVED'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-ban"
              @click="openWithdrawWith(row)"
            >
              Withdraw
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No listings match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-tag" title="No sale listings yet" description="List a unit for sale to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New listing</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New sale listing">
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

    <UModal v-model:open="showEdit" title="Edit sale listing">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showPrice" :title="`Update price · Unit ${priceTarget?.unitNumber ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="priceForm"
          :fields="priceFields"
          :loading="priceLoading"
          :error="priceError"
          submit-label="Update price"
          cancelable
          @submit="onPriceSubmit"
          @cancel="showPrice = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="withdrawTarget !== null"
      title="Withdraw listing"
      :description="`Withdraw the sale listing for unit '${withdrawTarget?.unitNumber ?? ''}'? It will no longer be available to reserve.`"
      confirm-label="Withdraw"
      color="error"
      :loading="withdrawing"
      @update:model-value="(v: boolean) => { if (!v) withdrawTarget = null }"
      @confirm="onWithdraw"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { SaleListing, SaleListingStatus } from '~/composables/useSaleListings'

const { list, create, update, updatePrice, withdraw } = useSaleListings()
const { list: listUnits } = useUnits()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<SaleListing[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ unitId: number | undefined; status: SaleListingStatus | undefined }>({
  unitId: undefined,
  status: undefined
})

const unitOptions = ref<{ label: string; value: number }[]>([])
const unitFilterOptions = computed(() => [{ label: 'All units', value: undefined }, ...unitOptions.value])

const STATUS_OPTIONS: { label: string; value: SaleListingStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Sold', value: 'SOLD' },
  { label: 'Withdrawn', value: 'WITHDRAWN' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const res = await listUnits({ size: 200 })
  unitOptions.value = res.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'id', direction: 'desc' })
const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<SaleListing>[] = [
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'buildingName', label: 'Building', value: (row) => row.buildingName ?? '—' },
  { key: 'askingPrice', label: 'Asking price', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'listedDate', label: 'Listed', type: 'date' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      unitId: filter.unitId,
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
  { name: 'unitId', label: 'Unit', type: 'select', required: true, options: unitOptions.value },
  { name: 'askingPrice', label: 'Asking price', type: 'currency', required: true, wrapper: 'half' },
  { name: 'listedDate', label: 'Listed date', type: 'date', required: true, wrapper: 'half', default: new Date().toISOString().slice(0, 10) },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])
const editFields: FieldDef[] = [{ name: 'description', type: 'textarea', wrapper: 'full' }]

// No useCrudModals — create/update use different field sets (only `description`
// is editable after creation) and there's no delete endpoint, only withdraw.
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})

function openCreate() {
  createForm.value = { listedDate: new Date().toISOString().slice(0, 10) }
  createError.value = ''
  showCreate.value = true
}

async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  try {
    await create({
      unitId: values.unitId,
      askingPrice: values.askingPrice,
      listedDate: values.listedDate,
      description: values.description || undefined
    })
    toast.add({ title: 'Sale listing created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

const {
  open: showEdit,
  target: editTarget,
  loading: editing,
  error: editError,
  openWith: openEditWith
} = useTargetModal<SaleListing>()
const editForm = ref<Record<string, any>>({})
function openEdit(row: SaleListing) {
  openEditWith(row)
  editForm.value = { description: row.description ?? undefined }
}
async function onEdit(values: Record<string, any>) {
  if (!editTarget.value) return
  editing.value = true
  editError.value = ''
  try {
    await update(editTarget.value.id, { description: values.description || undefined })
    showEdit.value = false
    toast.add({ title: 'Sale listing updated', color: 'success' })
    await load()
  } catch (err) {
    editError.value = apiErrorMessage(err)
  } finally {
    editing.value = false
  }
}

const {
  open: showPrice,
  target: priceTarget,
  loading: priceLoading,
  error: priceError,
  openWith: openPriceWith
} = useTargetModal<SaleListing>()
const priceForm = ref<Record<string, any>>({})
const priceFields: FieldDef[] = [{ name: 'askingPrice', label: 'Asking price', type: 'currency', required: true }]
watch(showPrice, (value) => {
  if (value && priceTarget.value) priceForm.value = { askingPrice: priceTarget.value.askingPrice }
})
async function onPriceSubmit(values: Record<string, any>) {
  if (!priceTarget.value) return
  priceLoading.value = true
  priceError.value = ''
  try {
    await updatePrice(priceTarget.value.id, values.askingPrice)
    showPrice.value = false
    toast.add({ title: 'Sale price updated', color: 'success' })
    await load()
  } catch (err) {
    priceError.value = apiErrorMessage(err)
  } finally {
    priceLoading.value = false
  }
}

const withdrawTarget = ref<SaleListing | null>(null)
const withdrawing = ref(false)
function openWithdrawWith(row: SaleListing) {
  withdrawTarget.value = row
}
async function onWithdraw() {
  if (!withdrawTarget.value) return
  withdrawing.value = true
  try {
    await withdraw(withdrawTarget.value.id)
    toast.add({ title: 'Sale listing withdrawn', color: 'success' })
    withdrawTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not withdraw listing', description: apiErrorMessage(err), color: 'error' })
  } finally {
    withdrawing.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.unitId, filter.status], load)

const hasActiveFilter = computed(() => filter.unitId !== undefined || filter.status !== undefined)
function clearFilters() {
  filter.unitId = undefined
  filter.status = undefined
  load()
}
</script>

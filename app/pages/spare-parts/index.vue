<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Spare parts</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New spare part</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="filter.name"
          placeholder="Search name"
          icon="i-lucide-search"
          class="w-56"
          @keyup.enter="load"
        />
        <USelect v-model="filter.vendorId" :items="vendorFilterOptions" placeholder="Vendor" class="w-56" />
        <USelect v-model="filter.active" :items="activeFilterOptions" placeholder="Status" class="w-40" />
        <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-search" @click="load">Search</UButton>
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

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      class="mb-4"
      :title="error"
      icon="i-lucide-triangle-alert"
    />
    <TruncatedResultsAlert v-if="truncated" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="spare-parts"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-package-plus"
              @click.stop="openStockWith(row)"
            >
              Adjust stock
            </UButton>
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
              Edit
            </UButton>
            <UButton
              size="xs"
              :color="row.active ? 'error' : 'success'"
              variant="soft"
              :icon="row.active ? 'i-lucide-ban' : 'i-lucide-check'"
              @click.stop="openStatusWith(row)"
            >
              {{ row.active ? 'Deactivate' : 'Activate' }}
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No spare parts match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-cog" title="No spare parts yet" description="Add the first spare part to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New spare part</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New spare part">
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

    <UModal v-model:open="showEdit" :title="`Edit spare part '${editingRow?.name ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="statusTarget !== null"
      :title="statusTarget?.active ? 'Deactivate spare part' : 'Activate spare part'"
      :description="
        statusTarget?.active
          ? `Deactivate spare part '${statusTarget?.name ?? ''}'?`
          : `Activate spare part '${statusTarget?.name ?? ''}'?`
      "
      :confirm-label="statusTarget?.active ? 'Deactivate' : 'Activate'"
      :color="statusTarget?.active ? 'error' : 'success'"
      :loading="statusLoading"
      @update:model-value="(v: boolean) => { if (!v) statusTarget = null }"
      @confirm="onStatusConfirm"
    />

    <UModal v-model:open="showStock" :title="`Adjust stock for '${stockTarget?.name ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="stockForm"
          :fields="stockFields"
          :loading="stockLoading"
          :error="stockError"
          submit-label="Adjust"
          cancelable
          @submit="onStockSubmit"
          @cancel="showStock = false"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { CreateSparePartPayload, SparePart, UpdateSparePartPayload } from '~/composables/useSpareParts'

definePageMeta({ middleware: 'admin' })

const { list, create, update, updateStatus, adjustStock } = useSpareParts()
const { list: listVendors } = useVendors()
const toast = useToast()

const rows = ref<SparePart[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ name: string; vendorId: number | undefined; active: boolean | undefined }>({
  name: '',
  vendorId: undefined,
  active: undefined
})
const activeFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false }
]

const vendorOptions = ref<{ label: string; value: number }[]>([])
const vendorFilterOptions = computed(() => [{ label: 'All vendors', value: undefined }, ...vendorOptions.value])

async function loadVendorOptions() {
  const res = await listVendors({ size: 200 })
  vendorOptions.value = res.data.map((v) => ({ label: v.name, value: v.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<SparePart>[] = [
  { key: 'name', sortable: true },
  { key: 'sku', value: (row) => row.sku ?? '—' },
  { key: 'quantityOnHand', label: 'Qty on hand', type: 'number' },
  { key: 'unitCost', label: 'Unit cost', type: 'currency' },
  { key: 'vendorName', label: 'Vendor', value: (row) => row.vendorName ?? '—' },
  { key: 'active', type: 'boolean' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      name: filter.name || undefined,
      vendorId: filter.vendorId,
      active: filter.active,
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
  { name: 'name', required: true },
  { name: 'sku', label: 'SKU', wrapper: 'half' },
  { name: 'unit', wrapper: 'half', hint: 'e.g. pcs, box, meter.' },
  { name: 'unitCost', label: 'Unit cost', type: 'currency', wrapper: 'half' },
  { name: 'quantityOnHand', label: 'Quantity on hand', type: 'number', min: 0, default: 0, wrapper: 'half' },
  { name: 'vendorId', label: 'Vendor', type: 'select', options: vendorOptions.value },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

const editFields = computed<FieldDef[]>(() => [
  { name: 'name', required: true },
  { name: 'sku', label: 'SKU', wrapper: 'half' },
  { name: 'unit', wrapper: 'half', hint: 'e.g. pcs, box, meter.' },
  { name: 'unitCost', label: 'Unit cost', type: 'currency', wrapper: 'half' },
  { name: 'vendorId', label: 'Vendor', type: 'select', options: vendorOptions.value, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate,
  onCreate,
  showEdit,
  editing,
  editError,
  editingRow,
  editForm,
  openEdit,
  onEdit
} = useCrudModals<SparePart, CreateSparePartPayload, UpdateSparePartPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload)
  },
  load,
  {
    entityName: 'Spare part',
    createDefaults: () => ({ quantityOnHand: 0 }),
    toForm: (row) => ({
      name: row.name,
      sku: row.sku ?? '',
      unit: row.unit ?? '',
      unitCost: row.unitCost ?? undefined,
      vendorId: row.vendorId ?? undefined,
      notes: row.notes ?? ''
    }),
    toPayload: (values) => ({
      name: values.name,
      sku: values.sku || undefined,
      unit: values.unit || undefined,
      unitCost: values.unitCost || undefined,
      quantityOnHand: values.quantityOnHand ?? 0,
      vendorId: values.vendorId || undefined,
      notes: values.notes || undefined
    }),
    toEditPayload: (values) => ({
      name: values.name,
      sku: values.sku || undefined,
      unit: values.unit || undefined,
      unitCost: values.unitCost || undefined,
      vendorId: values.vendorId || undefined,
      notes: values.notes || undefined
    })
  }
)

const statusTarget = ref<SparePart | null>(null)
const statusLoading = ref(false)
function openStatusWith(row: SparePart) {
  statusTarget.value = row
}
async function onStatusConfirm() {
  if (!statusTarget.value) return
  statusLoading.value = true
  try {
    const nextActive = !statusTarget.value.active
    await updateStatus(statusTarget.value.id, nextActive)
    toast.add({ title: `Spare part ${nextActive ? 'activated' : 'deactivated'}`, color: 'success' })
    statusTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update spare part status', description: apiErrorMessage(err), color: 'error' })
  } finally {
    statusLoading.value = false
  }
}

const {
  open: showStock,
  target: stockTarget,
  loading: stockLoading,
  error: stockError,
  openWith: openStockWith
} = useTargetModal<SparePart>()

const stockForm = ref<Record<string, any>>({})
const stockFields: FieldDef[] = [
  {
    name: 'quantityChange',
    label: 'Quantity change',
    type: 'number',
    required: true,
    hint: 'Positive to receive stock, negative to write off/correct downward.'
  },
  { name: 'reason', wrapper: 'full' }
]

watch(showStock, (value) => {
  if (value) {
    stockForm.value = { quantityChange: undefined, reason: '' }
  }
})

async function onStockSubmit(values: Record<string, any>) {
  if (!stockTarget.value) return
  stockLoading.value = true
  stockError.value = ''
  try {
    await adjustStock(stockTarget.value.id, {
      quantityChange: Number(values.quantityChange),
      reason: values.reason || undefined
    })
    showStock.value = false
    toast.add({ title: 'Stock adjusted', color: 'success' })
    await load()
  } catch (err) {
    stockError.value = apiErrorMessage(err)
  } finally {
    stockLoading.value = false
  }
}

onMounted(async () => {
  await loadVendorOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.vendorId, filter.active], load)

const hasActiveFilter = computed(
  () => filter.name !== '' || filter.vendorId !== undefined || filter.active !== undefined
)

function clearFilters() {
  filter.name = ''
  filter.vendorId = undefined
  filter.active = undefined
  load()
}
</script>

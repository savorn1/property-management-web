<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Payables</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New payable</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap items-end gap-3">
        <USelect v-model="filter.vendorId" :items="vendorFilterOptions" placeholder="Vendor" class="w-40" />
        <USelect v-model="filter.propertyId" :items="propertyFilterOptions" placeholder="Property" class="w-40" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-32" />
        <DateAmountRangeFilter
          v-model:start-date="filter.dueDateFrom"
          v-model:end-date="filter.dueDateTo"
          v-model:min-amount="filter.minAmount"
          v-model:max-amount="filter.maxAmount"
          hide-clear
        />
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
        export-filename="payables"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <RowActions :actions="payableActions(row)" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No payables match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-file-text" title="No payables yet" description="Record the first vendor bill to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New payable</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New payable">
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

    <UModal
      v-model:open="showPayments"
      :title="`Payments · ${paymentsTarget?.vendorName ?? ''}${paymentsTarget?.billNumber ? ` — ${paymentsTarget.billNumber}` : ''}`"
    >
      <template #body>
        <div class="space-y-4">
          <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Bill amount: <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(paymentsTarget?.amount) }}</span></span>
            <span>Balance due: <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(paymentsTarget?.balanceDue) }}</span></span>
          </div>

          <div v-if="paymentsLoading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="payments.length === 0" class="text-sm text-gray-400 mb-3">
            No payments recorded yet.
          </div>
          <div v-else class="space-y-1.5 mb-4">
            <div
              v-for="p in payments"
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
            v-model="paymentForm"
            :fields="paymentFields"
            :loading="paymentSaving"
            :error="paymentError"
            submit-label="Add payment"
            @submit="onAddPayment"
          />
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete payable"
      :description="`Delete this payable from '${confirmDelete?.vendorName ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type { CreatePayablePayload, Payable, PayableStatus } from '~/composables/usePayables'
import type { PayablePayment } from '~/composables/usePayablePayments'

definePageMeta({ middleware: 'admin' })

const { list, create, remove } = usePayables()
const { list: listPayments, create: createPayment } = usePayablePayments()
const { list: listVendors } = useVendors()
const { list: listProperties } = useProperties()
const toast = useToast()

const rows = ref<Payable[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  vendorId: number | undefined
  propertyId: number | undefined
  status: PayableStatus | undefined
  dueDateFrom: string | undefined
  dueDateTo: string | undefined
  minAmount: number | undefined
  maxAmount: number | undefined
}>({
  vendorId: undefined,
  propertyId: undefined,
  status: undefined,
  dueDateFrom: undefined,
  dueDateTo: undefined,
  minAmount: undefined,
  maxAmount: undefined
})

const vendorOptions = ref<{ label: string; value: number }[]>([])
const propertyOptions = ref<{ label: string; value: number }[]>([])
const vendorFilterOptions = computed(() => [{ label: 'All vendors', value: undefined }, ...vendorOptions.value])
const propertyFilterOptions = computed(() => [{ label: 'All properties', value: undefined }, ...propertyOptions.value])

const STATUS_OPTIONS: { label: string; value: PayableStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Partially paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const [vendorsRes, propsRes] = await Promise.all([listVendors({ size: 200 }), listProperties({ size: 200 })])
  vendorOptions.value = vendorsRes.data.map((v) => ({ label: v.name, value: v.id }))
  propertyOptions.value = propsRes.data.map((p) => ({ label: p.name, value: p.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'dueDate',
  direction: 'asc'
})

// Due-date/amount range aren't backend filter params (see PayableFilter) —
// vendor/property/status narrow the server fetch, then this narrows further
// within whatever came back, same as useClientTable's own search does.
const rangeFilteredRows = computed(() =>
  rows.value.filter((row) => {
    if (filter.dueDateFrom && row.dueDate < filter.dueDateFrom) return false
    if (filter.dueDateTo && row.dueDate > filter.dueDateTo) return false
    if (filter.minAmount !== undefined && row.amount < filter.minAmount) return false
    if (filter.maxAmount !== undefined && row.amount > filter.maxAmount) return false
    return true
  })
)

const { page, pageSize, total, rows: pagedRows } = useClientTable(rangeFilteredRows, { pageSize: 10 })
// useClientTable's own `truncated` would measure the range-filtered subset,
// not the raw fetch — always well under the 200 cap once any range filter is
// active. What actually matters here is whether the *fetch itself* got
// capped, so this checks `rows` (pre-range-filter) directly instead.
const truncated = computed(() => rows.value.length >= 200)

const columns: ColumnDef<Payable>[] = [
  { key: 'vendorName', label: 'Vendor' },
  { key: 'propertyName', label: 'Property', value: (row) => row.propertyName ?? 'Company-wide' },
  { key: 'billNumber', label: 'Bill #', value: (row) => row.billNumber ?? '—' },
  { key: 'amount', type: 'currency' },
  { key: 'dueDate', label: 'Due date', type: 'date', sortable: true },
  { key: 'balanceDue', label: 'Balance due', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      vendorId: filter.vendorId,
      propertyId: filter.propertyId,
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
  { name: 'vendorId', label: 'Vendor', type: 'select', required: true, options: vendorOptions.value, wrapper: 'half' },
  { name: 'propertyId', label: 'Property', type: 'select', options: propertyOptions.value, hint: 'Leave blank for a company-wide bill.', wrapper: 'half' },
  { name: 'billNumber', label: 'Bill number', wrapper: 'half' },
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'billDate', label: 'Bill date', type: 'date', required: true, wrapper: 'half' },
  { name: 'dueDate', label: 'Due date', type: 'date', required: true, wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate,
  onCreate,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<Payable, CreatePayablePayload>(
  {
    create: (payload) => create(payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Payable',
    createDefaults: () => ({}),
    toPayload: (values) => ({
      vendorId: values.vendorId,
      propertyId: values.propertyId || undefined,
      billNumber: values.billNumber || undefined,
      description: values.description || undefined,
      amount: values.amount,
      billDate: values.billDate,
      dueDate: values.dueDate
    })
  }
)

// Payments — history + inline create, scoped to one payable.
const {
  open: showPayments,
  target: paymentsTarget,
  openWith: openPaymentsWith
} = useTargetModal<Payable>()

const payments = ref<PayablePayment[]>([])
const paymentsLoading = ref(false)
const paymentForm = ref<Record<string, any>>({})
const paymentSaving = ref(false)
const paymentError = ref('')

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]
const paymentFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

watch(showPayments, async (value) => {
  if (!value || !paymentsTarget.value) return
  paymentForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
  paymentError.value = ''
  paymentsLoading.value = true
  try {
    payments.value = await listPayments(paymentsTarget.value.id)
  } catch (err) {
    paymentError.value = apiErrorMessage(err)
  } finally {
    paymentsLoading.value = false
  }
})

async function onAddPayment(values: Record<string, any>) {
  if (!paymentsTarget.value) return
  paymentSaving.value = true
  paymentError.value = ''
  try {
    await createPayment(paymentsTarget.value.id, {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method,
      referenceNumber: values.referenceNumber || undefined,
      notes: values.notes || undefined
    })
    payments.value = await listPayments(paymentsTarget.value.id)
    paymentForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Payable payment recorded', color: 'success' })
    await load()
    const refreshed = rows.value.find((row) => row.id === paymentsTarget.value?.id)
    if (refreshed) paymentsTarget.value = refreshed
  } catch (err) {
    paymentError.value = apiErrorMessage(err)
  } finally {
    paymentSaving.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.vendorId, filter.propertyId, filter.status], load)

const hasActiveFilter = computed(
  () =>
    filter.vendorId !== undefined ||
    filter.propertyId !== undefined ||
    filter.status !== undefined ||
    !!filter.dueDateFrom ||
    !!filter.dueDateTo ||
    filter.minAmount !== undefined ||
    filter.maxAmount !== undefined
)

function clearFilters() {
  filter.vendorId = undefined
  filter.propertyId = undefined
  filter.status = undefined
  filter.dueDateFrom = undefined
  filter.dueDateTo = undefined
  filter.minAmount = undefined
  filter.maxAmount = undefined
  load()
}

function payableActions(row: Payable): RowAction[] {
  return [
    { label: 'Payments', icon: 'i-lucide-banknote', onClick: () => openPaymentsWith(row) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}
</script>

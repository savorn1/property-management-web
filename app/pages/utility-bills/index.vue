<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Utility bills</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">Generate bill</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.meterId" :items="meterFilterOptions" placeholder="Meter" class="w-64" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-40" />
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

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="utility-bills"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              v-if="isAdmin && row.status === 'PENDING'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              @click="openMarkPaidWith(row)"
            >
              Mark paid
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No bills match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-zap" title="No utility bills yet" description="Generate the first bill from a meter's readings to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">Generate bill</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="Generate utility bill">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="createFields"
          :loading="creating"
          :error="createError"
          submit-label="Generate"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="markPaidTarget !== null"
      title="Mark bill as paid"
      :description="`Mark the bill for meter '${markPaidTarget?.meterNumber ?? ''}' (${formatCurrency(markPaidTarget?.totalAmount)}) as paid?`"
      confirm-label="Mark paid"
      color="success"
      :loading="markPaidLoading"
      @update:model-value="(v: boolean) => { if (!v) markPaidTarget = null }"
      @confirm="onMarkPaidConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { CreateUtilityBillPayload, UtilityBill, UtilityBillStatus } from '~/composables/useUtilityBills'

const { isAdmin } = useAuth()
const { list, create, updateStatus } = useUtilityBills()
const { list: listMeters } = useMeters()
const toast = useToast()

const rows = ref<UtilityBill[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ meterId: number | undefined; status: UtilityBillStatus | undefined }>({
  meterId: undefined,
  status: undefined
})

const meterOptions = ref<{ label: string; value: number }[]>([])
const meterFilterOptions = computed(() => [{ label: 'All meters', value: undefined }, ...meterOptions.value])

const STATUS_OPTIONS: { label: string; value: UtilityBillStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const res = await listMeters({ size: 200 })
  meterOptions.value = res.data.map((m) => ({
    label: `${m.meterNumber}${m.unitNumber ? ` — Unit ${m.unitNumber}` : ''}`,
    value: m.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<UtilityBill>[] = [
  { key: 'meterNumber', label: 'Meter', value: (row) => row.meterNumber ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'billingPeriodStart', label: 'Billing period', to: 'billingPeriodEnd', type: 'date' },
  { key: 'consumption', label: 'Consumption', value: (row) => `${row.consumption} ${row.unitOfMeasure ?? ''}` },
  { key: 'totalAmount', label: 'Total', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      meterId: filter.meterId,
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
  { name: 'meterId', label: 'Meter', type: 'select', required: true, options: meterOptions.value, hint: 'The billing period and consumption are computed from the meter\'s two most recent readings.' },
  { name: 'ratePerUnit', label: 'Rate per unit', type: 'number', required: true, step: 0.0001, min: 0 }
])

// No useCrudModals here — utility bills have no update/delete endpoints, only
// generate plus the mark-paid status action handled separately below.
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})

function openCreate() {
  createForm.value = { meterId: filter.meterId }
  createError.value = ''
  showCreate.value = true
}

async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  const payload: CreateUtilityBillPayload = {
    meterId: values.meterId,
    ratePerUnit: values.ratePerUnit
  }
  try {
    await create(payload)
    toast.add({ title: 'Utility bill generated', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Mark paid — a plain confirm, no extra payload.
const markPaidTarget = ref<UtilityBill | null>(null)
const markPaidLoading = ref(false)
function openMarkPaidWith(row: UtilityBill) {
  markPaidTarget.value = row
}
async function onMarkPaidConfirm() {
  if (!markPaidTarget.value) return
  markPaidLoading.value = true
  try {
    await updateStatus(markPaidTarget.value.id, 'PAID')
    toast.add({ title: 'Bill marked as paid', color: 'success' })
    markPaidTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update bill status', description: apiErrorMessage(err), color: 'error' })
  } finally {
    markPaidLoading.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.meterId, filter.status], load)

const hasActiveFilter = computed(() => filter.meterId !== undefined || filter.status !== undefined)

function clearFilters() {
  filter.meterId = undefined
  filter.status = undefined
  load()
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Financial periods</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New period</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
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
        export-filename="financial-periods"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              v-if="row.status === 'OPEN'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-lock"
              @click.stop="openStatusWith(row)"
            >
              Close
            </UButton>
            <UButton
              v-if="row.status === 'CLOSED'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-lock-open"
              @click.stop="openStatusWith(row)"
            >
              Reopen
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No periods match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-calendar-range" title="No financial periods yet" description="Create the first period to start posting journal entries.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New period</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New financial period">
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

    <ConfirmModal
      :model-value="statusTarget !== null"
      :title="statusTarget?.status === 'OPEN' ? 'Close period' : 'Reopen period'"
      :description="
        statusTarget?.status === 'OPEN'
          ? `Close period '${statusTarget?.name ?? ''}'? No further journal entries can post into it while closed.`
          : `Reopen period '${statusTarget?.name ?? ''}'? Journal entries will be postable into it again.`
      "
      :confirm-label="statusTarget?.status === 'OPEN' ? 'Close' : 'Reopen'"
      :color="statusTarget?.status === 'OPEN' ? 'error' : 'success'"
      :loading="statusLoading"
      @update:model-value="(v: boolean) => { if (!v) statusTarget = null }"
      @confirm="onStatusConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { CreateFinancialPeriodPayload, FinancialPeriod, FinancialPeriodStatus } from '~/composables/useFinancialPeriods'

definePageMeta({ middleware: 'admin' })

const { list, create, close, reopen } = useFinancialPeriods()
const toast = useToast()

const rows = ref<FinancialPeriod[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ status: FinancialPeriodStatus | undefined }>({ status: undefined })
const STATUS_OPTIONS: { label: string; value: FinancialPeriodStatus }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Closed', value: 'CLOSED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'startDate',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<FinancialPeriod>[] = [
  { key: 'name', sortable: true },
  { key: 'startDate', type: 'date', sortable: true },
  { key: 'endDate', type: 'date' },
  { key: 'status', type: 'status' },
  { key: 'closedAt', label: 'Closed at', type: 'datetime' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
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

const createFields: FieldDef[] = [
  { name: 'name', required: true, hint: 'e.g. "January 2027" or "FY2027-Q1".' },
  { name: 'startDate', label: 'Start date', type: 'date', required: true, wrapper: 'half' },
  { name: 'endDate', label: 'End date', type: 'date', required: true, wrapper: 'half' }
]

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate,
  onCreate
} = useCrudModals<FinancialPeriod, CreateFinancialPeriodPayload>(
  {
    create: (payload) => create(payload)
  },
  load,
  {
    entityName: 'Financial period',
    createDefaults: () => ({}),
    toPayload: (values) => ({
      name: values.name,
      startDate: values.startDate,
      endDate: values.endDate
    })
  }
)

// Close/reopen — a plain confirm, no extra payload, mirroring the
// active/inactive status-toggle pattern used by schemes/accounts.
const statusTarget = ref<FinancialPeriod | null>(null)
const statusLoading = ref(false)
function openStatusWith(row: FinancialPeriod) {
  statusTarget.value = row
}
async function onStatusConfirm() {
  if (!statusTarget.value) return
  statusLoading.value = true
  try {
    if (statusTarget.value.status === 'OPEN') {
      await close(statusTarget.value.id)
      toast.add({ title: 'Financial period closed', color: 'success' })
    } else {
      await reopen(statusTarget.value.id)
      toast.add({ title: 'Financial period reopened', color: 'success' })
    }
    statusTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update financial period', description: apiErrorMessage(err), color: 'error' })
  } finally {
    statusLoading.value = false
  }
}

onMounted(load)
watch(sort, load)
watch(() => filter.status, load)

const hasActiveFilter = computed(() => filter.status !== undefined)

function clearFilters() {
  filter.status = undefined
  load()
}
</script>

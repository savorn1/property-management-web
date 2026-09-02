<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New expense</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.propertyId" :items="propertyFilterOptions" placeholder="Property" class="w-56" />
        <USelect v-model="filter.categoryId" :items="categoryFilterOptions" placeholder="Category" class="w-56" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-44" />
        <UInput v-model="filter.startDate" type="date" placeholder="From" class="w-40" />
        <UInput v-model="filter.endDate" type="date" placeholder="To" class="w-40" />
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
        export-filename="expenses"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="row.status === 'PENDING'"
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-pencil"
              @click.stop="openEdit(row)"
            >
              Edit
            </UButton>
            <UButton
              v-if="row.status === 'PENDING'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              @click.stop="openApproveWith(row)"
            >
              Approve
            </UButton>
            <UButton
              v-if="row.status === 'PENDING'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-x"
              @click.stop="openRejectWith(row)"
            >
              Reject
            </UButton>
            <UButton
              v-if="row.status !== 'APPROVED'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              @click.stop="confirmDelete = row"
            >
              Delete
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No expenses match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-receipt" title="No expenses yet" description="Record the first expense to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New expense</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New expense">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="formFields"
          :loading="creating"
          :error="createError"
          submit-label="Create"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showEdit" title="Edit expense">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="formFields"
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
      :model-value="approveTarget !== null"
      title="Approve expense"
      :description="`Approve this ${formatCurrency(approveTarget?.amount)} expense? It will post to accounting.`"
      confirm-label="Approve"
      color="success"
      :loading="approving"
      @update:model-value="(v: boolean) => { if (!v) approveTarget = null }"
      @confirm="onApprove"
    />

    <UModal v-model:open="showReject" title="Reject expense">
      <template #body>
        <DynamicForm
          v-model="rejectForm"
          :fields="rejectFields"
          :loading="rejecting"
          :error="rejectError"
          submit-label="Reject"
          cancelable
          @submit="onRejectSubmit"
          @cancel="showReject = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete expense"
      :description="`Delete this ${formatCurrency(confirmDelete?.amount)} expense? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Expense, ExpenseApprovalStatus, ExpensePayload } from '~/composables/useExpenses'

definePageMeta({ middleware: 'admin' })

const { list, create, update, approve, reject, remove } = useExpenses()
const { list: listProperties } = useProperties()
const { list: listCategories } = useExpenseCategories()
const toast = useToast()

const rows = ref<Expense[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  propertyId: number | undefined
  categoryId: number | undefined
  status: ExpenseApprovalStatus | undefined
  startDate: string
  endDate: string
}>({ propertyId: undefined, categoryId: undefined, status: undefined, startDate: '', endDate: '' })

const propertyOptions = ref<{ label: string; value: number }[]>([])
const categoryOptions = ref<{ label: string; value: number }[]>([])
const propertyFilterOptions = computed(() => [{ label: 'All properties', value: undefined }, ...propertyOptions.value])
const categoryFilterOptions = computed(() => [{ label: 'All categories', value: undefined }, ...categoryOptions.value])

const STATUS_OPTIONS: { label: string; value: ExpenseApprovalStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const [propsRes, catsRes] = await Promise.all([listProperties({ size: 200 }), listCategories({ size: 200 })])
  propertyOptions.value = propsRes.data.map((p) => ({ label: p.name, value: p.id }))
  categoryOptions.value = catsRes.data.map((c) => ({ label: c.name, value: c.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'expenseDate',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Expense>[] = [
  { key: 'propertyName', label: 'Property', value: (row) => row.propertyName ?? 'Company-wide' },
  { key: 'categoryName', label: 'Category' },
  { key: 'amount', type: 'currency' },
  { key: 'expenseDate', label: 'Date', type: 'date', sortable: true },
  { key: 'vendor', value: (row) => row.vendor ?? '—' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      propertyId: filter.propertyId,
      categoryId: filter.categoryId,
      status: filter.status,
      startDate: filter.startDate || undefined,
      endDate: filter.endDate || undefined,
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

const formFields = computed<FieldDef[]>(() => [
  { name: 'propertyId', label: 'Property', type: 'select', options: propertyOptions.value, hint: 'Leave blank for a company-wide expense.', wrapper: 'half' },
  { name: 'categoryId', label: 'Category', type: 'select', required: true, options: categoryOptions.value, wrapper: 'half' },
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'expenseDate', label: 'Expense date', type: 'date', required: true, wrapper: 'half' },
  { name: 'vendor', wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
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
  editForm,
  openEdit,
  onEdit,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<Expense, ExpensePayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Expense',
    createDefaults: () => ({}),
    toForm: (row) => ({
      propertyId: row.propertyId ?? undefined,
      categoryId: row.categoryId,
      amount: row.amount,
      expenseDate: row.expenseDate,
      vendor: row.vendor ?? '',
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      propertyId: values.propertyId || undefined,
      categoryId: values.categoryId,
      amount: values.amount,
      expenseDate: values.expenseDate,
      vendor: values.vendor || undefined,
      description: values.description || undefined
    })
  }
)

// Approve — a plain confirm, no extra payload.
const approveTarget = ref<Expense | null>(null)
const approving = ref(false)
function openApproveWith(row: Expense) {
  approveTarget.value = row
}
async function onApprove() {
  if (!approveTarget.value) return
  approving.value = true
  try {
    await approve(approveTarget.value.id)
    toast.add({ title: 'Expense approved', color: 'success' })
    approveTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not approve expense', description: apiErrorMessage(err), color: 'error' })
  } finally {
    approving.value = false
  }
}

// Reject — an optional reason.
const {
  open: showReject,
  target: rejectTarget,
  loading: rejecting,
  error: rejectError,
  openWith: openRejectWith
} = useTargetModal<Expense>()
const rejectForm = ref<Record<string, any>>({})
const rejectFields: FieldDef[] = [{ name: 'reason', type: 'textarea', wrapper: 'full' }]
watch(showReject, (value) => {
  if (value) rejectForm.value = {}
})
async function onRejectSubmit(values: Record<string, any>) {
  if (!rejectTarget.value) return
  rejecting.value = true
  rejectError.value = ''
  try {
    await reject(rejectTarget.value.id, { reason: values.reason || undefined })
    showReject.value = false
    toast.add({ title: 'Expense rejected', color: 'success' })
    await load()
  } catch (err) {
    rejectError.value = apiErrorMessage(err)
  } finally {
    rejecting.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.propertyId, filter.categoryId, filter.status], load)

const hasActiveFilter = computed(
  () =>
    filter.propertyId !== undefined ||
    filter.categoryId !== undefined ||
    filter.status !== undefined ||
    filter.startDate !== '' ||
    filter.endDate !== ''
)

function clearFilters() {
  filter.propertyId = undefined
  filter.categoryId = undefined
  filter.status = undefined
  filter.startDate = ''
  filter.endDate = ''
  load()
}
</script>

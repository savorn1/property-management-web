<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Journal entries</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New entry</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-40" />
        <USelect v-model="filter.sourceType" :items="sourceTypeFilterOptions" placeholder="Source" class="w-48" />
        <USelect v-model="filter.financialPeriodId" :items="periodFilterOptions" placeholder="Financial period" class="w-52" />
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
        export-filename="journal-entries"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-eye" @click.stop="openView(row)">
              View
            </UButton>
            <UButton
              v-if="row.status === 'DRAFT'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              @click.stop="openPostWith(row)"
            >
              Post
            </UButton>
            <UButton
              v-if="row.status !== 'VOID'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-ban"
              @click.stop="openVoidWith(row)"
            >
              Void
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No journal entries match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-book-text" title="No journal entries yet" description="Create the first manual entry to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New entry</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <!-- Create — hand-rolled: DynamicForm's FieldDef vocabulary doesn't cover a
         repeatable line-items array, so the lines table is built directly here. -->
    <UModal v-model:open="showCreate" title="New journal entry" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entry date</label>
              <UInput v-model="createEntryDate" type="date" class="w-full" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Scheme (for the account picker below)</label>
              <USelect v-model="createSchemeId" :items="schemeOptions" placeholder="Scheme" class="w-full" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <UInput v-model="createDescription" placeholder="Description" class="w-full" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lines</h3>
              <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-plus" @click="addCreateLine">
                Add line
              </UButton>
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div class="hidden sm:grid grid-cols-12 gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span class="col-span-4">Account</span>
                <span class="col-span-2">Debit</span>
                <span class="col-span-2">Credit</span>
                <span class="col-span-3">Description</span>
                <span class="col-span-1"></span>
              </div>
              <div
                v-for="(line, idx) in createLines"
                :key="idx"
                class="grid grid-cols-12 gap-2 items-center px-3 py-2 border-t border-gray-100 dark:border-gray-800 first:border-t-0"
              >
                <USelect
                  v-model="line.accountId"
                  :items="accountOptions"
                  placeholder="Account"
                  class="col-span-12 sm:col-span-4"
                />
                <UInput v-model.number="line.debit" type="number" step="0.01" min="0" placeholder="0.00" class="col-span-6 sm:col-span-2" />
                <UInput v-model.number="line.credit" type="number" step="0.01" min="0" placeholder="0.00" class="col-span-6 sm:col-span-2" />
                <UInput v-model="line.description" placeholder="Line description" class="col-span-10 sm:col-span-3" />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  class="col-span-2 sm:col-span-1 justify-self-end"
                  :disabled="createLines.length <= 2"
                  @click="removeCreateLine(idx)"
                />
              </div>
            </div>

            <div class="flex justify-end gap-4 mt-3 text-sm font-medium" :class="createBalanced ? 'text-gray-600 dark:text-gray-300' : 'text-error'">
              <span>Total debit: {{ formatCurrency(createTotalDebit) }}</span>
              <span>Total credit: {{ formatCurrency(createTotalCredit) }}</span>
              <span v-if="!createBalanced" class="flex items-center gap-1">
                <UIcon name="i-lucide-triangle-alert" class="w-4 h-4" />
                Out of balance
              </span>
            </div>
          </div>

          <UAlert v-if="createError" color="error" variant="subtle" :title="createError" />

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="creating" @click="showCreate = false">Cancel</UButton>
            <UButton :loading="creating" @click="onCreateSubmit">Create</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- View — DataTable has no row-expansion, so lines show in a read-only modal. -->
    <UModal v-model:open="showView" :title="`Journal entry ${viewTarget ? '#' + viewTarget.id : ''}`" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div v-if="viewLoading" class="text-sm text-gray-400 py-6 text-center">Loading…</div>
        <UAlert v-else-if="viewError" color="error" variant="subtle" :title="viewError" />
        <div v-else-if="viewTarget" class="space-y-4">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">Date</span>
              <div class="font-medium text-gray-900 dark:text-white">{{ formatDate(viewTarget.entryDate) }}</div>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Status</span>
              <div><StatusBadge :status="viewTarget.status" /></div>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Source</span>
              <div class="font-medium text-gray-900 dark:text-white">{{ formatEnum(viewTarget.sourceType) }}</div>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Financial period</span>
              <div class="font-medium text-gray-900 dark:text-white">{{ viewTarget.financialPeriodName ?? '—' }}</div>
            </div>
            <div class="col-span-2">
              <span class="text-gray-500 dark:text-gray-400">Description</span>
              <div class="font-medium text-gray-900 dark:text-white">{{ viewTarget.description ?? '—' }}</div>
            </div>
            <div v-if="viewTarget.status === 'VOID'" class="col-span-2">
              <span class="text-gray-500 dark:text-gray-400">Void reason</span>
              <div class="font-medium text-gray-900 dark:text-white">{{ viewTarget.voidReason ?? '—' }}</div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="text-left px-3 py-2">Account</th>
                  <th class="text-right px-3 py-2">Debit</th>
                  <th class="text-right px-3 py-2">Credit</th>
                  <th class="text-left px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in viewTarget.lines" :key="line.id" class="border-t border-gray-100 dark:border-gray-800">
                  <td class="px-3 py-2 text-gray-900 dark:text-white">{{ line.accountCode }} — {{ line.accountName }}</td>
                  <td class="px-3 py-2 text-right">{{ formatCurrency(line.debit) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatCurrency(line.credit) }}</td>
                  <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ line.description ?? '—' }}</td>
                </tr>
              </tbody>
              <tfoot class="border-t border-gray-200 dark:border-gray-800 font-medium">
                <tr>
                  <td class="px-3 py-2">Total</td>
                  <td class="px-3 py-2 text-right">{{ formatCurrency(viewTarget.totalDebit) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatCurrency(viewTarget.totalCredit) }}</td>
                  <td class="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="postTarget !== null"
      title="Post journal entry"
      :description="`Post journal entry '${postTarget?.description || ('#' + (postTarget?.id ?? ''))}'? Posted entries affect the general ledger and can no longer be edited.`"
      confirm-label="Post"
      color="success"
      :loading="posting"
      @update:model-value="(v: boolean) => { if (!v) postTarget = null }"
      @confirm="onPostConfirm"
    />

    <UModal v-model:open="showVoid" :title="`Void journal entry ${voidTarget ? '#' + voidTarget.id : ''}`">
      <template #body>
        <DynamicForm
          v-model="voidForm"
          :fields="voidFields"
          :loading="voidLoading"
          :error="voidError"
          submit-label="Void"
          cancelable
          @submit="onVoidSubmit"
          @cancel="showVoid = false"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { JournalEntry, JournalEntryStatus } from '~/composables/useJournalEntries'
import type { JournalSourceType } from '#shared/domain'

definePageMeta({ middleware: 'admin' })

const { list, get, create, post, voidEntry } = useJournalEntries()
const { list: listPeriods } = useFinancialPeriods()
const { list: listSchemes } = useAccountingSchemes()
const { list: listAccounts } = useAccounts()
const toast = useToast()

const rows = ref<JournalEntry[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  status: JournalEntryStatus | undefined
  sourceType: JournalSourceType | undefined
  financialPeriodId: number | undefined
}>({
  status: undefined,
  sourceType: undefined,
  financialPeriodId: undefined
})

const STATUS_OPTIONS: { label: string; value: JournalEntryStatus }[] = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Void', value: 'VOID' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

// Keep this option list identical to journal-templates/index.vue's SOURCE_TYPE_OPTIONS
// (reused there for triggerEvent) — both must show the same labels for the same enum.
const SOURCE_TYPE_OPTIONS: { label: string; value: JournalSourceType }[] = [
  { label: 'Manual', value: 'MANUAL' },
  { label: 'Rent payment', value: 'RENT_PAYMENT' },
  { label: 'Deposit payment', value: 'DEPOSIT_PAYMENT' },
  { label: 'Deposit refund', value: 'DEPOSIT_REFUND' },
  { label: 'Utility bill', value: 'UTILITY_BILL' },
  { label: 'Sale payment', value: 'SALE_PAYMENT' },
  { label: 'Sale refund', value: 'SALE_REFUND' },
  { label: 'Expense', value: 'EXPENSE' },
  { label: 'Commission', value: 'COMMISSION' },
  { label: 'Loan payment', value: 'LOAN_PAYMENT' },
  { label: 'Rent refund', value: 'RENT_REFUND' },
  { label: 'Credit note', value: 'CREDIT_NOTE' },
  { label: 'Debit note', value: 'DEBIT_NOTE' },
  { label: 'Payable payment', value: 'PAYABLE_PAYMENT' }
]
const sourceTypeFilterOptions = [{ label: 'All sources', value: undefined }, ...SOURCE_TYPE_OPTIONS]

const periodOptions = ref<{ label: string; value: number }[]>([])
const periodFilterOptions = computed(() => [{ label: 'All periods', value: undefined }, ...periodOptions.value])

async function loadPeriodOptions() {
  const res = await listPeriods({ size: 200 })
  periodOptions.value = res.data.map((p) => ({ label: p.name, value: p.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'entryDate',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<JournalEntry>[] = [
  { key: 'entryDate', type: 'date', sortable: true },
  { key: 'description', value: (row) => row.description ?? '—' },
  { key: 'status', type: 'status' },
  { key: 'sourceType', label: 'Source', type: 'enum' },
  { key: 'totalDebit', label: 'Total debit', type: 'currency' },
  { key: 'totalCredit', label: 'Total credit', type: 'currency' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      status: filter.status,
      sourceType: filter.sourceType,
      financialPeriodId: filter.financialPeriodId,
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

// Create — hand-rolled lines sub-form (FieldDef/DynamicForm has no repeatable
// array field type). Lines need an account, which needs a scheme picked first
// (mirrors how chart-of-accounts picks a default scheme).
interface DraftLine {
  accountId: number | undefined
  debit: number | undefined
  credit: number | undefined
  description: string
}
function newLine(): DraftLine {
  return { accountId: undefined, debit: undefined, credit: undefined, description: '' }
}

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createEntryDate = ref('')
const createDescription = ref('')
const createSchemeId = ref<number | undefined>(undefined)
const createLines = ref<DraftLine[]>([newLine(), newLine()])

const schemeOptions = ref<{ label: string; value: number }[]>([])
const accountOptions = ref<{ label: string; value: number }[]>([])

async function loadSchemeOptions() {
  const res = await listSchemes({ active: true, size: 200 })
  schemeOptions.value = res.data.map((s) => ({ label: s.name, value: s.id }))
}

async function loadAccountOptions(schemeId: number | undefined) {
  if (!schemeId) {
    accountOptions.value = []
    return
  }
  const res = await listAccounts({ schemeId, active: true, size: 200 })
  accountOptions.value = res.data.map((a) => ({ label: `${a.code} — ${a.name}`, value: a.id }))
}
watch(createSchemeId, loadAccountOptions)

function addCreateLine() {
  createLines.value.push(newLine())
}
function removeCreateLine(idx: number) {
  if (createLines.value.length > 2) createLines.value.splice(idx, 1)
}

const createTotalDebit = computed(() => createLines.value.reduce((sum, l) => sum + (Number(l.debit) || 0), 0))
const createTotalCredit = computed(() => createLines.value.reduce((sum, l) => sum + (Number(l.credit) || 0), 0))
const createBalanced = computed(() => Math.abs(createTotalDebit.value - createTotalCredit.value) < 0.005)

function openCreate() {
  createEntryDate.value = new Date().toISOString().slice(0, 10)
  createDescription.value = ''
  // Keep whatever scheme was already picked (e.g. from a previous entry in
  // the same session); otherwise default to the first active scheme.
  if (!createSchemeId.value) createSchemeId.value = schemeOptions.value[0]?.value
  createLines.value = [newLine(), newLine()]
  createError.value = ''
  showCreate.value = true
}

async function onCreateSubmit() {
  createError.value = ''
  if (!createEntryDate.value) {
    createError.value = 'Entry date is required.'
    return
  }
  const lines = createLines.value
    .filter((l) => l.accountId)
    .map((l) => ({
      accountId: l.accountId!,
      debit: l.debit || 0,
      credit: l.credit || 0,
      description: l.description || undefined
    }))
  if (lines.length < 2) {
    createError.value = 'At least two lines with an account are required.'
    return
  }
  creating.value = true
  try {
    await create({
      entryDate: createEntryDate.value,
      description: createDescription.value || undefined,
      lines
    })
    toast.add({ title: 'Journal entry created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// View — fetched fresh via get() so lines are always current, even if the
// list response is ever trimmed down in the future.
const showView = ref(false)
const viewTarget = ref<JournalEntry | null>(null)
const viewLoading = ref(false)
const viewError = ref('')
async function openView(row: JournalEntry) {
  showView.value = true
  viewLoading.value = true
  viewError.value = ''
  viewTarget.value = null
  try {
    viewTarget.value = await get(row.id)
  } catch (err) {
    viewError.value = apiErrorMessage(err)
  } finally {
    viewLoading.value = false
  }
}

// Post — a plain confirm, no extra payload.
const postTarget = ref<JournalEntry | null>(null)
const posting = ref(false)
function openPostWith(row: JournalEntry) {
  postTarget.value = row
}
async function onPostConfirm() {
  if (!postTarget.value) return
  posting.value = true
  try {
    await post(postTarget.value.id)
    toast.add({ title: 'Journal entry posted', color: 'success' })
    postTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not post journal entry', description: apiErrorMessage(err), color: 'error' })
  } finally {
    posting.value = false
  }
}

// Void — an optional reason, so a tiny one-field DynamicForm instead of a
// plain ConfirmModal.
const {
  open: showVoid,
  target: voidTarget,
  loading: voidLoading,
  error: voidError,
  openWith: openVoidWith
} = useTargetModal<JournalEntry>()
const voidForm = ref<Record<string, any>>({})
const voidFields: FieldDef[] = [{ name: 'reason', type: 'textarea', label: 'Reason (optional)' }]
watch(showVoid, (value) => {
  if (value) voidForm.value = {}
})
async function onVoidSubmit(values: Record<string, any>) {
  if (!voidTarget.value) return
  voidLoading.value = true
  voidError.value = ''
  try {
    await voidEntry(voidTarget.value.id, { reason: values.reason || undefined })
    showVoid.value = false
    toast.add({ title: 'Journal entry voided', color: 'success' })
    await load()
  } catch (err) {
    voidError.value = apiErrorMessage(err)
  } finally {
    voidLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadPeriodOptions(), loadSchemeOptions()])
  await load()
})
watch(sort, load)
watch(() => [filter.status, filter.sourceType, filter.financialPeriodId], load)

const hasActiveFilter = computed(
  () => filter.status !== undefined || filter.sourceType !== undefined || filter.financialPeriodId !== undefined
)

function clearFilters() {
  filter.status = undefined
  filter.sourceType = undefined
  filter.financialPeriodId = undefined
  load()
}
</script>

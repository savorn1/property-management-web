<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Journal templates</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New template</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.triggerEvent" :items="triggerEventFilterOptions" placeholder="Trigger event" class="w-52" />
        <USelect v-model="filter.active" :items="activeFilterOptions" placeholder="Status" class="w-40" />
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
        export-filename="journal-templates"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
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
            title="No templates match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-file-cog" title="No journal templates yet" description="Create a template so business events auto-post their journal entries.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New template</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <!-- Create — hand-rolled lines sub-form, same shape as journal-entries' create modal. -->
    <UModal v-model:open="showCreate" title="New journal template" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <UInput v-model="createName" placeholder="Name" class="w-full" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Code</label>
              <UInput v-model="createCode" placeholder="Unique short code" class="w-full" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Trigger event</label>
            <USelect v-model="createTriggerEvent" :items="SOURCE_TYPE_OPTIONS" placeholder="Trigger event" class="w-full" />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">The business event that auto-posts this template. Cannot be changed after creation.</p>
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
            <div class="mb-2">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Scheme (for the account picker below)</label>
              <USelect v-model="createSchemeId" :items="schemeOptions" placeholder="Scheme" class="w-56" />
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div class="hidden sm:grid grid-cols-12 gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span class="col-span-4">Account</span>
                <span class="col-span-2">Side</span>
                <span class="col-span-4">Amount key</span>
                <span class="col-span-2"></span>
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
                <USelect v-model="line.side" :items="SIDE_OPTIONS" placeholder="Side" class="col-span-6 sm:col-span-2" />
                <UInput v-model="line.amountComponent" placeholder="e.g. TOTAL" class="col-span-4 sm:col-span-4" />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  class="col-span-2 justify-self-end"
                  :disabled="createLines.length <= 1"
                  @click="removeCreateLine(idx)"
                />
              </div>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Amount key looked up from the posting event, e.g. TOTAL, PRINCIPAL, INTEREST.
            </p>
          </div>

          <UAlert v-if="createError" color="error" variant="subtle" :title="createError" />

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="creating" @click="showCreate = false">Cancel</UButton>
            <UButton :loading="creating" @click="onCreateSubmit">Create</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Edit — name/description/lines only; code and triggerEvent aren't editable. -->
    <UModal v-model:open="showEdit" :title="`Edit template '${editTarget?.name ?? ''}'`" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <div v-if="editTarget" class="space-y-6">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Code <span class="font-medium text-gray-500 dark:text-gray-400">{{ editTarget.code }}</span>
            · Trigger event <span class="font-medium text-gray-500 dark:text-gray-400">{{ formatEnum(editTarget.triggerEvent) }}</span>
            (not editable)
          </p>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <UInput v-model="editName" placeholder="Name" class="w-full" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <UInput v-model="editDescription" placeholder="Description" class="w-full" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lines</h3>
              <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-plus" @click="addEditLine">
                Add line
              </UButton>
            </div>
            <div class="mb-2">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Scheme (for the account picker below)</label>
              <USelect v-model="editSchemeId" :items="schemeOptions" placeholder="Scheme" class="w-56" />
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div class="hidden sm:grid grid-cols-12 gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span class="col-span-4">Account</span>
                <span class="col-span-2">Side</span>
                <span class="col-span-4">Amount key</span>
                <span class="col-span-2"></span>
              </div>
              <div
                v-for="(line, idx) in editLines"
                :key="idx"
                class="grid grid-cols-12 gap-2 items-center px-3 py-2 border-t border-gray-100 dark:border-gray-800 first:border-t-0"
              >
                <USelect
                  v-model="line.accountId"
                  :items="editAccountOptions"
                  placeholder="Account"
                  class="col-span-12 sm:col-span-4"
                />
                <USelect v-model="line.side" :items="SIDE_OPTIONS" placeholder="Side" class="col-span-6 sm:col-span-2" />
                <UInput v-model="line.amountComponent" placeholder="e.g. TOTAL" class="col-span-4 sm:col-span-4" />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  class="col-span-2 justify-self-end"
                  :disabled="editLines.length <= 1"
                  @click="removeEditLine(idx)"
                />
              </div>
            </div>
          </div>

          <UAlert v-if="editError" color="error" variant="subtle" :title="editError" />

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="editing" @click="showEdit = false">Cancel</UButton>
            <UButton :loading="editing" @click="onEditSubmit">Save changes</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="statusTarget !== null"
      :title="statusTarget?.active ? 'Deactivate template' : 'Activate template'"
      :description="
        statusTarget?.active
          ? `Deactivate template '${statusTarget?.name ?? ''}'? It will stop auto-posting new journal entries.`
          : `Activate template '${statusTarget?.name ?? ''}'?`
      "
      :confirm-label="statusTarget?.active ? 'Deactivate' : 'Activate'"
      :color="statusTarget?.active ? 'error' : 'success'"
      :loading="statusLoading"
      @update:model-value="(v: boolean) => { if (!v) statusTarget = null }"
      @confirm="onStatusConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { JournalLineSide, JournalTemplate } from '~/composables/useJournalTemplates'
import type { JournalSourceType } from '#shared/domain'

definePageMeta({ middleware: 'admin' })

const { list, create, update, updateStatus } = useJournalTemplates()
const { list: listSchemes } = useAccountingSchemes()
const { list: listAccounts, get: getAccount } = useAccounts()
const toast = useToast()

const rows = ref<JournalTemplate[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ triggerEvent: JournalSourceType | undefined; active: boolean | undefined }>({
  triggerEvent: undefined,
  active: undefined
})

// Keep this option list identical to journal-entries/index.vue's SOURCE_TYPE_OPTIONS
// (reused there for the sourceType filter) — both must show the same labels for the same enum.
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
const triggerEventFilterOptions = [{ label: 'All trigger events', value: undefined }, ...SOURCE_TYPE_OPTIONS]
const activeFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false }
]
const SIDE_OPTIONS: { label: string; value: JournalLineSide }[] = [
  { label: 'Debit', value: 'DEBIT' },
  { label: 'Credit', value: 'CREDIT' }
]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<JournalTemplate>[] = [
  { key: 'name', sortable: true },
  { key: 'code' },
  { key: 'triggerEvent', label: 'Trigger event', type: 'enum' },
  { key: 'description', value: (row) => row.description ?? '—' },
  { key: 'active', type: 'boolean' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      triggerEvent: filter.triggerEvent,
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

// Scheme/account options shared by both the create and edit lines sub-forms.
const schemeOptions = ref<{ label: string; value: number }[]>([])
async function loadSchemeOptions() {
  const res = await listSchemes({ active: true, size: 200 })
  schemeOptions.value = res.data.map((s) => ({ label: s.name, value: s.id }))
}

interface DraftLine {
  accountId: number | undefined
  side: JournalLineSide | undefined
  amountComponent: string
}
function newLine(): DraftLine {
  return { accountId: undefined, side: undefined, amountComponent: '' }
}

// Create
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createName = ref('')
const createCode = ref('')
const createTriggerEvent = ref<JournalSourceType | undefined>(undefined)
const createDescription = ref('')
const createSchemeId = ref<number | undefined>(undefined)
const createLines = ref<DraftLine[]>([newLine()])
const accountOptions = ref<{ label: string; value: number }[]>([])

async function loadAccountOptionsInto(schemeId: number | undefined, target: Ref<{ label: string; value: number }[]>) {
  if (!schemeId) {
    target.value = []
    return
  }
  const res = await listAccounts({ schemeId, active: true, size: 200 })
  target.value = res.data.map((a) => ({ label: `${a.code} — ${a.name}`, value: a.id }))
}
watch(createSchemeId, (id) => loadAccountOptionsInto(id, accountOptions))

function addCreateLine() {
  createLines.value.push(newLine())
}
function removeCreateLine(idx: number) {
  if (createLines.value.length > 1) createLines.value.splice(idx, 1)
}

function openCreate() {
  createName.value = ''
  createCode.value = ''
  createTriggerEvent.value = undefined
  createDescription.value = ''
  if (!createSchemeId.value) createSchemeId.value = schemeOptions.value[0]?.value
  createLines.value = [newLine()]
  createError.value = ''
  showCreate.value = true
}

async function onCreateSubmit() {
  createError.value = ''
  if (!createName.value.trim() || !createCode.value.trim() || !createTriggerEvent.value) {
    createError.value = 'Name, code, and trigger event are required.'
    return
  }
  const lines = createLines.value
    .filter((l) => l.accountId && l.side && l.amountComponent.trim())
    .map((l) => ({ accountId: l.accountId!, side: l.side!, amountComponent: l.amountComponent.trim() }))
  if (lines.length === 0) {
    createError.value = 'At least one complete line (account, side, amount key) is required.'
    return
  }
  creating.value = true
  try {
    await create({
      name: createName.value,
      code: createCode.value,
      triggerEvent: createTriggerEvent.value,
      description: createDescription.value || undefined,
      lines
    })
    toast.add({ title: 'Journal template created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Edit — name/description/lines only.
const showEdit = ref(false)
const editing = ref(false)
const editError = ref('')
const editTarget = ref<JournalTemplate | null>(null)
const editName = ref('')
const editDescription = ref('')
const editSchemeId = ref<number | undefined>(undefined)
const editLines = ref<DraftLine[]>([])
const editAccountOptions = ref<{ label: string; value: number }[]>([])
watch(editSchemeId, (id) => loadAccountOptionsInto(id, editAccountOptions))

async function openEdit(row: JournalTemplate) {
  editTarget.value = row
  editName.value = row.name
  editDescription.value = row.description ?? ''
  editLines.value = row.lines.map((l) => ({ accountId: l.accountId, side: l.side, amountComponent: l.amountComponent }))
  // Every existing line's account should belong to the same scheme in practice —
  // look up that scheme from the first line's account so the picker already
  // contains them, instead of leaving it on whatever scheme was last selected.
  const firstAccountId = row.lines[0]?.accountId
  editSchemeId.value = firstAccountId ? (await getAccount(firstAccountId)).schemeId : schemeOptions.value[0]?.value
  await loadAccountOptionsInto(editSchemeId.value, editAccountOptions)
  editError.value = ''
  showEdit.value = true
}
function addEditLine() {
  editLines.value.push(newLine())
}
function removeEditLine(idx: number) {
  if (editLines.value.length > 1) editLines.value.splice(idx, 1)
}
async function onEditSubmit() {
  if (!editTarget.value) return
  editError.value = ''
  if (!editName.value.trim()) {
    editError.value = 'Name is required.'
    return
  }
  const lines = editLines.value
    .filter((l) => l.accountId && l.side && l.amountComponent.trim())
    .map((l) => ({ accountId: l.accountId!, side: l.side!, amountComponent: l.amountComponent.trim() }))
  if (lines.length === 0) {
    editError.value = 'At least one complete line (account, side, amount key) is required.'
    return
  }
  editing.value = true
  try {
    await update(editTarget.value.id, {
      name: editName.value,
      description: editDescription.value || undefined,
      lines
    })
    toast.add({ title: 'Journal template updated', color: 'success' })
    showEdit.value = false
    await load()
  } catch (err) {
    editError.value = apiErrorMessage(err)
  } finally {
    editing.value = false
  }
}

// Status toggle — plain confirm, same pattern as schemes/accounts.
const statusTarget = ref<JournalTemplate | null>(null)
const statusLoading = ref(false)
function openStatusWith(row: JournalTemplate) {
  statusTarget.value = row
}
async function onStatusConfirm() {
  if (!statusTarget.value) return
  statusLoading.value = true
  try {
    const nextActive = !statusTarget.value.active
    await updateStatus(statusTarget.value.id, nextActive)
    toast.add({ title: `Template ${nextActive ? 'activated' : 'deactivated'}`, color: 'success' })
    statusTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update template status', description: apiErrorMessage(err), color: 'error' })
  } finally {
    statusLoading.value = false
  }
}

onMounted(async () => {
  await loadSchemeOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.triggerEvent, filter.active], load)

const hasActiveFilter = computed(() => filter.triggerEvent !== undefined || filter.active !== undefined)

function clearFilters() {
  filter.triggerEvent = undefined
  filter.active = undefined
  load()
}
</script>

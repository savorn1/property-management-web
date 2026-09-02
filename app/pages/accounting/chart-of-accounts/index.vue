<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Chart of accounts</h1>
      <UButton icon="i-lucide-plus" :disabled="!filter.schemeId" @click="openCreate">New account</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.schemeId" :items="schemeOptions" placeholder="Scheme" class="w-56" />
        <USelect v-model="filter.type" :items="typeFilterOptions" placeholder="Type" class="w-44" />
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
    <TruncatedResultsAlert v-if="truncated" />

    <UCard>
      <DataTable
        v-if="filter.schemeId"
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="chart-of-accounts"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-book-open-text"
              @click.stop="navigateTo(`/accounting/general-ledger?accountId=${row.id}`)"
            >
              Ledger
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
            title="No accounts match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-list-tree" title="No accounts yet" description="Add the first account to this scheme to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New account</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>
      <EmptyState
        v-else
        icon="i-lucide-book-marked"
        title="Select a scheme"
        description="Choose an accounting scheme above to view and manage its chart of accounts."
      />

      <div v-if="filter.schemeId && total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New account">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="fields"
          :loading="creating"
          :error="createError"
          submit-label="Create"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showEdit" :title="`Edit account '${editingRow?.name ?? ''}'`">
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
      :title="statusTarget?.active ? 'Deactivate account' : 'Activate account'"
      :description="
        statusTarget?.active
          ? `Deactivate account '${statusTarget?.code ?? ''} — ${statusTarget?.name ?? ''}'? It will no longer be usable for new journal entries.`
          : `Activate account '${statusTarget?.code ?? ''} — ${statusTarget?.name ?? ''}'?`
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
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Account, AccountType, CreateAccountPayload, UpdateAccountPayload } from '~/composables/useAccounts'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const { list, create, update, updateStatus } = useAccounts()
const { list: listSchemes } = useAccountingSchemes()
const toast = useToast()

const rows = ref<Account[]>([])
const loading = ref(false)
const error = ref('')

const initialSchemeId = Number(route.query.schemeId) || undefined
const filter = reactive<{ schemeId: number | undefined; type: AccountType | undefined; active: boolean | undefined }>({
  schemeId: initialSchemeId,
  type: undefined,
  active: undefined
})

const schemeOptions = ref<{ label: string; value: number }[]>([])

const TYPE_OPTIONS: { label: string; value: AccountType }[] = [
  { label: 'Asset', value: 'ASSET' },
  { label: 'Liability', value: 'LIABILITY' },
  { label: 'Equity', value: 'EQUITY' },
  { label: 'Income', value: 'INCOME' },
  { label: 'Expense', value: 'EXPENSE' }
]
const typeFilterOptions = [{ label: 'All types', value: undefined }, ...TYPE_OPTIONS]
const activeFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false }
]

async function loadSchemeOptions() {
  const res = await listSchemes({ size: 200 })
  schemeOptions.value = res.data.map((s) => ({ label: s.name, value: s.id }))
  if (!filter.schemeId && schemeOptions.value.length > 0) {
    filter.schemeId = schemeOptions.value[0]!.value
  }
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'code',
  direction: 'asc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Account>[] = [
  { key: 'code', sortable: true },
  { key: 'name', sortable: true },
  { key: 'type', type: 'enum' },
  { key: 'parentName', label: 'Parent', value: (row) => row.parentName ?? '—' },
  { key: 'active', type: 'boolean' },
  { key: 'actions', label: '' }
]

async function load() {
  if (!filter.schemeId) {
    rows.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      schemeId: filter.schemeId,
      type: filter.type,
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

// Options for the parent-account picker: other accounts in the same scheme.
// 0 is a sentinel for "no parent" since FieldOption values can't be null.
const NO_PARENT = 0
function parentOptions(excludeId?: number) {
  return [
    { label: 'No parent (top-level)', value: NO_PARENT },
    ...rows.value.filter((r) => r.id !== excludeId).map((r) => ({ label: `${r.code} — ${r.name}`, value: r.id }))
  ]
}

const fields = computed<FieldDef[]>(() => [
  { name: 'code', required: true, wrapper: 'half' },
  { name: 'type', type: 'select', required: true, options: TYPE_OPTIONS, wrapper: 'half' },
  { name: 'name', required: true },
  { name: 'parentId', label: 'Parent account', type: 'select', options: parentOptions(), default: NO_PARENT },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields = computed<FieldDef[]>(() => [
  { name: 'code', required: true, wrapper: 'half' },
  { name: 'type', type: 'select', required: true, options: TYPE_OPTIONS, wrapper: 'half' },
  { name: 'name', required: true },
  { name: 'parentId', label: 'Parent account', type: 'select', options: parentOptions(editingRow.value?.id), default: NO_PARENT },
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
  editingRow,
  editForm,
  openEdit,
  onEdit
} = useCrudModals<Account, CreateAccountPayload, UpdateAccountPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload)
  },
  load,
  {
    entityName: 'Account',
    createDefaults: () => ({ parentId: NO_PARENT }),
    toForm: (row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      parentId: row.parentId ?? NO_PARENT,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      schemeId: filter.schemeId!,
      code: values.code,
      name: values.name,
      type: values.type,
      parentId: values.parentId && values.parentId !== NO_PARENT ? values.parentId : undefined,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      code: values.code,
      name: values.name,
      type: values.type,
      parentId: values.parentId && values.parentId !== NO_PARENT ? values.parentId : undefined,
      description: values.description || undefined
    })
  }
)

const statusTarget = ref<Account | null>(null)
const statusLoading = ref(false)
function openStatusWith(row: Account) {
  statusTarget.value = row
}
async function onStatusConfirm() {
  if (!statusTarget.value) return
  statusLoading.value = true
  try {
    const nextActive = !statusTarget.value.active
    await updateStatus(statusTarget.value.id, nextActive)
    toast.add({ title: `Account ${nextActive ? 'activated' : 'deactivated'}`, color: 'success' })
    statusTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update account status', description: apiErrorMessage(err), color: 'error' })
  } finally {
    statusLoading.value = false
  }
}

onMounted(async () => {
  await loadSchemeOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.schemeId, filter.type, filter.active], load)

const hasActiveFilter = computed(() => filter.type !== undefined || filter.active !== undefined)

function clearFilters() {
  filter.type = undefined
  filter.active = undefined
  load()
}
</script>

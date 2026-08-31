<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Buyers</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New buyer</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="filter.fullName"
          placeholder="Search name"
          icon="i-lucide-search"
          class="w-56"
          @keyup.enter="load"
        />
        <UInput
          v-model="filter.email"
          placeholder="Email"
          icon="i-lucide-mail"
          class="w-56"
          @keyup.enter="load"
        />
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

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="buyers"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row) => openEdit(row)"
      >
        <template #actions-data="{ row }">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
            Edit
          </UButton>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No buyers match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-user-round" title="No buyers yet" description="Add the first buyer to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New buyer</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New buyer">
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

    <UModal v-model:open="showEdit" :title="`Edit buyer '${editingRow?.fullName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="fields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Buyer, BuyerPayload } from '~/composables/useBuyers'

const { list, create, update } = useBuyers()

const rows = ref<Buyer[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive({ fullName: '', email: '' })

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Buyer>[] = [
  { key: 'fullName', label: 'Name', sortable: true },
  { key: 'email', value: (row) => row.email ?? '—' },
  { key: 'phone', value: (row) => row.phone ?? '—' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      fullName: filter.fullName || undefined,
      email: filter.email || undefined,
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

const fields: FieldDef[] = [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'email', type: 'email', wrapper: 'half' },
  { name: 'phone', wrapper: 'half' },
  { name: 'nationalId', label: 'National ID', wrapper: 'half' },
  { name: 'address', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

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
} = useCrudModals<Buyer, BuyerPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload)
  },
  load,
  {
    entityName: 'Buyer',
    createDefaults: () => ({}),
    toForm: (row) => ({
      fullName: row.fullName,
      email: row.email ?? '',
      phone: row.phone ?? '',
      nationalId: row.nationalId ?? '',
      address: row.address ?? '',
      notes: row.notes ?? ''
    }),
    toPayload: (values) => ({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      nationalId: values.nationalId || undefined,
      address: values.address || undefined,
      notes: values.notes || undefined
    })
  }
)

onMounted(load)
watch(sort, load)

const hasActiveFilter = computed(() => filter.fullName !== '' || filter.email !== '')

function clearFilters() {
  filter.fullName = ''
  filter.email = ''
  load()
}
</script>

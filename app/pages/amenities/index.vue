<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Amenities</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New amenity</UButton>
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
        <UInput
          v-model="filter.category"
          placeholder="Category"
          icon="i-lucide-tag"
          class="w-48"
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
        export-filename="amenities"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
              Edit
            </UButton>
            <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click.stop="confirmDelete = row">
              Delete
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No amenities match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-sparkles" title="No amenities yet" description="Add the first amenity to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New amenity</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New amenity">
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

    <UModal v-model:open="showEdit" :title="`Edit amenity '${editingRow?.name ?? ''}'`">
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

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete amenity"
      :description="`Delete amenity '${confirmDelete?.name ?? ''}'? This cannot be undone.`"
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
import type { Amenity, AmenityPayload } from '~/composables/useAmenities'

definePageMeta({ middleware: 'admin' })

const { list, create, update, remove } = useAmenities()

const rows = ref<Amenity[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ name: string; category: string }>({ name: '', category: '' })

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Amenity>[] = [
  { key: 'name', sortable: true },
  { key: 'category', value: (row) => row.category ?? '—' },
  { key: 'description', value: (row) => row.description ?? '—' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      name: filter.name || undefined,
      category: filter.category || undefined,
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
  { name: 'name', required: true },
  { name: 'category', wrapper: 'half', hint: 'e.g. Interior, Building, Outdoor.' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
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
  onEdit,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<Amenity, AmenityPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Amenity',
    createDefaults: () => ({}),
    toForm: (row) => ({
      name: row.name,
      category: row.category ?? '',
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      name: values.name,
      category: values.category || undefined,
      description: values.description || undefined
    })
  }
)

onMounted(load)
watch(sort, load)

const hasActiveFilter = computed(() => filter.name !== '' || filter.category !== '')

function clearFilters() {
  filter.name = ''
  filter.category = ''
  load()
}
</script>

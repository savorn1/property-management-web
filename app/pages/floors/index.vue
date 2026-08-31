<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Floors</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New floor</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect
          v-model="filter.buildingId"
          :items="buildingFilterOptions"
          placeholder="Building"
          class="w-56"
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

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="floors"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row) => navigateTo(`/unit-types?floorId=${row.id}`)"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-layout-grid"
              @click.stop="navigateTo(`/unit-types?floorId=${row.id}`)"
            >
              Unit types
            </UButton>
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
            title="No floors match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-layers" title="No floors yet" description="Add the first floor to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New floor</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New floor">
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

    <UModal v-model:open="showEdit" :title="`Edit floor '${editingRow?.name ?? editingRow?.floorNumber ?? ''}'`">
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
      :model-value="confirmDelete !== null"
      title="Delete floor"
      :description="`Delete floor '${confirmDelete?.name ?? confirmDelete?.floorNumber ?? ''}'? This cannot be undone.`"
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
import type { CreateFloorPayload, Floor, UpdateFloorPayload } from '~/composables/useFloors'

const route = useRoute()
const { list, create, update, remove } = useFloors()
const { list: listBuildings } = useBuildings()

const rows = ref<Floor[]>([])
const loading = ref(false)
const error = ref('')

const initialBuildingId = Number(route.query.buildingId) || undefined
const filter = reactive<{ buildingId: number | undefined }>({ buildingId: initialBuildingId })

const buildingOptions = ref<{ label: string; value: number }[]>([])
const buildingFilterOptions = computed(() => [{ label: 'All buildings', value: undefined }, ...buildingOptions.value])

async function loadBuildingOptions() {
  const res = await listBuildings({ size: 200 })
  buildingOptions.value = res.data.map((b) => ({ label: b.name, value: b.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'floorNumber',
  direction: 'asc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Floor>[] = [
  { key: 'floorNumber', label: 'Floor #', sortable: true },
  { key: 'name', value: (row) => row.name ?? '—' },
  { key: 'buildingName', label: 'Building', value: (row) => row.buildingName ?? '—' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      buildingId: filter.buildingId,
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
  { name: 'buildingId', label: 'Building', type: 'select', required: true, options: buildingOptions.value },
  { name: 'floorNumber', label: 'Floor number', type: 'number', required: true },
  { name: 'name' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields: FieldDef[] = [
  { name: 'floorNumber', label: 'Floor number', type: 'number', required: true },
  { name: 'name' },
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
} = useCrudModals<Floor, CreateFloorPayload, UpdateFloorPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Floor',
    createDefaults: () => ({ buildingId: filter.buildingId }),
    toForm: (row) => ({
      floorNumber: row.floorNumber,
      name: row.name ?? '',
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      buildingId: values.buildingId,
      floorNumber: values.floorNumber,
      name: values.name || undefined,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      floorNumber: values.floorNumber,
      name: values.name || undefined,
      description: values.description || undefined
    })
  }
)

onMounted(async () => {
  await loadBuildingOptions()
  await load()
})
watch(sort, load)
watch(() => filter.buildingId, load)

const hasActiveFilter = computed(() => filter.buildingId !== undefined)

function clearFilters() {
  filter.buildingId = undefined
  load()
}
</script>

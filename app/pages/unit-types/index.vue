<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Unit types</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New unit type</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect
          v-model="filter.floorId"
          :items="floorFilterOptions"
          placeholder="Floor"
          class="w-48"
        />
        <UInput
          v-model="search"
          placeholder="Search name"
          icon="i-lucide-search"
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
        export-filename="unit-types"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row) => navigateTo(`/units?unitTypeId=${row.id}`)"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-door-open"
              @click.stop="navigateTo(`/units?unitTypeId=${row.id}`)"
            >
              Units
            </UButton>
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
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
            title="No unit types match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-layout-grid" title="No unit types yet" description="Add the first unit type to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New unit type</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New unit type">
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

    <UModal v-model:open="showEdit" :title="`Edit unit type '${editingRow?.name ?? ''}'`">
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
      title="Delete unit type"
      :description="`Delete unit type '${confirmDelete?.name ?? ''}'? This cannot be undone.`"
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
import type { CreateUnitTypePayload, UnitType, UpdateUnitTypePayload } from '~/composables/useUnitTypes'

const route = useRoute()
const { list, create, update, remove } = useUnitTypes()
const { list: listFloors } = useFloors()

const rows = ref<UnitType[]>([])
const loading = ref(false)
const error = ref('')

const initialFloorId = Number(route.query.floorId) || undefined
const filter = reactive<{ floorId: number | undefined }>({
  floorId: initialFloorId
})

const floorOptions = ref<{ label: string; value: number }[]>([])
const floorFilterOptions = computed(() => [{ label: 'All floors', value: undefined }, ...floorOptions.value])

async function loadFloorOptions() {
  const res = await listFloors({ size: 200 })
  floorOptions.value = res.data.map((f) => ({
    label: `${f.buildingName ?? 'Building'} — Floor ${f.floorNumber}${f.name ? ` (${f.name})` : ''}`,
    value: f.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated, search } = useClientTable(rows, {
  pageSize: 10,
  searchFields: ['name']
})

const columns: ColumnDef<UnitType>[] = [
  { key: 'name', sortable: true },
  { key: 'buildingName', label: 'Building', value: (row) => row.buildingName ?? '—' },
  { key: 'floorNumber', label: 'Floor', value: (row) => row.floorNumber ?? '—' },
  { key: 'bedrooms', label: 'Beds', value: (row) => row.bedrooms ?? '—' },
  { key: 'bathrooms', label: 'Baths', value: (row) => row.bathrooms ?? '—' },
  { key: 'basePrice', label: 'Base price', type: 'currency' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      floorId: filter.floorId,
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
  { name: 'floorId', label: 'Floor', type: 'select', required: true, options: floorOptions.value },
  { name: 'name', required: true },
  { name: 'bedrooms', type: 'number', min: 0, wrapper: 'half' },
  { name: 'bathrooms', type: 'number', min: 0, wrapper: 'half' },
  { name: 'areaSqft', label: 'Area (sqft)', type: 'number', min: 0, wrapper: 'half' },
  { name: 'basePrice', label: 'Base price', type: 'currency', wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields: FieldDef[] = [
  { name: 'name', required: true },
  { name: 'bedrooms', type: 'number', min: 0, wrapper: 'half' },
  { name: 'bathrooms', type: 'number', min: 0, wrapper: 'half' },
  { name: 'areaSqft', label: 'Area (sqft)', type: 'number', min: 0, wrapper: 'half' },
  { name: 'basePrice', label: 'Base price', type: 'currency', wrapper: 'half' },
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
} = useCrudModals<UnitType, CreateUnitTypePayload, UpdateUnitTypePayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Unit type',
    createDefaults: () => ({ floorId: filter.floorId }),
    toForm: (row) => ({
      name: row.name,
      bedrooms: row.bedrooms ?? undefined,
      bathrooms: row.bathrooms ?? undefined,
      areaSqft: row.areaSqft ?? undefined,
      basePrice: row.basePrice ?? undefined,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      floorId: values.floorId,
      name: values.name,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      areaSqft: values.areaSqft,
      basePrice: values.basePrice,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      name: values.name,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      areaSqft: values.areaSqft,
      basePrice: values.basePrice,
      description: values.description || undefined
    })
  }
)

onMounted(async () => {
  await loadFloorOptions()
  await load()
})
watch(sort, load)
watch(() => filter.floorId, load)

const hasActiveFilter = computed(() => filter.floorId !== undefined || search.value !== '')

function clearFilters() {
  filter.floorId = undefined
  search.value = ''
  load()
}
</script>

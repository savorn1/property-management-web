<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Streets</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New street</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap items-end gap-3">
        <UInput v-model="search" placeholder="Search name or code" icon="i-lucide-search" class="w-56" />
        <USelect v-model="filter.zoneId" :items="zoneFilterOptions" placeholder="Zone" class="w-40" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-36" />
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
        export-filename="streets"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <RowActions :actions="streetActions(row)" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No streets match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-route" title="No streets yet" description="Add the first street to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New street</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New street">
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

    <UModal v-model:open="showEdit" :title="`Edit street '${editingRow?.name ?? ''}'`">
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
      title="Delete street"
      :description="`Delete street '${confirmDelete?.name ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type { CreateStreetPayload, Street, StreetStatus, SurfaceType, UpdateStreetPayload } from '~/composables/useStreets'

const route = useRoute()
const { list, create, update, remove } = useStreets()
const { list: listZones } = useZones()

const rows = ref<Street[]>([])
const loading = ref(false)
const error = ref('')

const initialZoneId = Number(route.query.zoneId) || undefined
const filter = reactive<{ zoneId: number | undefined; status: StreetStatus | undefined }>({
  zoneId: initialZoneId,
  status: undefined
})

const zoneOptions = ref<{ label: string; value: number }[]>([])
const zoneFilterOptions = computed(() => [{ label: 'All zones', value: undefined }, ...zoneOptions.value])

async function loadOptions() {
  const res = await listZones({ size: 200 })
  zoneOptions.value = res.data.map((z) => ({ label: z.name, value: z.id }))
}

const SURFACE_TYPE_OPTIONS: { label: string; value: SurfaceType }[] = [
  { label: 'Asphalt', value: 'ASPHALT' },
  { label: 'Concrete', value: 'CONCRETE' },
  { label: 'Gravel', value: 'GRAVEL' },
  { label: 'Dirt', value: 'DIRT' },
  { label: 'Paved block', value: 'PAVED_BLOCK' }
]

const STATUS_OPTIONS: { label: string; value: StreetStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Under construction', value: 'UNDER_CONSTRUCTION' },
  { label: 'Renovation', value: 'RENOVATION' },
  { label: 'Inactive', value: 'INACTIVE' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated, search } = useClientTable(rows, {
  pageSize: 10,
  searchFields: ['name', 'code']
})

const columns: ColumnDef<Street>[] = [
  { key: 'name', sortable: true },
  { key: 'zoneName', label: 'Zone', value: (row) => row.zoneName ?? '—' },
  { key: 'code', value: (row) => row.code ?? '—' },
  { key: 'length', label: 'Length', value: (row) => (row.length != null ? `${row.length} m` : '—') },
  { key: 'width', label: 'Width', value: (row) => (row.width != null ? `${row.width} m` : '—') },
  { key: 'surfaceType', label: 'Surface', value: (row) => (row.surfaceType ? formatEnum(row.surfaceType) : '—') },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      zoneId: filter.zoneId,
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

// Everything but `zoneId` (create-only, which street this is) is shared
// between create and edit, mirroring Plot/Building.
const DETAIL_FIELDS: FieldDef[] = [
  { name: 'name', required: true, wrapper: 'half' },
  { name: 'code', wrapper: 'half' },
  { name: 'length', label: 'Length (m)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'width', label: 'Width (m)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'area', label: 'Area (m²)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'surfaceType', label: 'Surface type', type: 'select', options: SURFACE_TYPE_OPTIONS, wrapper: 'half' },
  { name: 'status', type: 'select', options: STATUS_OPTIONS, wrapper: 'half' }
]

const createFields = computed<FieldDef[]>(() => [
  { name: 'zoneId', label: 'Zone', type: 'select', required: true, options: zoneOptions.value },
  ...DETAIL_FIELDS
])
const editFields = DETAIL_FIELDS

function toPayload(values: Record<string, any>) {
  return {
    name: values.name,
    code: values.code || undefined,
    length: values.length,
    width: values.width,
    area: values.area,
    surfaceType: values.surfaceType || undefined,
    status: values.status || undefined
  }
}

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate: openCreateModal,
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
} = useCrudModals<Street, CreateStreetPayload, UpdateStreetPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Street',
    createDefaults: () => ({ zoneId: filter.zoneId, status: 'ACTIVE' }),
    toForm: (row) => ({
      name: row.name,
      code: row.code ?? '',
      length: row.length ?? undefined,
      width: row.width ?? undefined,
      area: row.area ?? undefined,
      surfaceType: row.surfaceType ?? undefined,
      status: row.status ?? undefined
    }),
    toPayload: (values) => ({ zoneId: values.zoneId, ...toPayload(values) }),
    toEditPayload: (values) => toPayload(values)
  }
)

function openCreate() {
  openCreateModal()
}

function streetActions(row: Street): RowAction[] {
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openEdit(row) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.zoneId, filter.status], load)

const hasActiveFilter = computed(
  () => search.value !== '' || filter.zoneId !== undefined || filter.status !== undefined
)

function clearFilters() {
  search.value = ''
  filter.zoneId = undefined
  filter.status = undefined
  load()
}
</script>

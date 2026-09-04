<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Plots</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New plot</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap items-end gap-3">
        <UInput v-model="search" placeholder="Search plot number or code" icon="i-lucide-search" class="w-56" />
        <USelect v-model="filter.propertyId" :items="propertyFilterOptions" placeholder="Property" class="w-40" />
        <USelect v-model="filter.zoneId" :items="zoneFilterOptions" placeholder="Zone" class="w-40" />
        <USelect v-model="filter.stage" :items="stageFilterOptions" placeholder="Stage" class="w-44" />
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
        export-filename="plots"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <RowActions :actions="plotActions(row)" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No plots match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-map-pin" title="No plots yet" description="Add the first plot to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New plot</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New plot">
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

    <UModal v-model:open="showEdit" :title="`Edit plot '${editingRow?.plotNumber ?? ''}'`">
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
      title="Delete plot"
      :description="`Delete plot '${confirmDelete?.plotNumber ?? ''}'? This cannot be undone.`"
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
import type { CreatePlotPayload, LandType, Plot, UpdatePlotPayload } from '~/composables/usePlots'

const route = useRoute()
const { list, create, update, remove } = usePlots()
const { list: listProperties } = useProperties()
const { list: listZones } = useZones()
const { list: listStreets } = useStreets()

const rows = ref<Plot[]>([])
const loading = ref(false)
const error = ref('')

const initialPropertyId = Number(route.query.propertyId) || undefined
// `stage` (a PLOT_STAGES key) drives filtering in the UI; it's expanded into
// the three real fields (below, and again in `load()`) since the backend
// filter only knows those three, not the synthetic stage concept.
const filter = reactive<{ propertyId: number | undefined; zoneId: number | undefined; stage: string | undefined }>({
  propertyId: initialPropertyId,
  zoneId: undefined,
  stage: undefined
})

const propertyOptions = ref<{ label: string; value: number }[]>([])
const zoneOptions = ref<{ label: string; value: number }[]>([])
const streetOptions = ref<{ label: string; value: number }[]>([])
const propertyFilterOptions = computed(() => [{ label: 'All properties', value: undefined }, ...propertyOptions.value])
const zoneFilterOptions = computed(() => [{ label: 'All zones', value: undefined }, ...zoneOptions.value])

async function loadOptions() {
  const [propsRes, zonesRes, streetsRes] = await Promise.all([
    listProperties({ size: 200 }),
    listZones({ size: 200 }),
    listStreets({ size: 200 })
  ])
  propertyOptions.value = propsRes.data.map((p) => ({ label: p.name, value: p.id }))
  zoneOptions.value = zonesRes.data.map((z) => ({ label: z.name, value: z.id }))
  streetOptions.value = streetsRes.data.map((s) => ({ label: `${s.name}${s.zoneName ? ` — ${s.zoneName}` : ''}`, value: s.id }))
}

const LAND_TYPE_OPTIONS: { label: string; value: LandType }[] = [
  { label: 'Residential', value: 'RESIDENTIAL' },
  { label: 'Commercial', value: 'COMMERCIAL' },
  { label: 'Agricultural', value: 'AGRICULTURAL' },
  { label: 'Industrial', value: 'INDUSTRIAL' },
  { label: 'Mixed use', value: 'MIXED_USE' }
]

const STAGE_OPTIONS = PLOT_STAGES.map((s) => ({ label: s.label, value: s.key }))
const stageFilterOptions = [{ label: 'All stages', value: undefined }, ...STAGE_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated, search } = useClientTable(rows, {
  pageSize: 10,
  searchFields: ['plotNumber', 'code']
})

const columns: ColumnDef<Plot>[] = [
  { key: 'plotNumber', label: 'Plot #', sortable: true },
  { key: 'propertyName', label: 'Property', value: (row) => row.propertyName ?? '—' },
  { key: 'zoneName', label: 'Zone', value: (row) => row.zoneName ?? '—' },
  { key: 'landArea', label: 'Land area', value: (row) => (row.landArea != null ? `${row.landArea} m²` : '—') },
  { key: 'landType', label: 'Land type', value: (row) => (row.landType ? formatEnum(row.landType) : '—') },
  { key: 'salePrice', label: 'Sale price', type: 'currency' },
  { key: 'stage', label: 'Stage', type: 'status', value: (row) => findPlotStage(row)?.key ?? 'UNKNOWN' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const stage = PLOT_STAGES.find((s) => s.key === filter.stage)
    const res = await list({
      propertyId: filter.propertyId,
      zoneId: filter.zoneId,
      availabilityStatus: stage?.availabilityStatus,
      reservationStatus: stage?.reservationStatus,
      saleStatus: stage?.saleStatus,
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

// Measurements/land type/sale terms share the same field set on create and
// edit — only `streetId` (the plot's one true parent) is create-only,
// matching how Building excludes plotId from its own edit payload.
const MEASUREMENT_AND_SALE_FIELDS: FieldDef[] = [
  { name: 'code', wrapper: 'half' },
  { name: 'plotNumber', label: 'Plot number', required: true, wrapper: 'half' },
  { name: 'landArea', label: 'Land area (m²)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'landType', label: 'Land type', type: 'select', options: LAND_TYPE_OPTIONS, wrapper: 'half' },
  { name: 'frontage', label: 'Frontage (m)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'depth', label: 'Depth (m)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'width', label: 'Width (m)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'length', label: 'Length (m)', type: 'number', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'salePrice', label: 'Sale price', type: 'currency', wrapper: 'half' },
  { name: 'pricePerM2', label: 'Price per m²', type: 'currency', wrapper: 'half' },
  { name: 'stage', type: 'select', required: true, options: STAGE_OPTIONS, wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
]

const createFields = computed<FieldDef[]>(() => [
  { name: 'streetId', label: 'Street', type: 'select', required: true, options: streetOptions.value },
  ...MEASUREMENT_AND_SALE_FIELDS
])
// Edit further narrows the Stage field to only the moves PLOT_STAGE_TRANSITIONS
// allows from the row's current stage (plus the current stage itself) — create
// keeps the full list since there's no "current" stage to restrict from yet.
const editFields = computed<FieldDef[]>(() => {
  const currentStageKey = editingRow.value ? findPlotStage(editingRow.value)?.key : undefined
  const allowedStageOptions = selectablePlotStages(currentStageKey).map((s) => ({ label: s.label, value: s.key }))
  return MEASUREMENT_AND_SALE_FIELDS.map((f) =>
    f.name === 'stage' ? { ...f, options: allowedStageOptions } : f
  )
})

function toPayload(values: Record<string, any>) {
  const stage = PLOT_STAGES.find((s) => s.key === values.stage)
  return {
    code: values.code || undefined,
    plotNumber: values.plotNumber,
    landArea: values.landArea,
    frontage: values.frontage,
    depth: values.depth,
    width: values.width,
    length: values.length,
    landType: values.landType || undefined,
    salePrice: values.salePrice,
    pricePerM2: values.pricePerM2,
    availabilityStatus: stage?.availabilityStatus,
    reservationStatus: stage?.reservationStatus,
    saleStatus: stage?.saleStatus,
    description: values.description || undefined
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
} = useCrudModals<Plot, CreatePlotPayload, UpdatePlotPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Plot',
    createDefaults: () => ({ stage: 'AVAILABLE' }),
    toForm: (row) => ({
      code: row.code ?? '',
      plotNumber: row.plotNumber,
      landArea: row.landArea ?? undefined,
      frontage: row.frontage ?? undefined,
      depth: row.depth ?? undefined,
      width: row.width ?? undefined,
      length: row.length ?? undefined,
      landType: row.landType ?? undefined,
      salePrice: row.salePrice ?? undefined,
      pricePerM2: row.pricePerM2 ?? undefined,
      stage: findPlotStage(row)?.key,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({ streetId: values.streetId, ...toPayload(values) }),
    toEditPayload: (values) => toPayload(values)
  }
)

function openCreate() {
  openCreateModal()
}

function plotActions(row: Plot): RowAction[] {
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
watch(() => [filter.propertyId, filter.zoneId, filter.stage], load)

const hasActiveFilter = computed(
  () => search.value !== '' || filter.propertyId !== undefined || filter.zoneId !== undefined || filter.stage !== undefined
)

function clearFilters() {
  search.value = ''
  filter.propertyId = undefined
  filter.zoneId = undefined
  filter.stage = undefined
  load()
}
</script>

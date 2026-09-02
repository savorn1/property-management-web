<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Meters</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New meter</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.unitId" :items="unitFilterOptions" placeholder="Unit" class="w-48" />
        <USelect v-model="filter.meterType" :items="typeFilterOptions" placeholder="Meter type" class="w-36" />
        <USelect v-model="filter.active" :items="activeFilterOptions" placeholder="Status" class="w-32" />
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
        export-filename="meters"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-gauge" @click="openReadingsWith(row)">
              Readings
            </UButton>
            <template v-if="isAdmin">
              <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
                Edit
              </UButton>
              <UButton
                size="xs"
                :color="row.active ? 'error' : 'success'"
                variant="soft"
                :icon="row.active ? 'i-lucide-ban' : 'i-lucide-check'"
                @click="openStatusWith(row)"
              >
                {{ row.active ? 'Deactivate' : 'Activate' }}
              </UButton>
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = row">
                Delete
              </UButton>
            </template>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No meters match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-gauge" title="No meters yet" description="Add the first meter to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New meter</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New meter">
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

    <UModal v-model:open="showEdit" :title="`Edit meter '${editingRow?.meterNumber ?? ''}'`">
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
      :title="statusTarget?.active ? 'Deactivate meter' : 'Activate meter'"
      :description="
        statusTarget?.active
          ? `Deactivate meter '${statusTarget?.meterNumber ?? ''}'?`
          : `Activate meter '${statusTarget?.meterNumber ?? ''}'?`
      "
      :confirm-label="statusTarget?.active ? 'Deactivate' : 'Activate'"
      :color="statusTarget?.active ? 'error' : 'success'"
      :loading="statusLoading"
      @update:model-value="(v: boolean) => { if (!v) statusTarget = null }"
      @confirm="onStatusConfirm"
    />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete meter"
      :description="`Delete meter '${confirmDelete?.meterNumber ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />

    <UModal
      v-model:open="showReadings"
      :title="`Readings · ${readingsTarget?.meterNumber ?? ''}`"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <div v-if="consumptionInfo && consumptionInfo.consumption !== null" class="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm">
            <span class="text-gray-500 dark:text-gray-400">Latest consumption:</span>
            <span class="font-medium text-gray-900 dark:text-white ml-1">
              {{ consumptionInfo.consumption }} {{ readingsTarget?.unitOfMeasure }}
            </span>
            <span class="text-gray-400 ml-1">
              ({{ formatDate(consumptionInfo.previousReadingDate) }} → {{ formatDate(consumptionInfo.currentReadingDate) }})
            </span>
          </div>

          <div v-if="readingsLoading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="readings.length === 0" class="text-sm text-gray-400 mb-3">No readings recorded yet.</div>
          <div v-else class="space-y-1.5 mb-4">
            <div
              v-for="r in readings"
              :key="r.id"
              class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <span class="text-gray-600 dark:text-gray-300">
                {{ formatDate(r.readingDate) }}
                <span v-if="r.notes" class="text-gray-400">({{ r.notes }})</span>
              </span>
              <span class="font-medium text-gray-900 dark:text-white">{{ r.readingValue }} {{ readingsTarget?.unitOfMeasure }}</span>
            </div>
          </div>

          <DynamicForm
            v-if="isAdmin"
            v-model="readingForm"
            :fields="readingFields"
            :loading="readingSaving"
            :error="readingError"
            submit-label="Record reading"
            @submit="onAddReading"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type {
  ConsumptionInfo,
  CreateMeterPayload,
  Meter,
  MeterType,
  UpdateMeterPayload
} from '~/composables/useMeters'
import type { CreateMeterReadingPayload, MeterReading } from '~/composables/useMeterReadings'

const { isAdmin } = useAuth()
const { list, create, update, updateStatus, remove, consumption } = useMeters()
const { list: listReadings, create: createReading } = useMeterReadings()
const { list: listUnits } = useUnits()
const toast = useToast()

const rows = ref<Meter[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ unitId: number | undefined; meterType: MeterType | undefined; active: boolean | undefined }>({
  unitId: undefined,
  meterType: undefined,
  active: undefined
})

const unitOptions = ref<{ label: string; value: number }[]>([])
const unitFilterOptions = computed(() => [{ label: 'All units', value: undefined }, ...unitOptions.value])

const TYPE_OPTIONS: { label: string; value: MeterType }[] = [
  { label: 'Electricity', value: 'ELECTRICITY' },
  { label: 'Water', value: 'WATER' },
  { label: 'Gas', value: 'GAS' }
]
const typeFilterOptions = [{ label: 'All types', value: undefined }, ...TYPE_OPTIONS]
const activeFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false }
]

async function loadOptions() {
  const res = await listUnits({ size: 200 })
  unitOptions.value = res.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Meter>[] = [
  { key: 'meterNumber', label: 'Meter #', sortable: true },
  { key: 'meterType', label: 'Type', type: 'enum' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'unitOfMeasure', label: 'Unit of measure' },
  { key: 'installedDate', label: 'Installed', type: 'date' },
  { key: 'active', type: 'boolean' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      unitId: filter.unitId,
      meterType: filter.meterType,
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

const createFields = computed<FieldDef[]>(() => [
  { name: 'unitId', label: 'Unit', type: 'select', required: true, options: unitOptions.value },
  { name: 'meterType', label: 'Meter type', type: 'select', required: true, options: TYPE_OPTIONS, wrapper: 'half' },
  { name: 'meterNumber', label: 'Meter number', required: true, wrapper: 'half' },
  { name: 'unitOfMeasure', label: 'Unit of measure', required: true, hint: 'e.g. kWh, m³.', wrapper: 'half' },
  { name: 'installedDate', label: 'Installed date', type: 'date', wrapper: 'half' }
])

const editFields: FieldDef[] = [
  { name: 'meterNumber', label: 'Meter number', required: true, wrapper: 'half' },
  { name: 'unitOfMeasure', label: 'Unit of measure', required: true, wrapper: 'half' },
  { name: 'installedDate', label: 'Installed date', type: 'date', wrapper: 'half' }
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
} = useCrudModals<Meter, CreateMeterPayload, UpdateMeterPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Meter',
    createDefaults: () => ({ unitId: filter.unitId }),
    toForm: (row) => ({
      meterNumber: row.meterNumber,
      unitOfMeasure: row.unitOfMeasure,
      installedDate: row.installedDate ?? undefined
    }),
    toPayload: (values) => ({
      unitId: values.unitId,
      meterType: values.meterType,
      meterNumber: values.meterNumber,
      unitOfMeasure: values.unitOfMeasure,
      installedDate: values.installedDate || undefined
    }),
    toEditPayload: (values) => ({
      meterNumber: values.meterNumber,
      unitOfMeasure: values.unitOfMeasure,
      installedDate: values.installedDate || undefined
    })
  }
)

const statusTarget = ref<Meter | null>(null)
const statusLoading = ref(false)
function openStatusWith(row: Meter) {
  statusTarget.value = row
}
async function onStatusConfirm() {
  if (!statusTarget.value) return
  statusLoading.value = true
  try {
    const nextActive = !statusTarget.value.active
    await updateStatus(statusTarget.value.id, nextActive)
    toast.add({ title: `Meter ${nextActive ? 'activated' : 'deactivated'}`, color: 'success' })
    statusTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update meter status', description: apiErrorMessage(err), color: 'error' })
  } finally {
    statusLoading.value = false
  }
}

// Readings — list + compact create form, plus the latest computed consumption.
const {
  open: showReadings,
  target: readingsTarget,
  openWith: openReadingsWith
} = useTargetModal<Meter>()
const readings = ref<MeterReading[]>([])
const readingsLoading = ref(false)
const consumptionInfo = ref<ConsumptionInfo | null>(null)
const readingForm = ref<Record<string, any>>({})
const readingSaving = ref(false)
const readingError = ref('')
const readingFields: FieldDef[] = [
  { name: 'readingDate', label: 'Reading date', type: 'date', required: true, wrapper: 'half' },
  { name: 'readingValue', label: 'Reading value', type: 'number', required: true, step: 0.01, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

watch(showReadings, async (value) => {
  if (!value || !readingsTarget.value) return
  const meterId = readingsTarget.value.id

  readingForm.value = { readingDate: new Date().toISOString().slice(0, 10) }
  readingError.value = ''
  consumptionInfo.value = null

  readingsLoading.value = true
  try {
    const res = await listReadings({ meterId, size: 200 })
    readings.value = res.data
  } catch (err) {
    readingError.value = apiErrorMessage(err)
  } finally {
    readingsLoading.value = false
  }

  try {
    consumptionInfo.value = await consumption(meterId)
  } catch {
    // No consumption yet (fewer than two readings) — leave the panel hidden.
  }
})

async function onAddReading(values: Record<string, any>) {
  if (!readingsTarget.value) return
  readingSaving.value = true
  readingError.value = ''
  const payload: CreateMeterReadingPayload = {
    meterId: readingsTarget.value.id,
    readingDate: values.readingDate,
    readingValue: values.readingValue,
    notes: values.notes || undefined
  }
  try {
    await createReading(payload)
    const res = await listReadings({ meterId: readingsTarget.value.id, size: 200 })
    readings.value = res.data
    try {
      consumptionInfo.value = await consumption(readingsTarget.value.id)
    } catch {
      consumptionInfo.value = null
    }
    readingForm.value = { readingDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Reading recorded', color: 'success' })
  } catch (err) {
    readingError.value = apiErrorMessage(err)
  } finally {
    readingSaving.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.unitId, filter.meterType, filter.active], load)

const hasActiveFilter = computed(
  () => filter.unitId !== undefined || filter.meterType !== undefined || filter.active !== undefined
)

function clearFilters() {
  filter.unitId = undefined
  filter.meterType = undefined
  filter.active = undefined
  load()
}
</script>

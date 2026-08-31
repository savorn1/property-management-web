<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Parking spots</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New spot</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.buildingId" :items="buildingFilterOptions" placeholder="Building" class="w-56" />
        <USelect v-model="filter.type" :items="typeFilterOptions" placeholder="Type" class="w-44" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-44" />
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
        export-filename="parking-spots"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-car" @click="openAssignmentsWith(row)">
              Assignments
            </UButton>
            <template v-if="isAdmin">
              <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
                Edit
              </UButton>
              <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-shield" @click="openStatusWith(row)">
                Status
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
            title="No spots match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-square-parking" title="No parking spots yet" description="Add the first spot to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New spot</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New parking spot">
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

    <UModal v-model:open="showEdit" :title="`Edit spot '${editingRow?.spotNumber ?? ''}'`">
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

    <UModal v-model:open="showStatus" :title="`Update status · Spot '${statusTarget?.spotNumber ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="statusForm"
          :fields="statusFields"
          :loading="statusLoading"
          :error="statusError"
          submit-label="Update"
          cancelable
          @submit="onStatusSubmit"
          @cancel="showStatus = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete parking spot"
      :description="`Delete spot '${confirmDelete?.spotNumber ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />

    <UModal
      v-model:open="showAssignments"
      :title="`Assignments · Spot '${assignmentsTarget?.spotNumber ?? ''}'`"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <div v-if="assignmentsLoading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="assignments.length === 0" class="text-sm text-gray-400 mb-3">No assignments yet.</div>
          <div v-else class="space-y-1.5 mb-4">
            <div
              v-for="a in assignments"
              :key="a.id"
              class="flex items-center justify-between gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <span class="text-gray-600 dark:text-gray-300">
                Unit {{ a.unitNumber ?? a.unitId }} · {{ formatDate(a.startDate) }} – {{ a.endDate ? formatDate(a.endDate) : 'ongoing' }}
                <span v-if="a.notes" class="text-gray-400">({{ a.notes }})</span>
              </span>
              <div class="flex items-center gap-2 shrink-0">
                <StatusBadge :status="a.status" />
                <UButton
                  v-if="isAdmin && a.status === 'ACTIVE'"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :loading="endingId === a.id"
                  @click="onEndAssignment(a)"
                >
                  End
                </UButton>
              </div>
            </div>
          </div>

          <DynamicForm
            v-if="isAdmin"
            v-model="assignmentForm"
            :fields="assignmentFields"
            :loading="assignmentSaving"
            :error="assignmentError"
            submit-label="Assign"
            @submit="onAddAssignment"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type {
  CreateParkingSpotPayload,
  ParkingSpot,
  ParkingSpotStatus,
  ParkingSpotType,
  UpdateParkingSpotPayload
} from '~/composables/useParkingSpots'
import type { CreateParkingAssignmentPayload, ParkingAssignment } from '~/composables/useParkingAssignments'

const { isAdmin } = useAuth()
const { list, create, update, updateStatus, remove } = useParkingSpots()
const { list: listAssignments, create: createAssignment, end: endAssignment } = useParkingAssignments()
const { list: listBuildings } = useBuildings()
const { list: listUnits } = useUnits()
const toast = useToast()

const rows = ref<ParkingSpot[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ buildingId: number | undefined; type: ParkingSpotType | undefined; status: ParkingSpotStatus | undefined }>({
  buildingId: undefined,
  type: undefined,
  status: undefined
})

const buildingOptions = ref<{ label: string; value: number }[]>([])
const unitOptions = ref<{ label: string; value: number }[]>([])
const buildingFilterOptions = computed(() => [{ label: 'All buildings', value: undefined }, ...buildingOptions.value])

const TYPE_OPTIONS: { label: string; value: ParkingSpotType }[] = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Compact', value: 'COMPACT' },
  { label: 'Handicap', value: 'HANDICAP' },
  { label: 'Visitor', value: 'VISITOR' },
  { label: 'Motorcycle', value: 'MOTORCYCLE' }
]
const typeFilterOptions = [{ label: 'All types', value: undefined }, ...TYPE_OPTIONS]

const STATUS_OPTIONS: { label: string; value: ParkingSpotStatus }[] = [
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Unavailable', value: 'UNAVAILABLE' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const [buildingsRes, unitsRes] = await Promise.all([listBuildings({ size: 200 }), listUnits({ size: 200 })])
  buildingOptions.value = buildingsRes.data.map((b) => ({
    label: `${b.name}${b.propertyName ? ` — ${b.propertyName}` : ''}`,
    value: b.id
  }))
  unitOptions.value = unitsRes.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<ParkingSpot>[] = [
  { key: 'spotNumber', label: 'Spot #', sortable: true },
  { key: 'buildingName', label: 'Building', value: (row) => row.buildingName ?? '—' },
  { key: 'type', type: 'enum' },
  { key: 'status', type: 'status' },
  { key: 'monthlyFee', label: 'Monthly fee', type: 'currency' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      buildingId: filter.buildingId,
      type: filter.type,
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

const createFields = computed<FieldDef[]>(() => [
  { name: 'buildingId', label: 'Building', type: 'select', required: true, options: buildingOptions.value },
  { name: 'spotNumber', label: 'Spot number', required: true, wrapper: 'half' },
  { name: 'type', type: 'select', required: true, options: TYPE_OPTIONS, wrapper: 'half' },
  { name: 'monthlyFee', label: 'Monthly fee', type: 'currency', wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields: FieldDef[] = [
  { name: 'spotNumber', label: 'Spot number', required: true, wrapper: 'half' },
  { name: 'type', type: 'select', required: true, options: TYPE_OPTIONS, wrapper: 'half' },
  { name: 'monthlyFee', label: 'Monthly fee', type: 'currency', wrapper: 'half' },
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
} = useCrudModals<ParkingSpot, CreateParkingSpotPayload, UpdateParkingSpotPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Parking spot',
    createDefaults: () => ({ buildingId: filter.buildingId, type: 'STANDARD' }),
    toForm: (row) => ({
      spotNumber: row.spotNumber,
      type: row.type,
      monthlyFee: row.monthlyFee ?? undefined,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      buildingId: values.buildingId,
      spotNumber: values.spotNumber,
      type: values.type,
      monthlyFee: values.monthlyFee || undefined,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      spotNumber: values.spotNumber,
      type: values.type,
      monthlyFee: values.monthlyFee || undefined,
      description: values.description || undefined
    })
  }
)

// Status
const {
  open: showStatus,
  target: statusTarget,
  loading: statusLoading,
  error: statusError,
  openWith: openStatusWith
} = useTargetModal<ParkingSpot>()
const statusForm = ref<Record<string, any>>({})
const statusFields: FieldDef[] = [{ name: 'status', type: 'select', required: true, options: STATUS_OPTIONS }]
watch(showStatus, (value) => {
  if (value && statusTarget.value) statusForm.value = { status: statusTarget.value.status }
})
async function onStatusSubmit(values: Record<string, any>) {
  if (!statusTarget.value) return
  statusLoading.value = true
  statusError.value = ''
  try {
    await updateStatus(statusTarget.value.id, values.status)
    showStatus.value = false
    toast.add({ title: 'Parking spot status updated', color: 'success' })
    await load()
  } catch (err) {
    statusError.value = apiErrorMessage(err)
  } finally {
    statusLoading.value = false
  }
}

// Assignments — list of current/past assignments for a spot, plus a compact
// create form (admin only) to assign it to a unit.
const {
  open: showAssignments,
  target: assignmentsTarget,
  openWith: openAssignmentsWith
} = useTargetModal<ParkingSpot>()
const assignments = ref<ParkingAssignment[]>([])
const assignmentsLoading = ref(false)
const assignmentForm = ref<Record<string, any>>({})
const assignmentSaving = ref(false)
const assignmentError = ref('')
const endingId = ref<number | null>(null)
const assignmentFields = computed<FieldDef[]>(() => [
  { name: 'unitId', label: 'Unit', type: 'select', required: true, options: unitOptions.value },
  { name: 'startDate', label: 'Start date', type: 'date', required: true, wrapper: 'half' },
  { name: 'endDate', label: 'End date', type: 'date', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

async function loadAssignments(spotId: number) {
  assignmentsLoading.value = true
  try {
    const res = await listAssignments({ parkingSpotId: spotId, size: 200 })
    assignments.value = res.data
  } catch (err) {
    assignmentError.value = apiErrorMessage(err)
  } finally {
    assignmentsLoading.value = false
  }
}

watch(showAssignments, async (value) => {
  if (!value || !assignmentsTarget.value) return
  assignmentForm.value = { startDate: new Date().toISOString().slice(0, 10) }
  assignmentError.value = ''
  await loadAssignments(assignmentsTarget.value.id)
})

async function onAddAssignment(values: Record<string, any>) {
  if (!assignmentsTarget.value) return
  assignmentSaving.value = true
  assignmentError.value = ''
  const payload: CreateParkingAssignmentPayload = {
    parkingSpotId: assignmentsTarget.value.id,
    unitId: values.unitId,
    startDate: values.startDate,
    endDate: values.endDate || undefined,
    notes: values.notes || undefined
  }
  try {
    await createAssignment(payload)
    await loadAssignments(assignmentsTarget.value.id)
    assignmentForm.value = { startDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Parking spot assigned', color: 'success' })
    await load()
  } catch (err) {
    assignmentError.value = apiErrorMessage(err)
  } finally {
    assignmentSaving.value = false
  }
}

async function onEndAssignment(assignment: ParkingAssignment) {
  if (!assignmentsTarget.value) return
  endingId.value = assignment.id
  try {
    await endAssignment(assignment.id)
    await loadAssignments(assignmentsTarget.value.id)
    toast.add({ title: 'Parking assignment ended', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not end assignment', description: apiErrorMessage(err), color: 'error' })
  } finally {
    endingId.value = null
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.buildingId, filter.type, filter.status], load)

const hasActiveFilter = computed(
  () => filter.buildingId !== undefined || filter.type !== undefined || filter.status !== undefined
)

function clearFilters() {
  filter.buildingId = undefined
  filter.type = undefined
  filter.status = undefined
  load()
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Maintenance requests</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New request</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.unitId" :items="unitFilterOptions" placeholder="Unit" class="w-56" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-44" />
        <USelect v-model="filter.priority" :items="priorityFilterOptions" placeholder="Priority" class="w-40" />
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
        export-filename="maintenance-requests"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="isAdmin">
              <UButton
                v-if="row.status !== 'COMPLETED' && row.status !== 'CANCELLED'"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-hard-hat"
                @click="openAssignWith(row)"
              >
                Assign
              </UButton>
              <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-shield" @click="openStatusWith(row)">
                Status
              </UButton>
            </template>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-history" @click="openHistoryWith(row)">
              History
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-receipt" @click="openCostsWith(row)">
              Costs
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-cog" @click="openPartsWith(row)">
              Parts
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No requests match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-wrench" title="No maintenance requests yet" description="Log the first request to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New request</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New maintenance request">
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

    <UModal v-model:open="showAssign" :title="`Assign technician · ${assignTarget?.title ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="assignForm"
          :fields="assignFields"
          :loading="assignLoading"
          :error="assignError"
          submit-label="Assign"
          cancelable
          @submit="onAssignSubmit"
          @cancel="showAssign = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showStatus" :title="`Update status · ${statusTarget?.title ?? ''}`">
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

    <UModal v-model:open="showHistory" :title="`History · ${historyTarget?.title ?? ''}`">
      <template #body>
        <div v-if="historyLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="historyEntries.length === 0" class="text-sm text-gray-400">No history yet.</div>
        <div v-else class="space-y-3">
          <div
            v-for="h in historyEntries"
            :key="h.id"
            class="flex items-start justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-2"
          >
            <div>
              <div class="font-medium text-gray-900 dark:text-white">{{ formatEnum(h.action) }}</div>
              <div v-if="h.description" class="text-gray-500 dark:text-gray-400">{{ h.description }}</div>
              <div class="text-gray-400 text-xs mt-0.5">{{ h.performedBy ?? 'System' }}</div>
            </div>
            <div class="text-gray-400 text-xs whitespace-nowrap">{{ formatDateTime(h.createdAt) }}</div>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showCosts"
      :title="`Costs · ${costsTarget?.title ?? ''}`"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <div v-if="isAdmin">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Cost summary
            </h3>
            <DynamicForm
              v-model="costSummaryForm"
              :fields="costSummaryFields"
              :loading="costSummarySaving"
              :error="costSummaryError"
              submit-label="Save"
              @submit="onSaveCostSummary"
            />
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Cost lines
            </h3>
            <div v-if="costLinesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="costLines.length === 0" class="text-sm text-gray-400 mb-3">No cost lines recorded yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="c in costLines"
                :key="c.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ formatDate(c.costDate) }} · {{ formatEnum(c.type) }}
                  <span v-if="c.vendorName" class="text-gray-400">({{ c.vendorName }})</span>
                  <span v-if="c.description" class="text-gray-400">— {{ c.description }}</span>
                </span>
                <span class="font-medium text-gray-900 dark:text-white shrink-0">{{ formatCurrency(c.amount) }}</span>
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="costLineForm"
              :fields="costLineFields"
              :loading="costLineSaving"
              :error="costLineError"
              submit-label="Add cost line"
              @submit="onAddCostLine"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showParts"
      :title="`Parts used · ${partsTarget?.title ?? ''}`"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Parts used
            </h3>
            <div v-if="partsLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="partsUsed.length === 0" class="text-sm text-gray-400 mb-3">No parts recorded yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="p in partsUsed"
                :key="p.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ formatDate(p.usedDate) }} · {{ p.sparePartName ?? '—' }} × {{ p.quantity }}
                  <span v-if="p.notes" class="text-gray-400">({{ p.notes }})</span>
                </span>
                <span class="font-medium text-gray-900 dark:text-white shrink-0">{{ formatCurrency(p.totalCost) }}</span>
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="partForm"
              :fields="partFields"
              :loading="partSaving"
              :error="partError"
              submit-label="Record usage"
              @submit="onAddPartUsage"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type {
  AssignTechnicianPayload,
  CreateMaintenancePayload,
  MaintenancePriority,
  MaintenanceRequestItem,
  MaintenanceStatus,
  UpdateMaintenanceCostPayload,
  UpdateMaintenanceStatusPayload
} from '~/composables/useMaintenance'
import type { CreateMaintenanceCostPayload, MaintenanceCost } from '~/composables/useMaintenanceCosts'
import type { CreateSparePartUsagePayload, SparePartUsageEntry } from '~/composables/useSparePartUsage'

const route = useRoute()
const { isAdmin } = useAuth()
const { list, create, assign, updateStatus, updateCost, history } = useMaintenance()
const { list: listCosts, create: createCost } = useMaintenanceCosts()
const { list: listPartsUsage, create: createPartUsage } = useSparePartUsage()
const { list: listUnits } = useUnits()
const { list: listTenants } = useTenants()
const { list: listTechnicians } = useTechnicians()
const { list: listVendors } = useVendors()
const { list: listSpareParts } = useSpareParts()
const toast = useToast()

const rows = ref<MaintenanceRequestItem[]>([])
const loading = ref(false)
const error = ref('')

const initialStatus = (route.query.status as MaintenanceStatus | undefined) || undefined
const filter = reactive<{
  unitId: number | undefined
  status: MaintenanceStatus | undefined
  priority: MaintenancePriority | undefined
}>({
  unitId: undefined,
  status: initialStatus,
  priority: undefined
})

const unitOptions = ref<{ label: string; value: number }[]>([])
const tenantOptions = ref<{ label: string; value: number }[]>([])
const technicianOptions = ref<{ label: string; value: number }[]>([])
const vendorOptions = ref<{ label: string; value: number }[]>([])
const sparePartOptions = ref<{ label: string; value: number }[]>([])

const unitFilterOptions = computed(() => [{ label: 'All units', value: undefined }, ...unitOptions.value])

const STATUS_OPTIONS: { label: string; value: MaintenanceStatus }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const PRIORITY_OPTIONS: { label: string; value: MaintenancePriority }[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' }
]
const priorityFilterOptions = [{ label: 'All priorities', value: undefined }, ...PRIORITY_OPTIONS]

async function loadOptions() {
  const [unitsRes, tenantsRes, techRes, vendorsRes, partsRes] = await Promise.all([
    listUnits({ size: 200 }),
    listTenants({ size: 200 }),
    listTechnicians({ size: 200, active: true }),
    listVendors({ size: 200, active: true }),
    listSpareParts({ size: 200, active: true })
  ])
  unitOptions.value = unitsRes.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
  tenantOptions.value = tenantsRes.data.map((t) => ({ label: t.fullName, value: t.id }))
  technicianOptions.value = techRes.data.map((t) => ({ label: t.fullName, value: t.id }))
  vendorOptions.value = vendorsRes.data.map((v) => ({ label: v.name, value: v.id }))
  sparePartOptions.value = partsRes.data.map((p) => ({ label: p.name, value: p.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<MaintenanceRequestItem>[] = [
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'title' },
  { key: 'description', value: (row) => row.description ?? '—', class: 'max-w-64' },
  { key: 'priority', type: 'enum' },
  { key: 'status', type: 'status' },
  { key: 'technicianName', label: 'Technician', value: (row) => row.technicianName ?? '—' },
  { key: 'scheduledDate', label: 'Scheduled', type: 'date' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      unitId: filter.unitId,
      status: filter.status,
      priority: filter.priority,
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
  { name: 'tenantId', label: 'Reported by tenant', type: 'select', options: tenantOptions.value },
  { name: 'title', required: true },
  { name: 'priority', type: 'select', required: true, options: PRIORITY_OPTIONS },
  { name: 'description', type: 'textarea', wrapper: 'full' },
  { name: 'estimatedCost', label: 'Estimated cost', type: 'currency', wrapper: 'half' }
])

// No useCrudModals here — maintenance requests have no update/delete endpoints,
// only create plus the assign/status/cost lifecycle actions handled separately.
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})

function openCreate() {
  createForm.value = { unitId: filter.unitId, priority: 'MEDIUM' }
  createError.value = ''
  showCreate.value = true
}

async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  const payload: CreateMaintenancePayload = {
    unitId: values.unitId,
    tenantId: values.tenantId || undefined,
    title: values.title,
    description: values.description || undefined,
    priority: values.priority,
    estimatedCost: values.estimatedCost || undefined
  }
  try {
    await create(payload)
    toast.add({ title: 'Maintenance request created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Assign technician
const {
  open: showAssign,
  target: assignTarget,
  loading: assignLoading,
  error: assignError,
  openWith: openAssignWith
} = useTargetModal<MaintenanceRequestItem>()
const assignForm = ref<Record<string, any>>({})
const assignFields = computed<FieldDef[]>(() => [
  { name: 'technicianId', label: 'Technician', type: 'select', options: technicianOptions.value, hint: 'Pick a roster technician, or leave blank to enter a one-off technician below.' },
  { name: 'technicianName', label: 'Technician name', wrapper: 'half', showIf: (v) => !v.technicianId },
  { name: 'technicianContact', label: 'Technician contact', wrapper: 'half', showIf: (v) => !v.technicianId },
  { name: 'scheduledDate', label: 'Scheduled date', type: 'date' }
])
watch(showAssign, (value) => {
  if (value && assignTarget.value) {
    assignForm.value = {
      technicianId: assignTarget.value.technicianId ?? undefined,
      technicianName: assignTarget.value.technicianName ?? '',
      technicianContact: assignTarget.value.technicianContact ?? '',
      scheduledDate: assignTarget.value.scheduledDate ?? undefined
    }
  }
})
async function onAssignSubmit(values: Record<string, any>) {
  if (!assignTarget.value) return
  assignLoading.value = true
  assignError.value = ''
  const payload: AssignTechnicianPayload = {
    technicianId: values.technicianId || undefined,
    technicianName: values.technicianId ? undefined : values.technicianName || undefined,
    technicianContact: values.technicianId ? undefined : values.technicianContact || undefined,
    scheduledDate: values.scheduledDate || undefined
  }
  try {
    await assign(assignTarget.value.id, payload)
    showAssign.value = false
    toast.add({ title: 'Technician assigned', color: 'success' })
    await load()
  } catch (err) {
    assignError.value = apiErrorMessage(err)
  } finally {
    assignLoading.value = false
  }
}

// Update status
const {
  open: showStatus,
  target: statusTarget,
  loading: statusLoading,
  error: statusError,
  openWith: openStatusWith
} = useTargetModal<MaintenanceRequestItem>()
const statusForm = ref<Record<string, any>>({})
const statusFields: FieldDef[] = [
  { name: 'status', type: 'select', required: true, options: STATUS_OPTIONS },
  { name: 'completionNotes', label: 'Completion notes', type: 'textarea', wrapper: 'full' }
]
watch(showStatus, (value) => {
  if (value && statusTarget.value) {
    statusForm.value = { status: statusTarget.value.status, completionNotes: statusTarget.value.completionNotes ?? '' }
  }
})
async function onStatusSubmit(values: Record<string, any>) {
  if (!statusTarget.value) return
  statusLoading.value = true
  statusError.value = ''
  const payload: UpdateMaintenanceStatusPayload = {
    status: values.status,
    completionNotes: values.completionNotes || undefined
  }
  try {
    await updateStatus(statusTarget.value.id, payload)
    showStatus.value = false
    toast.add({ title: 'Status updated', color: 'success' })
    await load()
  } catch (err) {
    statusError.value = apiErrorMessage(err)
  } finally {
    statusLoading.value = false
  }
}

// History — read-only.
const {
  open: showHistory,
  target: historyTarget,
  openWith: openHistoryWith
} = useTargetModal<MaintenanceRequestItem>()
const historyEntries = ref<Awaited<ReturnType<typeof history>>>([])
const historyLoading = ref(false)
watch(showHistory, async (value) => {
  if (!value || !historyTarget.value) return
  historyLoading.value = true
  try {
    historyEntries.value = await history(historyTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load history', description: apiErrorMessage(err), color: 'error' })
  } finally {
    historyLoading.value = false
  }
})

// Costs — the request's estimated/actual cost summary, plus itemized cost lines.
const { open: showCosts, target: costsTarget, openWith: openCostsWith } = useTargetModal<MaintenanceRequestItem>()

const costSummaryForm = ref<Record<string, any>>({})
const costSummarySaving = ref(false)
const costSummaryError = ref('')
const costSummaryFields: FieldDef[] = [
  { name: 'estimatedCost', label: 'Estimated cost', type: 'currency', wrapper: 'half' },
  { name: 'actualCost', label: 'Actual cost', type: 'currency', wrapper: 'half' }
]

const costLines = ref<MaintenanceCost[]>([])
const costLinesLoading = ref(false)
const costLineForm = ref<Record<string, any>>({})
const costLineSaving = ref(false)
const costLineError = ref('')
const COST_TYPE_OPTIONS = [
  { label: 'Labor', value: 'LABOR' },
  { label: 'Parts', value: 'PARTS' },
  { label: 'Vendor service', value: 'VENDOR_SERVICE' },
  { label: 'Other', value: 'OTHER' }
]
const costLineFields = computed<FieldDef[]>(() => [
  { name: 'type', type: 'select', required: true, options: COST_TYPE_OPTIONS, wrapper: 'half' },
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'costDate', label: 'Cost date', type: 'date', required: true, wrapper: 'half' },
  { name: 'vendorId', label: 'Vendor', type: 'select', options: vendorOptions.value, wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

watch(showCosts, async (value) => {
  if (!value || !costsTarget.value) return
  const requestId = costsTarget.value.id

  costSummaryForm.value = {
    estimatedCost: costsTarget.value.estimatedCost ?? undefined,
    actualCost: costsTarget.value.actualCost ?? undefined
  }
  costSummaryError.value = ''

  costLineForm.value = { costDate: new Date().toISOString().slice(0, 10) }
  costLineError.value = ''
  costLinesLoading.value = true
  try {
    costLines.value = await listCosts(requestId)
  } catch (err) {
    costLineError.value = apiErrorMessage(err)
  } finally {
    costLinesLoading.value = false
  }
})

async function onSaveCostSummary(values: Record<string, any>) {
  if (!costsTarget.value) return
  costSummarySaving.value = true
  costSummaryError.value = ''
  const payload: UpdateMaintenanceCostPayload = {
    estimatedCost: values.estimatedCost || undefined,
    actualCost: values.actualCost || undefined
  }
  try {
    await updateCost(costsTarget.value.id, payload)
    toast.add({ title: 'Cost summary saved', color: 'success' })
    await load()
  } catch (err) {
    costSummaryError.value = apiErrorMessage(err)
  } finally {
    costSummarySaving.value = false
  }
}

async function onAddCostLine(values: Record<string, any>) {
  if (!costsTarget.value) return
  costLineSaving.value = true
  costLineError.value = ''
  const payload: CreateMaintenanceCostPayload = {
    type: values.type,
    description: values.description || undefined,
    amount: values.amount,
    vendorId: values.vendorId || undefined,
    costDate: values.costDate
  }
  try {
    await createCost(costsTarget.value.id, payload)
    costLines.value = await listCosts(costsTarget.value.id)
    costLineForm.value = { costDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Cost line recorded', color: 'success' })
  } catch (err) {
    costLineError.value = apiErrorMessage(err)
  } finally {
    costLineSaving.value = false
  }
}

// Parts used
const { open: showParts, target: partsTarget, openWith: openPartsWith } = useTargetModal<MaintenanceRequestItem>()
const partsUsed = ref<SparePartUsageEntry[]>([])
const partsLoading = ref(false)
const partForm = ref<Record<string, any>>({})
const partSaving = ref(false)
const partError = ref('')
const partFields = computed<FieldDef[]>(() => [
  { name: 'sparePartId', label: 'Spare part', type: 'select', required: true, options: sparePartOptions.value },
  { name: 'quantity', type: 'number', required: true, min: 1, wrapper: 'half' },
  { name: 'unitCost', label: 'Unit cost override', type: 'currency', wrapper: 'half', hint: 'Leave blank to use the part\'s current unit cost.' },
  { name: 'usedDate', label: 'Used date', type: 'date', required: true, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])
watch(showParts, async (value) => {
  if (!value || !partsTarget.value) return
  partForm.value = { usedDate: new Date().toISOString().slice(0, 10) }
  partError.value = ''
  partsLoading.value = true
  try {
    partsUsed.value = await listPartsUsage(partsTarget.value.id)
  } catch (err) {
    partError.value = apiErrorMessage(err)
  } finally {
    partsLoading.value = false
  }
})
async function onAddPartUsage(values: Record<string, any>) {
  if (!partsTarget.value) return
  partSaving.value = true
  partError.value = ''
  const payload: CreateSparePartUsagePayload = {
    sparePartId: values.sparePartId,
    quantity: values.quantity,
    unitCost: values.unitCost || undefined,
    usedDate: values.usedDate,
    notes: values.notes || undefined
  }
  try {
    await createPartUsage(partsTarget.value.id, payload)
    partsUsed.value = await listPartsUsage(partsTarget.value.id)
    partForm.value = { usedDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Part usage recorded', color: 'success' })
  } catch (err) {
    partError.value = apiErrorMessage(err)
  } finally {
    partSaving.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.unitId, filter.status, filter.priority], load)

const hasActiveFilter = computed(
  () => filter.unitId !== undefined || filter.status !== undefined || filter.priority !== undefined
)

function clearFilters() {
  filter.unitId = undefined
  filter.status = undefined
  filter.priority = undefined
  load()
}
</script>

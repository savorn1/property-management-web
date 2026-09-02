<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Move-in requests</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New request</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.leaseId" :items="leaseFilterOptions" placeholder="Lease" class="w-48" />
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
        export-filename="move-in-requests"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <RowActions :actions="moveInActions(row)" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No move-in requests match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-log-in" title="No move-in requests yet" description="Create the first request to get started.">
            <template #action>
              <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New request</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New move-in request">
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

    <ConfirmModal
      :model-value="approveTarget !== null"
      title="Approve move-in request"
      :description="`Approve the move-in request for '${approveTarget?.tenantName ?? ''}' on unit '${approveTarget?.unitNumber ?? ''}'?`"
      confirm-label="Approve"
      color="success"
      :loading="approving"
      @update:model-value="(v: boolean) => { if (!v) approveTarget = null }"
      @confirm="onApprove"
    />

    <ConfirmModal
      :model-value="completeTarget !== null"
      title="Complete move-in"
      :description="`Mark the move-in for '${completeTarget?.tenantName ?? ''}' as completed?`"
      confirm-label="Complete"
      color="success"
      :loading="completing"
      @update:model-value="(v: boolean) => { if (!v) completeTarget = null }"
      @confirm="onComplete"
    />

    <UModal v-model:open="showReject" :title="`Reject move-in request for '${rejectTarget?.tenantName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="rejectForm"
          :fields="rejectFields"
          :loading="rejectLoading"
          :error="rejectError"
          submit-label="Reject"
          cancelable
          @submit="onRejectSubmit"
          @cancel="showReject = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showInspection"
      :title="`Inspection · ${inspectionTarget?.tenantName ?? ''} — Unit ${inspectionTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <div v-if="inspectionLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="inspection" class="text-sm space-y-1 mb-3">
          <div>{{ formatDate(inspection.inspectionDate) }} · Inspected by {{ inspection.inspectedBy }}</div>
          <div>Condition: <StatusBadge :status="inspection.condition" /></div>
          <div v-if="inspection.notes" class="text-gray-400">{{ inspection.notes }}</div>
        </div>
        <DynamicForm
          v-else-if="isAdmin"
          v-model="inspectionForm"
          :fields="inspectionFields"
          :loading="inspectionSaving"
          :error="inspectionError"
          submit-label="Record inspection"
          @submit="onRecordInspection"
        />
        <div v-else class="text-sm text-gray-400">No inspection recorded yet.</div>
      </template>
    </UModal>

    <UModal
      v-model:open="showKeys"
      :title="`Key handovers · ${keysTarget?.tenantName ?? ''} — Unit ${keysTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <div v-if="keysLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="keyHandovers.length === 0" class="text-sm text-gray-400 mb-3">No keys handed over yet.</div>
        <div v-else class="space-y-1.5 mb-4">
          <div
            v-for="k in keyHandovers"
            :key="k.id"
            class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
          >
            <span class="text-gray-600 dark:text-gray-300">
              {{ k.quantity }}× {{ k.keyType }} · {{ formatDate(k.handoverDate) }} · {{ k.handedOverBy }}
              <span v-if="k.returned" class="text-gray-400">(returned {{ k.returnedDate ? formatDate(k.returnedDate) : '' }})</span>
            </span>
            <UButton
              v-if="isAdmin && !k.returned"
              size="xs"
              color="neutral"
              variant="soft"
              :loading="returningKeyId === k.id"
              @click="onReturnKey(k)"
            >
              Mark returned
            </UButton>
          </div>
        </div>
        <DynamicForm
          v-if="isAdmin"
          v-model="keyForm"
          :fields="keyFields"
          :loading="keySaving"
          :error="keyError"
          submit-label="Record handover"
          @submit="onRecordKeyHandover"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type {
  CreateKeyHandoverPayload,
  CreateMoveInPayload,
  KeyHandover,
  MoveInInspection,
  MoveInRequest,
  MoveInStatus
} from '~/composables/useMoveIn'
import type { CreateInspectionPayload } from '#shared/domain'

const route = useRoute()
const { isAdmin } = useAuth()
const {
  list,
  create,
  approve,
  reject,
  complete,
  getInspection,
  recordInspection,
  getKeyHandovers,
  recordKeyHandover,
  returnKey
} = useMoveIn()
const { list: listLeases } = useLeases()
const toast = useToast()

const rows = ref<MoveInRequest[]>([])
const loading = ref(false)
const error = ref('')

const initialLeaseId = Number(route.query.leaseId) || undefined
const filter = reactive<{ leaseId: number | undefined; status: MoveInStatus | undefined }>({
  leaseId: initialLeaseId,
  status: undefined
})

const leaseOptions = ref<{ label: string; value: number }[]>([])
const leaseFilterOptions = computed(() => [{ label: 'All leases', value: undefined }, ...leaseOptions.value])

const STATUS_OPTIONS: { label: string; value: MoveInStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Completed', value: 'COMPLETED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadLeaseOptions() {
  const res = await listLeases({ size: 200 })
  leaseOptions.value = res.data.map((l) => ({
    label: `${l.tenantName ?? 'Tenant'} — Unit ${l.unitNumber ?? ''}`,
    value: l.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<MoveInRequest>[] = [
  { key: 'tenantName', label: 'Tenant', value: (row) => row.tenantName ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'requestedMoveInDate', label: 'Requested date', type: 'date' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      leaseId: filter.leaseId,
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
  { name: 'leaseId', label: 'Lease', type: 'select', required: true, options: leaseOptions.value },
  { name: 'requestedMoveInDate', label: 'Requested move-in date', type: 'date', required: true },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

// No useCrudModals — this workflow has no generic update/delete, only create
// plus the lifecycle actions handled separately below (mirrors leases).
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})

function openCreate() {
  createForm.value = { leaseId: filter.leaseId }
  createError.value = ''
  showCreate.value = true
}

async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  const payload: CreateMoveInPayload = {
    leaseId: values.leaseId,
    requestedMoveInDate: values.requestedMoveInDate,
    notes: values.notes || undefined
  }
  try {
    await create(payload)
    toast.add({ title: 'Move-in request created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Approve — plain confirm
const approveTarget = ref<MoveInRequest | null>(null)
const approving = ref(false)
function openApproveWith(row: MoveInRequest) {
  approveTarget.value = row
}
async function onApprove() {
  if (!approveTarget.value) return
  approving.value = true
  try {
    await approve(approveTarget.value.id)
    toast.add({ title: 'Move-in request approved', color: 'success' })
    approveTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not approve request', description: apiErrorMessage(err), color: 'error' })
  } finally {
    approving.value = false
  }
}

// Complete — plain confirm
const completeTarget = ref<MoveInRequest | null>(null)
const completing = ref(false)
function openCompleteWith(row: MoveInRequest) {
  completeTarget.value = row
}
async function onComplete() {
  if (!completeTarget.value) return
  completing.value = true
  try {
    await complete(completeTarget.value.id)
    toast.add({ title: 'Move-in completed', color: 'success' })
    completeTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not complete move-in', description: apiErrorMessage(err), color: 'error' })
  } finally {
    completing.value = false
  }
}

// Reject — small form (optional reason)
const {
  open: showReject,
  target: rejectTarget,
  loading: rejectLoading,
  error: rejectError,
  openWith: openRejectWith
} = useTargetModal<MoveInRequest>()
const rejectForm = ref<Record<string, any>>({})
const rejectFields: FieldDef[] = [{ name: 'reason', type: 'textarea', hint: 'Optional.' }]
watch(showReject, (value) => {
  if (value) rejectForm.value = {}
})
async function onRejectSubmit(values: Record<string, any>) {
  if (!rejectTarget.value) return
  rejectLoading.value = true
  rejectError.value = ''
  try {
    await reject(rejectTarget.value.id, values.reason || undefined)
    showReject.value = false
    toast.add({ title: 'Move-in request rejected', color: 'success' })
    await load()
  } catch (err) {
    rejectError.value = apiErrorMessage(err)
  } finally {
    rejectLoading.value = false
  }
}

// Inspection and Key handovers each get their own modal/target (rather than
// one general-purpose "Manage" catch-all) — distinct concerns.
const { open: showInspection, target: inspectionTarget, openWith: openInspectionWith } = useTargetModal<MoveInRequest>()
const { open: showKeys, target: keysTarget, openWith: openKeysWith } = useTargetModal<MoveInRequest>()

const inspection = ref<MoveInInspection | null>(null)
const inspectionLoading = ref(false)
const inspectionForm = ref<Record<string, any>>({})
const inspectionSaving = ref(false)
const inspectionError = ref('')
const CONDITION_OPTIONS = [
  { label: 'Excellent', value: 'EXCELLENT' },
  { label: 'Good', value: 'GOOD' },
  { label: 'Fair', value: 'FAIR' },
  { label: 'Poor', value: 'POOR' }
]
const inspectionFields: FieldDef[] = [
  { name: 'inspectionDate', label: 'Inspection date', type: 'date', required: true, wrapper: 'half' },
  { name: 'inspectedBy', label: 'Inspected by', required: true, wrapper: 'half' },
  { name: 'condition', type: 'select', required: true, options: CONDITION_OPTIONS },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

const keyHandovers = ref<KeyHandover[]>([])
const keysLoading = ref(false)
const keyForm = ref<Record<string, any>>({})
const keySaving = ref(false)
const keyError = ref('')
const returningKeyId = ref<number | null>(null)
const keyFields: FieldDef[] = [
  { name: 'keyType', label: 'Key type', required: true, wrapper: 'half' },
  { name: 'quantity', type: 'number', required: true, min: 1, default: 1, wrapper: 'half' },
  { name: 'handoverDate', label: 'Handover date', type: 'date', required: true, wrapper: 'half' },
  { name: 'handedOverBy', label: 'Handed over by', required: true, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

watch(showInspection, async (value) => {
  if (!value || !inspectionTarget.value) return
  const id = inspectionTarget.value.id

  inspection.value = null
  inspectionForm.value = { inspectionDate: new Date().toISOString().slice(0, 10) }
  inspectionError.value = ''
  inspectionLoading.value = true
  try {
    inspection.value = await getInspection(id)
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status !== 404) inspectionError.value = apiErrorMessage(err)
  } finally {
    inspectionLoading.value = false
  }
})

watch(showKeys, async (value) => {
  if (!value || !keysTarget.value) return
  const id = keysTarget.value.id

  keyForm.value = { handoverDate: new Date().toISOString().slice(0, 10), quantity: 1 }
  keyError.value = ''
  keysLoading.value = true
  try {
    keyHandovers.value = await getKeyHandovers(id)
  } catch (err) {
    keyError.value = apiErrorMessage(err)
  } finally {
    keysLoading.value = false
  }
})

async function onRecordInspection(values: Record<string, any>) {
  if (!inspectionTarget.value) return
  inspectionSaving.value = true
  inspectionError.value = ''
  const payload: CreateInspectionPayload = {
    inspectionDate: values.inspectionDate,
    inspectedBy: values.inspectedBy,
    condition: values.condition,
    notes: values.notes || undefined
  }
  try {
    inspection.value = await recordInspection(inspectionTarget.value.id, payload)
    toast.add({ title: 'Inspection recorded', color: 'success' })
    await load()
  } catch (err) {
    inspectionError.value = apiErrorMessage(err)
  } finally {
    inspectionSaving.value = false
  }
}

async function onRecordKeyHandover(values: Record<string, any>) {
  if (!keysTarget.value) return
  keySaving.value = true
  keyError.value = ''
  const payload: CreateKeyHandoverPayload = {
    keyType: values.keyType,
    quantity: values.quantity,
    handoverDate: values.handoverDate,
    handedOverBy: values.handedOverBy,
    notes: values.notes || undefined
  }
  try {
    await recordKeyHandover(keysTarget.value.id, payload)
    keyForm.value = { handoverDate: new Date().toISOString().slice(0, 10), quantity: 1 }
    toast.add({ title: 'Key handover recorded', color: 'success' })
    keyHandovers.value = await getKeyHandovers(keysTarget.value.id)
    await load()
  } catch (err) {
    keyError.value = apiErrorMessage(err)
  } finally {
    keySaving.value = false
  }
}

async function onReturnKey(k: KeyHandover) {
  if (!keysTarget.value) return
  returningKeyId.value = k.id
  try {
    await returnKey(keysTarget.value.id, k.id)
    toast.add({ title: 'Key marked as returned', color: 'success' })
    keyHandovers.value = await getKeyHandovers(keysTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not update key handover', description: apiErrorMessage(err), color: 'error' })
  } finally {
    returningKeyId.value = null
  }
}

onMounted(async () => {
  await loadLeaseOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.leaseId, filter.status], load)

const hasActiveFilter = computed(() => filter.leaseId !== undefined || filter.status !== undefined)

function clearFilters() {
  filter.leaseId = undefined
  filter.status = undefined
  load()
}

function moveInActions(row: MoveInRequest): RowAction[] {
  const actions: RowAction[] = []
  if (isAdmin.value && row.status === 'PENDING') {
    actions.push({ label: 'Approve', icon: 'i-lucide-check', color: 'success', onClick: () => openApproveWith(row) })
    actions.push({ label: 'Reject', icon: 'i-lucide-x', color: 'error', onClick: () => openRejectWith(row) })
  }
  if (isAdmin.value && row.status === 'APPROVED') {
    actions.push({ label: 'Complete', icon: 'i-lucide-flag', color: 'success', onClick: () => openCompleteWith(row) })
  }
  actions.push({ label: 'Inspection', icon: 'i-lucide-clipboard-check', onClick: () => openInspectionWith(row) })
  actions.push({ label: 'Key handovers', icon: 'i-lucide-key', onClick: () => openKeysWith(row) })
  return actions
}
</script>

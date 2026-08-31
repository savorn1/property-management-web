<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Move-out requests</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New request</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.leaseId" :items="leaseFilterOptions" placeholder="Lease" class="w-56" />
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
        export-filename="move-out-requests"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="isAdmin && row.status === 'PENDING'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              @click="openApproveWith(row)"
            >
              Approve
            </UButton>
            <UButton
              v-if="isAdmin && row.status === 'PENDING'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-x"
              @click="openRejectWith(row)"
            >
              Reject
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-settings-2" @click="openManageWith(row)">
              Manage
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No move-out requests match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-log-out" title="No move-out requests yet" description="Create the first request to get started.">
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

    <UModal v-model:open="showCreate" title="New move-out request">
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
      title="Approve move-out request"
      :description="`Approve the move-out request for '${approveTarget?.tenantName ?? ''}' on unit '${approveTarget?.unitNumber ?? ''}'?`"
      confirm-label="Approve"
      color="success"
      :loading="approving"
      @update:model-value="(v: boolean) => { if (!v) approveTarget = null }"
      @confirm="onApprove"
    />

    <UModal v-model:open="showReject" :title="`Reject move-out request for '${rejectTarget?.tenantName ?? ''}'`">
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

    <UModal v-model:open="showManage" :title="`Manage move-out · ${manageTarget?.tenantName ?? ''} — Unit ${manageTarget?.unitNumber ?? ''}`" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div class="max-h-[70vh] overflow-y-auto space-y-6 pr-1">
          <div>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Inspection
            </h3>
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
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Damage charges
            </h3>
            <div v-if="damageChargesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="damageCharges.length === 0" class="text-sm text-gray-400 mb-3">No damage charges recorded.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="d in damageCharges"
                :key="d.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">{{ d.description }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(d.amount) }}</span>
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="damageChargeForm"
              :fields="damageChargeFields"
              :loading="damageChargeSaving"
              :error="damageChargeError"
              submit-label="Add charge"
              @submit="onAddDamageCharge"
            />
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Deposit settlement
            </h3>
            <div v-if="settlementLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="settlement" class="text-sm space-y-1 mb-3">
              <div>Deposit: {{ formatCurrency(settlement.depositAmount) }}</div>
              <div>Damage charges: {{ formatCurrency(settlement.totalDamageCharges) }}</div>
              <div>Other deductions: {{ formatCurrency(settlement.otherDeductions) }}</div>
              <div class="font-medium text-gray-900 dark:text-white">Refund: {{ formatCurrency(settlement.refundAmount) }}</div>
              <div><StatusBadge :status="settlement.status" /></div>
              <UButton
                v-if="isAdmin && settlement.status === 'PENDING'"
                size="xs"
                color="success"
                variant="soft"
                :loading="settling"
                class="mt-2"
                @click="onSettle"
              >
                Settle
              </UButton>
            </div>
            <DynamicForm
              v-else-if="isAdmin"
              v-model="settlementForm"
              :fields="settlementFields"
              :loading="settlementSaving"
              :error="settlementError"
              submit-label="Calculate settlement"
              @submit="onCreateSettlement"
            />
            <div v-else class="text-sm text-gray-400">No settlement calculated yet.</div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Unit release
            </h3>
            <div v-if="releaseLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitRelease" class="text-sm space-y-1">
              <div>Released {{ formatDate(unitRelease.releaseDate) }} by {{ unitRelease.releasedBy ?? '—' }}</div>
              <div v-if="unitRelease.notes" class="text-gray-400">{{ unitRelease.notes }}</div>
            </div>
            <UButton
              v-else-if="isAdmin"
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-lucide-door-closed"
              :loading="releasing"
              @click="onReleaseUnit"
            >
              Release unit
            </UButton>
            <div v-else class="text-sm text-gray-400">Unit not released yet.</div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type {
  CreateDamageChargePayload,
  CreateInspectionPayload,
  CreateMoveOutPayload,
  DamageCharge,
  DepositSettlement,
  MoveOutInspection,
  MoveOutRequest,
  MoveOutStatus,
  UnitRelease
} from '~/composables/useMoveOut'

const route = useRoute()
const { isAdmin } = useAuth()
const {
  list,
  create,
  approve,
  reject,
  getInspection,
  recordInspection,
  addDamageCharge,
  getSettlement,
  createSettlement,
  settleDeposit,
  getUnitRelease,
  releaseUnit
} = useMoveOut()
const { list: listLeases } = useLeases()
const toast = useToast()

const rows = ref<MoveOutRequest[]>([])
const loading = ref(false)
const error = ref('')

const initialLeaseId = Number(route.query.leaseId) || undefined
const filter = reactive<{ leaseId: number | undefined; status: MoveOutStatus | undefined }>({
  leaseId: initialLeaseId,
  status: undefined
})

const leaseOptions = ref<{ label: string; value: number }[]>([])
const leaseFilterOptions = computed(() => [{ label: 'All leases', value: undefined }, ...leaseOptions.value])

const STATUS_OPTIONS: { label: string; value: MoveOutStatus }[] = [
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

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<MoveOutRequest>[] = [
  { key: 'tenantName', label: 'Tenant', value: (row) => row.tenantName ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'requestedMoveOutDate', label: 'Requested date', type: 'date' },
  { key: 'refundAmount', label: 'Refund', type: 'currency', value: (row) => row.refundAmount ?? 0 },
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
  { name: 'requestedMoveOutDate', label: 'Requested move-out date', type: 'date', required: true },
  { name: 'reason' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

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
  const payload: CreateMoveOutPayload = {
    leaseId: values.leaseId,
    requestedMoveOutDate: values.requestedMoveOutDate,
    reason: values.reason || undefined,
    notes: values.notes || undefined
  }
  try {
    await create(payload)
    toast.add({ title: 'Move-out request created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Approve — plain confirm
const approveTarget = ref<MoveOutRequest | null>(null)
const approving = ref(false)
function openApproveWith(row: MoveOutRequest) {
  approveTarget.value = row
}
async function onApprove() {
  if (!approveTarget.value) return
  approving.value = true
  try {
    await approve(approveTarget.value.id)
    toast.add({ title: 'Move-out request approved', color: 'success' })
    approveTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not approve request', description: apiErrorMessage(err), color: 'error' })
  } finally {
    approving.value = false
  }
}

// Reject — small form (optional reason)
const {
  open: showReject,
  target: rejectTarget,
  loading: rejectLoading,
  error: rejectError,
  openWith: openRejectWith
} = useTargetModal<MoveOutRequest>()
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
    toast.add({ title: 'Move-out request rejected', color: 'success' })
    await load()
  } catch (err) {
    rejectError.value = apiErrorMessage(err)
  } finally {
    rejectLoading.value = false
  }
}

// Manage — inspection + damage charges + settlement + unit release
const { open: showManage, target: manageTarget, openWith: openManageWith } = useTargetModal<MoveOutRequest>()

const inspection = ref<MoveOutInspection | null>(null)
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

const damageCharges = ref<DamageCharge[]>([])
const damageChargesLoading = ref(false)
const damageChargeForm = ref<Record<string, any>>({})
const damageChargeSaving = ref(false)
const damageChargeError = ref('')
const damageChargeFields: FieldDef[] = [
  { name: 'description', required: true },
  { name: 'amount', type: 'currency', required: true }
]

const settlement = ref<DepositSettlement | null>(null)
const settlementLoading = ref(false)
const settlementForm = ref<Record<string, any>>({})
const settlementSaving = ref(false)
const settlementError = ref('')
const settling = ref(false)
const settlementFields: FieldDef[] = [
  { name: 'otherDeductions', label: 'Other deductions', type: 'currency' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

const unitRelease = ref<UnitRelease | null>(null)
const releaseLoading = ref(false)
const releasing = ref(false)

async function loadDamageCharges(id: number) {
  damageChargesLoading.value = true
  try {
    const insp = await getInspection(id)
    damageCharges.value = insp.damageCharges ?? []
  } catch {
    damageCharges.value = []
  } finally {
    damageChargesLoading.value = false
  }
}

watch(showManage, async (value) => {
  if (!value || !manageTarget.value) return
  const id = manageTarget.value.id

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

  damageChargeForm.value = {}
  damageChargeError.value = ''
  await loadDamageCharges(id)

  settlement.value = null
  settlementForm.value = {}
  settlementError.value = ''
  settlementLoading.value = true
  try {
    settlement.value = await getSettlement(id)
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status !== 404) settlementError.value = apiErrorMessage(err)
  } finally {
    settlementLoading.value = false
  }

  unitRelease.value = null
  releaseLoading.value = true
  try {
    unitRelease.value = await getUnitRelease(id)
  } catch {
    unitRelease.value = null
  } finally {
    releaseLoading.value = false
  }
})

async function onRecordInspection(values: Record<string, any>) {
  if (!manageTarget.value) return
  inspectionSaving.value = true
  inspectionError.value = ''
  const payload: CreateInspectionPayload = {
    inspectionDate: values.inspectionDate,
    inspectedBy: values.inspectedBy,
    condition: values.condition,
    notes: values.notes || undefined
  }
  try {
    inspection.value = await recordInspection(manageTarget.value.id, payload)
    toast.add({ title: 'Inspection recorded', color: 'success' })
    await loadDamageCharges(manageTarget.value.id)
    await load()
  } catch (err) {
    inspectionError.value = apiErrorMessage(err)
  } finally {
    inspectionSaving.value = false
  }
}

async function onAddDamageCharge(values: Record<string, any>) {
  if (!manageTarget.value) return
  damageChargeSaving.value = true
  damageChargeError.value = ''
  const payload: CreateDamageChargePayload = { description: values.description, amount: values.amount }
  try {
    await addDamageCharge(manageTarget.value.id, payload)
    damageChargeForm.value = {}
    toast.add({ title: 'Damage charge added', color: 'success' })
    await loadDamageCharges(manageTarget.value.id)
    await load()
  } catch (err) {
    damageChargeError.value = apiErrorMessage(err)
  } finally {
    damageChargeSaving.value = false
  }
}

async function onCreateSettlement(values: Record<string, any>) {
  if (!manageTarget.value) return
  settlementSaving.value = true
  settlementError.value = ''
  try {
    settlement.value = await createSettlement(manageTarget.value.id, {
      otherDeductions: values.otherDeductions || undefined,
      notes: values.notes || undefined
    })
    toast.add({ title: 'Settlement calculated', color: 'success' })
    await load()
  } catch (err) {
    settlementError.value = apiErrorMessage(err)
  } finally {
    settlementSaving.value = false
  }
}

async function onSettle() {
  if (!manageTarget.value) return
  settling.value = true
  try {
    settlement.value = await settleDeposit(manageTarget.value.id)
    toast.add({ title: 'Deposit settled', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not settle deposit', description: apiErrorMessage(err), color: 'error' })
  } finally {
    settling.value = false
  }
}

async function onReleaseUnit() {
  if (!manageTarget.value) return
  releasing.value = true
  try {
    unitRelease.value = await releaseUnit(manageTarget.value.id, {})
    toast.add({ title: 'Unit released', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not release unit', description: apiErrorMessage(err), color: 'error' })
  } finally {
    releasing.value = false
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
</script>

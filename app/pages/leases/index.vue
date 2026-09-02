<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Leases</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New lease</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.tenantId" :items="tenantFilterOptions" placeholder="Tenant" class="w-48" />
        <USelect v-model="filter.unitId" :items="unitFilterOptions" placeholder="Unit" class="w-48" />
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
        export-filename="leases"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <RowActions :actions="leaseActions(row)" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No leases match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-file-signature" title="No leases yet" description="Create the first lease to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New lease</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New lease">
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
      title="Approve lease"
      :description="`Approve the lease for '${approveTarget?.tenantName ?? ''}' on unit '${approveTarget?.unitNumber ?? ''}'?`"
      confirm-label="Approve"
      color="success"
      :loading="approving"
      @update:model-value="(v: boolean) => { if (!v) approveTarget = null }"
      @confirm="onApprove"
    />

    <UModal v-model:open="showRenew" :title="`Renew lease for '${renewTarget?.tenantName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="renewForm"
          :fields="renewFields"
          :loading="renewLoading"
          :error="renewError"
          submit-label="Renew"
          cancelable
          @submit="onRenewSubmit"
          @cancel="showRenew = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showTerminate" :title="`Terminate lease for '${terminateTarget?.tenantName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="terminateForm"
          :fields="terminateFields"
          :loading="terminateLoading"
          :error="terminateError"
          submit-label="Terminate"
          cancelable
          @submit="onTerminateSubmit"
          @cancel="showTerminate = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showRentConfig"
      :title="`Rent configuration · ${rentConfigTarget?.tenantName ?? ''} — Unit ${rentConfigTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <DynamicForm
          v-model="rentConfigForm"
          :fields="rentConfigFields"
          :loading="rentConfigSaving"
          :error="rentConfigError"
          submit-label="Save"
          @submit="onSaveRentConfig"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showDeposit"
      :title="`Deposit payments · ${depositTarget?.tenantName ?? ''} — Unit ${depositTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <div v-if="depositPaymentsLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="depositPayments.length === 0" class="text-sm text-gray-400 mb-3">
          No deposit payments recorded yet.
        </div>
        <div v-else class="space-y-1.5 mb-4">
          <div
            v-for="p in depositPayments"
            :key="p.id"
            class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
          >
            <span class="text-gray-600 dark:text-gray-300">
              {{ formatDate(p.paymentDate) }} · {{ formatEnum(p.method) }}
              <span v-if="p.referenceNumber" class="text-gray-400">({{ p.referenceNumber }})</span>
            </span>
            <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(p.amount) }}</span>
          </div>
        </div>
        <DynamicForm
          v-model="depositForm"
          :fields="depositFields"
          :loading="depositSaving"
          :error="depositError"
          submit-label="Add payment"
          @submit="onAddDeposit"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showDocuments"
      :title="`Documents · ${documentsTarget?.tenantName ?? ''} — Unit ${documentsTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <div v-if="documentsLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="documents.length === 0" class="text-sm text-gray-400 mb-3">
          No documents uploaded yet.
        </div>
        <div v-else class="space-y-1.5 mb-4">
          <div
            v-for="d in documents"
            :key="d.id"
            class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
          >
            <div>
              <button class="text-primary-500 hover:underline text-left" @click="onDownloadDocument(d)">{{ d.fileName }}</button>
              <span v-if="d.description" class="text-gray-400"> — {{ d.description }}</span>
              <div class="text-xs text-gray-400">{{ formatDateTime(d.createdAt) }} · {{ d.uploadedBy ?? '—' }}</div>
            </div>
            <UButton
              v-if="isAdmin"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="onDeleteDocument(d)"
            />
          </div>
        </div>

        <FileUploadField v-if="isAdmin" :upload="uploadDocumentForTarget" @uploaded="onDocumentUploaded" />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type {
  CreateDepositPaymentPayload,
  CreateLeasePayload,
  DepositPayment,
  Lease,
  LeaseStatus,
  RentConfiguration,
  RentConfigurationPayload
} from '~/composables/useLeases'
import type { LeaseDocument } from '~/composables/useLeaseDocuments'

const route = useRoute()
const {
  list,
  create,
  approve,
  renew,
  terminate,
  getRentConfiguration,
  createRentConfiguration,
  updateRentConfiguration,
  listDepositPayments,
  createDepositPayment
} = useLeases()
const { list: listTenants } = useTenants()
const { list: listUnits } = useUnits()
const {
  list: listDocuments,
  upload: uploadDocument,
  remove: removeDocument,
  download: downloadDocument
} = useLeaseDocuments()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<Lease[]>([])
const loading = ref(false)
const error = ref('')

const initialTenantId = Number(route.query.tenantId) || undefined
const initialUnitId = Number(route.query.unitId) || undefined
const initialStatus = (route.query.status as LeaseStatus | undefined) || undefined
const filter = reactive<{ tenantId: number | undefined; unitId: number | undefined; status: LeaseStatus | undefined }>({
  tenantId: initialTenantId,
  unitId: initialUnitId,
  status: initialStatus
})

const tenantOptions = ref<{ label: string; value: number }[]>([])
const unitOptions = ref<{ label: string; value: number }[]>([])
const tenantFilterOptions = computed(() => [{ label: 'All tenants', value: undefined }, ...tenantOptions.value])
const unitFilterOptions = computed(() => [{ label: 'All units', value: undefined }, ...unitOptions.value])

const STATUS_OPTIONS: { label: string; value: LeaseStatus }[] = [
  { label: 'Pending approval', value: 'PENDING_APPROVAL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Terminated', value: 'TERMINATED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const [tenantsRes, unitsRes] = await Promise.all([listTenants({ size: 200 }), listUnits({ size: 200 })])
  tenantOptions.value = tenantsRes.data.map((t) => ({ label: t.fullName, value: t.id }))
  unitOptions.value = unitsRes.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Lease>[] = [
  { key: 'tenantName', label: 'Tenant', value: (row) => row.tenantName ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'startDate', type: 'date' },
  { key: 'endDate', type: 'date' },
  { key: 'rentAmount', label: 'Rent', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      tenantId: filter.tenantId,
      unitId: filter.unitId,
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
  { name: 'tenantId', label: 'Tenant', type: 'select', required: true, options: tenantOptions.value },
  { name: 'unitId', label: 'Unit', type: 'select', required: true, options: unitOptions.value },
  { name: 'startDate', label: 'Start date', type: 'date', required: true, wrapper: 'half' },
  { name: 'endDate', label: 'End date', type: 'date', required: true, wrapper: 'half' },
  { name: 'rentAmount', label: 'Rent amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'depositAmount', label: 'Deposit amount', type: 'currency', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

// No useCrudModals here — leases have no update/delete endpoints, only
// create plus the approve/renew/terminate actions handled separately below.
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})

function openCreate() {
  createForm.value = { tenantId: filter.tenantId, unitId: filter.unitId }
  createError.value = ''
  showCreate.value = true
}

async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  const payload: CreateLeasePayload = {
    tenantId: values.tenantId,
    unitId: values.unitId,
    startDate: values.startDate,
    endDate: values.endDate,
    rentAmount: values.rentAmount,
    depositAmount: values.depositAmount,
    notes: values.notes || undefined
  }
  try {
    await create(payload)
    toast.add({ title: 'Lease created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Approve — a plain confirm, no extra payload.
const approveTarget = ref<Lease | null>(null)
const approving = ref(false)
function openApproveWith(row: Lease) {
  approveTarget.value = row
}
async function onApprove() {
  if (!approveTarget.value) return
  approving.value = true
  try {
    await approve(approveTarget.value.id)
    toast.add({ title: 'Lease approved', color: 'success' })
    approveTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not approve lease', description: apiErrorMessage(err), color: 'error' })
  } finally {
    approving.value = false
  }
}

// Renew
const {
  open: showRenew,
  target: renewTarget,
  loading: renewLoading,
  error: renewError,
  openWith: openRenewWith
} = useTargetModal<Lease>()
const renewForm = ref<Record<string, any>>({})
const renewFields: FieldDef[] = [
  { name: 'newEndDate', label: 'New end date', type: 'date', required: true },
  { name: 'newRentAmount', label: 'New rent amount', type: 'currency', hint: 'Leave blank to keep the current rent.' }
]
watch(showRenew, (value) => {
  if (value && renewTarget.value) {
    renewForm.value = { newEndDate: renewTarget.value.endDate, newRentAmount: renewTarget.value.rentAmount }
  }
})
async function onRenewSubmit(values: Record<string, any>) {
  if (!renewTarget.value) return
  renewLoading.value = true
  renewError.value = ''
  try {
    await renew(renewTarget.value.id, { newEndDate: values.newEndDate, newRentAmount: values.newRentAmount })
    showRenew.value = false
    toast.add({ title: 'Lease renewed', color: 'success' })
    await load()
  } catch (err) {
    renewError.value = apiErrorMessage(err)
  } finally {
    renewLoading.value = false
  }
}

// Terminate
const {
  open: showTerminate,
  target: terminateTarget,
  loading: terminateLoading,
  error: terminateError,
  openWith: openTerminateWith
} = useTargetModal<Lease>()
const terminateForm = ref<Record<string, any>>({})
const terminateFields: FieldDef[] = [
  { name: 'terminationDate', label: 'Termination date', type: 'date', default: new Date().toISOString().slice(0, 10) },
  { name: 'reason', type: 'textarea' }
]
watch(showTerminate, (value) => {
  if (value) terminateForm.value = {}
})
async function onTerminateSubmit(values: Record<string, any>) {
  if (!terminateTarget.value) return
  terminateLoading.value = true
  terminateError.value = ''
  try {
    await terminate(terminateTarget.value.id, { terminationDate: values.terminationDate || undefined, reason: values.reason || undefined })
    showTerminate.value = false
    toast.add({ title: 'Lease terminated', color: 'success' })
    await load()
  } catch (err) {
    terminateError.value = apiErrorMessage(err)
  } finally {
    terminateLoading.value = false
  }
}

// Documents — its own modal/target, scoped to one lease.
const {
  open: showDocuments,
  target: documentsTarget,
  openWith: openDocumentsWith
} = useTargetModal<Lease>()

// Deposit payments — its own modal/target (each of Documents/Deposit/Rent
// config is a distinct, self-contained concern rather than a sub-section of
// a general-purpose "Manage" catch-all).
const {
  open: showDeposit,
  target: depositTarget,
  openWith: openDepositWith
} = useTargetModal<Lease>()

// Rent configuration — its own modal/target (billing cycle/due day/late fee
// is set once up front and rarely touched again, unlike deposit payments and
// documents which accumulate over the lease).
const {
  open: showRentConfig,
  target: rentConfigTarget,
  openWith: openRentConfigWith
} = useTargetModal<Lease>()

const rentConfigForm = ref<Record<string, any>>({})
const rentConfigSaving = ref(false)
const rentConfigError = ref('')
const rentConfigExists = ref(false)

const BILLING_CYCLE_OPTIONS = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Yearly', value: 'YEARLY' }
]
const LATE_FEE_TYPE_OPTIONS = [
  { label: 'None', value: 'NONE' },
  { label: 'Fixed', value: 'FIXED' },
  { label: 'Percentage', value: 'PERCENTAGE' }
]
const rentConfigFields: FieldDef[] = [
  { name: 'billingCycle', label: 'Billing cycle', type: 'select', required: true, options: BILLING_CYCLE_OPTIONS },
  { name: 'dueDayOfMonth', label: 'Due day of month', type: 'number', required: true, min: 1, max: 28 },
  { name: 'lateFeeType', label: 'Late fee type', type: 'select', required: true, options: LATE_FEE_TYPE_OPTIONS },
  { name: 'lateFeeAmount', label: 'Late fee amount', type: 'currency', wrapper: 'half' },
  { name: 'gracePeriodDays', label: 'Grace period (days)', type: 'number', min: 0, wrapper: 'half' }
]

const depositPayments = ref<DepositPayment[]>([])
const depositPaymentsLoading = ref(false)
const depositForm = ref<Record<string, any>>({})
const depositSaving = ref(false)
const depositError = ref('')

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]
const depositFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

const documents = ref<LeaseDocument[]>([])
const documentsLoading = ref(false)

async function loadDocuments() {
  if (!documentsTarget.value) return
  documentsLoading.value = true
  try {
    documents.value = await listDocuments(documentsTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load documents', description: apiErrorMessage(err), color: 'error' })
  } finally {
    documentsLoading.value = false
  }
}

function uploadDocumentForTarget(file: File, description?: string) {
  return uploadDocument(documentsTarget.value!.id, file, description)
}

async function onDocumentUploaded() {
  toast.add({ title: 'Document uploaded', color: 'success' })
  await loadDocuments()
}

async function onDeleteDocument(doc: LeaseDocument) {
  if (!documentsTarget.value) return
  try {
    await removeDocument(documentsTarget.value.id, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments()
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadDocument(doc: LeaseDocument) {
  if (!documentsTarget.value) return
  try {
    await downloadDocument(documentsTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

watch(showDocuments, async (value) => {
  if (!value || !documentsTarget.value) return
  await loadDocuments()
})

watch(showDeposit, async (value) => {
  if (!value || !depositTarget.value) return
  const leaseId = depositTarget.value.id

  depositForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
  depositError.value = ''
  depositPaymentsLoading.value = true
  try {
    depositPayments.value = await listDepositPayments(leaseId)
  } catch (err) {
    depositError.value = apiErrorMessage(err)
  } finally {
    depositPaymentsLoading.value = false
  }
})

watch(showRentConfig, async (value) => {
  if (!value || !rentConfigTarget.value) return
  const leaseId = rentConfigTarget.value.id

  rentConfigError.value = ''
  rentConfigForm.value = { billingCycle: 'MONTHLY', dueDayOfMonth: 1, lateFeeType: 'NONE' }
  rentConfigExists.value = false
  try {
    const config: RentConfiguration = await getRentConfiguration(leaseId)
    rentConfigForm.value = {
      billingCycle: config.billingCycle,
      dueDayOfMonth: config.dueDayOfMonth,
      lateFeeType: config.lateFeeType,
      lateFeeAmount: config.lateFeeAmount ?? undefined,
      gracePeriodDays: config.gracePeriodDays ?? undefined
    }
    rentConfigExists.value = true
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status !== 404) {
      rentConfigError.value = apiErrorMessage(err)
    }
  }
})

async function onSaveRentConfig(values: Record<string, any>) {
  if (!rentConfigTarget.value) return
  rentConfigSaving.value = true
  rentConfigError.value = ''
  const payload: RentConfigurationPayload = {
    billingCycle: values.billingCycle,
    dueDayOfMonth: values.dueDayOfMonth,
    lateFeeType: values.lateFeeType,
    lateFeeAmount: values.lateFeeAmount,
    gracePeriodDays: values.gracePeriodDays
  }
  try {
    if (rentConfigExists.value) {
      await updateRentConfiguration(rentConfigTarget.value.id, payload)
    } else {
      await createRentConfiguration(rentConfigTarget.value.id, payload)
      rentConfigExists.value = true
    }
    toast.add({ title: 'Rent configuration saved', color: 'success' })
  } catch (err) {
    rentConfigError.value = apiErrorMessage(err)
  } finally {
    rentConfigSaving.value = false
  }
}

async function onAddDeposit(values: Record<string, any>) {
  if (!depositTarget.value) return
  depositSaving.value = true
  depositError.value = ''
  const payload: CreateDepositPaymentPayload = {
    amount: values.amount,
    paymentDate: values.paymentDate,
    method: values.method,
    referenceNumber: values.referenceNumber || undefined,
    notes: values.notes || undefined
  }
  try {
    await createDepositPayment(depositTarget.value.id, payload)
    depositPayments.value = await listDepositPayments(depositTarget.value.id)
    depositForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Deposit payment recorded', color: 'success' })
    await load()
  } catch (err) {
    depositError.value = apiErrorMessage(err)
  } finally {
    depositSaving.value = false
  }
}

function leaseActions(row: Lease): RowAction[] {
  const actions: RowAction[] = []
  if (row.status === 'PENDING_APPROVAL') {
    actions.push({ label: 'Approve', icon: 'i-lucide-check', color: 'success', onClick: () => openApproveWith(row) })
  }
  if (row.status === 'ACTIVE') {
    actions.push({ label: 'Renew', icon: 'i-lucide-refresh-cw', onClick: () => openRenewWith(row) })
    actions.push({ label: 'Terminate', icon: 'i-lucide-ban', color: 'error', onClick: () => openTerminateWith(row) })
  }
  actions.push({ label: 'Rent config', icon: 'i-lucide-banknote', onClick: () => openRentConfigWith(row) })
  actions.push({ label: 'Deposit', icon: 'i-lucide-piggy-bank', onClick: () => openDepositWith(row) })
  actions.push({ label: 'Documents', icon: 'i-lucide-folder', onClick: () => openDocumentsWith(row) })
  return actions
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.tenantId, filter.unitId, filter.status], load)

const hasActiveFilter = computed(
  () => filter.tenantId !== undefined || filter.unitId !== undefined || filter.status !== undefined
)

function clearFilters() {
  filter.tenantId = undefined
  filter.unitId = undefined
  filter.status = undefined
  load()
}
</script>

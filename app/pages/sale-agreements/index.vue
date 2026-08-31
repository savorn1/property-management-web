<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Sale agreements</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New agreement</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.unitId" :items="unitFilterOptions" placeholder="Unit" class="w-56" />
        <USelect v-model="filter.buyerId" :items="buyerFilterOptions" placeholder="Buyer" class="w-56" />
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

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="sale-agreements"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="isAdmin && row.status === 'ACTIVE'"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-percent"
              @click="openDiscountWith(row)"
            >
              Discount
            </UButton>
            <UButton
              v-if="isAdmin && row.status === 'ACTIVE'"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-user-round"
              @click="openAgentWith(row)"
            >
              Agent
            </UButton>
            <UButton
              v-if="isAdmin && row.agentId && !row.commissionPaid"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              @click="openCommissionWith(row)"
            >
              Mark commission paid
            </UButton>
            <UButton
              v-if="isAdmin && row.status === 'ACTIVE'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-ban"
              @click="openCancelWith(row)"
            >
              Cancel
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
            title="No sale agreements match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-file-signature" title="No sale agreements yet" description="Create the first agreement to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New agreement</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New sale agreement">
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

    <UModal v-model:open="showDiscount" :title="`Apply discount · ${discountTarget?.buyerName ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="discountForm"
          :fields="discountFields"
          :loading="discountLoading"
          :error="discountError"
          submit-label="Apply"
          cancelable
          @submit="onDiscountSubmit"
          @cancel="showDiscount = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showAgent" :title="`Assign agent · ${agentTarget?.buyerName ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="agentForm"
          :fields="agentFields"
          :loading="agentLoading"
          :error="agentError"
          submit-label="Assign"
          cancelable
          @submit="onAgentSubmit"
          @cancel="showAgent = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="commissionTarget !== null"
      title="Mark commission paid"
      :description="`Mark the commission for '${commissionTarget?.buyerName ?? ''}' (agent: ${commissionTarget?.agentName ?? ''}) as paid?`"
      confirm-label="Mark paid"
      color="success"
      :loading="commissionLoading"
      @update:model-value="(v: boolean) => { if (!v) commissionTarget = null }"
      @confirm="onCommissionConfirm"
    />

    <UModal v-model:open="showCancel" :title="`Cancel agreement · ${cancelTarget?.buyerName ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="cancelForm"
          :fields="cancelFields"
          :loading="cancelLoading"
          :error="cancelError"
          submit-label="Cancel agreement"
          cancelable
          @submit="onCancelSubmit"
          @cancel="showCancel = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showManage"
      :title="`Manage agreement · ${manageTarget?.buyerName ?? ''} — Unit ${manageTarget?.unitNumber ?? ''}`"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <div class="space-y-8 max-h-[70vh] overflow-y-auto pr-1">
          <!-- Payment plan & installment schedule -->
          <div>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Payment plan
            </h3>
            <div v-if="planLoading" class="text-sm text-gray-400">Loading…</div>
            <template v-else>
              <DynamicForm
                v-if="!paymentPlan"
                v-model="planForm"
                :fields="planFields"
                :loading="planSaving"
                :error="planError"
                submit-label="Create plan"
                @submit="onCreatePlan"
              />
              <div v-else class="space-y-3">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><span class="text-gray-400">Down payment</span><br />{{ formatCurrency(paymentPlan.downPaymentAmount) }}</div>
                  <div><span class="text-gray-400">Installments</span><br />{{ paymentPlan.installmentCount }}</div>
                  <div><span class="text-gray-400">Frequency</span><br />{{ formatEnum(paymentPlan.installmentFrequency) }}</div>
                  <div><span class="text-gray-400">First due</span><br />{{ formatDate(paymentPlan.firstInstallmentDate) }}</div>
                </div>

                <UButton
                  v-if="!paymentPlan.scheduleGenerated"
                  size="sm"
                  icon="i-lucide-calendar-plus"
                  :loading="generatingSchedule"
                  @click="onGenerateSchedule"
                >
                  Generate schedule
                </UButton>

                <div v-else class="space-y-1.5">
                  <div
                    v-for="inst in schedule"
                    :key="inst.id"
                    class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
                  >
                    <div>
                      <span class="font-medium text-gray-900 dark:text-white">#{{ inst.installmentNumber }}</span>
                      <span class="text-gray-400"> · due {{ formatDate(inst.dueDate) }}</span>
                      <StatusBadge :status="inst.status" class="ml-2" />
                      <span v-if="inst.overdue" class="text-error-500 ml-1">overdue</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-300">
                        {{ formatCurrency(inst.amountPaid) }} / {{ formatCurrency(inst.amount) }}
                      </span>
                      <UButton
                        v-if="isAdmin && inst.status !== 'PAID'"
                        size="xs"
                        color="success"
                        variant="soft"
                        icon="i-lucide-plus"
                        @click="openRecordPaymentWith(inst)"
                      >
                        Pay
                      </UButton>
                    </div>
                  </div>
                  <div v-if="schedule.length === 0" class="text-sm text-gray-400">No installments generated yet.</div>
                </div>
              </div>
            </template>
          </div>

          <!-- Down payments / other agreement-level payments -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Payments
            </h3>
            <div v-if="paymentsLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="payments.length === 0" class="text-sm text-gray-400 mb-3">No payments recorded yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="p in payments"
                :key="p.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ formatDate(p.paymentDate) }} · {{ formatEnum(p.type) }} · {{ formatEnum(p.method) }}
                  <span v-if="p.referenceNumber" class="text-gray-400">({{ p.referenceNumber }})</span>
                </span>
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(p.amount) }}</span>
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin && manageTarget?.status === 'ACTIVE'"
              v-model="downPaymentForm"
              :fields="downPaymentFields"
              :loading="downPaymentSaving"
              :error="downPaymentError"
              submit-label="Record down payment"
              @submit="onRecordDownPayment"
            />
          </div>

          <!-- Documents -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Documents
            </h3>
            <div v-if="documentsLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="documents.length === 0" class="text-sm text-gray-400 mb-3">No documents uploaded yet.</div>
            <div v-else class="space-y-1.5 mb-3">
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
            <div v-if="isAdmin" class="space-y-3">
              <input ref="docFileInput" type="file" class="text-sm" @change="onDocFileChange" />
              <UInput v-model="docDescription" placeholder="Description (optional)" class="w-full" />
              <UAlert v-if="docUploadError" color="error" variant="subtle" :title="docUploadError" />
              <UButton :loading="docUploading" :disabled="!docSelectedFile" icon="i-lucide-upload" @click="onUploadDocument">
                Upload
              </UButton>
            </div>
          </div>

          <!-- Handover -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Handover
            </h3>
            <div v-if="handoverLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="handover" class="text-sm space-y-1">
              <p><span class="text-gray-400">Date:</span> {{ formatDate(handover.handoverDate) }}</p>
              <p><span class="text-gray-400">Handed over by:</span> {{ handover.handedOverBy }}</p>
              <p><span class="text-gray-400">Condition:</span> {{ formatEnum(handover.condition) }}</p>
              <p v-if="handover.notes" class="text-gray-600 dark:text-gray-300">{{ handover.notes }}</p>
            </div>
            <DynamicForm
              v-else-if="isAdmin"
              v-model="handoverForm"
              :fields="handoverFields"
              :loading="handoverSaving"
              :error="handoverError"
              submit-label="Record handover"
              @submit="onCreateHandover"
            />
            <p v-else class="text-sm text-gray-400">No handover recorded yet.</p>
          </div>

          <!-- Refund -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Refund
            </h3>
            <div v-if="refundLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="refund" class="text-sm space-y-1">
              <p><span class="text-gray-400">Total paid:</span> {{ formatCurrency(refund.totalPaid) }}</p>
              <p><span class="text-gray-400">Deductions:</span> {{ formatCurrency(refund.deductions) }}</p>
              <p><span class="text-gray-400">Refund amount:</span> {{ formatCurrency(refund.refundAmount) }}</p>
              <p><span class="text-gray-400">Status:</span> <StatusBadge :status="refund.status" /></p>
              <UButton
                v-if="isAdmin && refund.status === 'PENDING'"
                size="sm"
                color="success"
                class="mt-2"
                :loading="refundProcessing"
                @click="onProcessRefund"
              >
                Process refund
              </UButton>
            </div>
            <DynamicForm
              v-else-if="isAdmin"
              v-model="refundForm"
              :fields="refundFields"
              :loading="refundSaving"
              :error="refundError"
              submit-label="Calculate refund"
              @submit="onCreateRefund"
            />
            <p v-else class="text-sm text-gray-400">No refund recorded yet.</p>
          </div>

          <!-- Ownership transfer -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Ownership transfer
            </h3>
            <div v-if="transferLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="transfer" class="text-sm space-y-1">
              <p><span class="text-gray-400">Date:</span> {{ formatDate(transfer.transferDate) }}</p>
              <p><span class="text-gray-400">Registered by:</span> {{ transfer.registeredBy }}</p>
              <p v-if="transfer.documentReference"><span class="text-gray-400">Document reference:</span> {{ transfer.documentReference }}</p>
              <p v-if="transfer.notes" class="text-gray-600 dark:text-gray-300">{{ transfer.notes }}</p>
            </div>
            <DynamicForm
              v-else-if="isAdmin"
              v-model="transferForm"
              :fields="transferFields"
              :loading="transferSaving"
              :error="transferError"
              submit-label="Record transfer"
              @submit="onCreateTransfer"
            />
            <p v-else class="text-sm text-gray-400">No ownership transfer recorded yet.</p>
          </div>

          <!-- History -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              History
            </h3>
            <div v-if="historyLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="historyEntries.length === 0" class="text-sm text-gray-400">No history recorded yet.</div>
            <div v-else class="space-y-3">
              <div v-for="h in historyEntries" :key="h.id" class="border-b border-gray-100 dark:border-gray-800 pb-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatEnum(h.action) }}</span>
                  <span class="text-gray-400">{{ formatDateTime(h.createdAt) }}</span>
                </div>
                <p v-if="h.description" class="text-sm text-gray-600 dark:text-gray-300">{{ h.description }}</p>
                <p v-if="h.performedBy" class="text-xs text-gray-400">by {{ h.performedBy }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showRecordPayment" :title="`Record installment payment · #${recordPaymentTarget?.installmentNumber ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="recordPaymentForm"
          :fields="recordPaymentFields"
          :loading="recordPaymentLoading"
          :error="recordPaymentError"
          submit-label="Record payment"
          cancelable
          @submit="onRecordPaymentSubmit"
          @cancel="showRecordPayment = false"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { SaleAgreement, SaleAgreementStatus, SaleHistoryEntry } from '~/composables/useSaleAgreements'
import type { SalePayment } from '~/composables/useSaleReservations'
import type { PaymentPlan, Installment } from '~/composables/usePaymentPlans'
import type { SaleAgreementDocument } from '~/composables/useSaleAgreementDocuments'
import type { SaleHandover } from '~/composables/useSaleHandovers'
import type { SaleRefund } from '~/composables/useSaleRefunds'
import type { OwnershipTransfer } from '~/composables/useOwnershipTransfers'

const route = useRoute()
const router = useRouter()
const {
  list,
  create,
  applyDiscount,
  assignAgent,
  markCommissionPaid,
  cancel,
  history,
  listPayments,
  recordDownPayment
} = useSaleAgreements()
const { get: getPlan, create: createPlan, getSchedule, generateSchedule } = usePaymentPlans()
const { create: createInstallmentPayment } = useInstallmentPayments()
const {
  list: listDocs,
  upload: uploadDoc,
  remove: removeDoc,
  download: downloadDoc
} = useSaleAgreementDocuments()
const { get: getHandover, create: createHandover } = useSaleHandovers()
const { get: getRefund, create: createRefund, process: processRefund } = useSaleRefunds()
const { get: getTransfer, create: createTransfer } = useOwnershipTransfers()
const { list: listUnits } = useUnits()
const { list: listBuyers } = useBuyers()
const { list: listAgents } = useSalesAgents()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<SaleAgreement[]>([])
const loading = ref(false)
const error = ref('')

const initialStatus = (route.query.status as SaleAgreementStatus | undefined) || undefined
// Only seeded here when arriving as a plain filter link (e.g. from a property's
// overview page) — the reservation "create agreement" hand-off below also sends
// unitId, but is distinguished by reservationId and takes over via showCreate.
const initialUnitId = route.query.reservationId ? undefined : Number(route.query.unitId) || undefined
const filter = reactive<{ unitId: number | undefined; buyerId: number | undefined; status: SaleAgreementStatus | undefined }>({
  unitId: initialUnitId,
  buyerId: undefined,
  status: initialStatus
})

const unitOptions = ref<{ label: string; value: number }[]>([])
const buyerOptions = ref<{ label: string; value: number }[]>([])
const agentOptions = ref<{ label: string; value: number }[]>([])
const unitFilterOptions = computed(() => [{ label: 'All units', value: undefined }, ...unitOptions.value])
const buyerFilterOptions = computed(() => [{ label: 'All buyers', value: undefined }, ...buyerOptions.value])

async function loadOptions() {
  const [unitsRes, buyersRes, agentsRes] = await Promise.all([
    listUnits({ size: 200 }),
    listBuyers({ size: 200 }),
    listAgents({ active: true, size: 200 })
  ])
  unitOptions.value = unitsRes.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
  buyerOptions.value = buyersRes.data.map((b) => ({ label: b.fullName, value: b.id }))
  agentOptions.value = agentsRes.data.map((a) => ({ label: a.fullName, value: a.id }))
}

const STATUS_OPTIONS: { label: string; value: SaleAgreementStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const BILLING_CYCLE_OPTIONS = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Yearly', value: 'YEARLY' }
]
const CONDITION_OPTIONS = [
  { label: 'Excellent', value: 'EXCELLENT' },
  { label: 'Good', value: 'GOOD' },
  { label: 'Fair', value: 'FAIR' },
  { label: 'Poor', value: 'POOR' }
]
const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'id', direction: 'desc' })
const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<SaleAgreement>[] = [
  { key: 'buyerName', label: 'Buyer', value: (row) => row.buyerName ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'agreementDate', label: 'Date', type: 'date' },
  { key: 'salePrice', label: 'Sale price', type: 'currency' },
  { key: 'netPrice', label: 'Net price', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      unitId: filter.unitId,
      buyerId: filter.buyerId,
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
  { name: 'unitId', label: 'Unit', type: 'select', required: true, options: unitOptions.value },
  { name: 'buyerId', label: 'Buyer', type: 'select', required: true, options: buyerOptions.value },
  { name: 'agreementDate', label: 'Agreement date', type: 'date', required: true, wrapper: 'half', default: new Date().toISOString().slice(0, 10) },
  { name: 'salePrice', label: 'Sale price', type: 'currency', required: true, wrapper: 'half' },
  { name: 'saleListingId', type: 'hidden' },
  { name: 'reservationId', type: 'hidden' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})
function openCreate() {
  createForm.value = { agreementDate: new Date().toISOString().slice(0, 10) }
  createError.value = ''
  showCreate.value = true
}
async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  try {
    await create({
      unitId: values.unitId,
      buyerId: values.buyerId,
      saleListingId: values.saleListingId || undefined,
      reservationId: values.reservationId || undefined,
      agreementDate: values.agreementDate,
      salePrice: values.salePrice,
      notes: values.notes || undefined
    })
    toast.add({ title: 'Sale agreement created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Prefill + auto-open create, coming from a "Create agreement" link on the
// Sale Reservations page (query: reservationId, saleListingId, unitId, buyerId).
onMounted(async () => {
  await loadOptions()
  await load()
  const q = route.query
  if (q.reservationId) {
    createForm.value = {
      agreementDate: new Date().toISOString().slice(0, 10),
      unitId: q.unitId ? Number(q.unitId) : undefined,
      buyerId: q.buyerId ? Number(q.buyerId) : undefined,
      saleListingId: q.saleListingId ? Number(q.saleListingId) : undefined,
      reservationId: q.reservationId ? Number(q.reservationId) : undefined
    }
    createError.value = ''
    showCreate.value = true
    router.replace({ path: '/sale-agreements' })
  }
})

// Apply discount
const {
  open: showDiscount,
  target: discountTarget,
  loading: discountLoading,
  error: discountError,
  openWith: openDiscountWith
} = useTargetModal<SaleAgreement>()
const discountForm = ref<Record<string, any>>({})
const discountFields: FieldDef[] = [
  { name: 'discountAmount', label: 'Discount amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'discountReason', label: 'Reason', wrapper: 'half' }
]
watch(showDiscount, (value) => {
  if (value && discountTarget.value) {
    discountForm.value = { discountAmount: discountTarget.value.discountAmount, discountReason: discountTarget.value.discountReason ?? '' }
  }
})
async function onDiscountSubmit(values: Record<string, any>) {
  if (!discountTarget.value) return
  discountLoading.value = true
  discountError.value = ''
  try {
    await applyDiscount(discountTarget.value.id, { discountAmount: values.discountAmount, discountReason: values.discountReason || undefined })
    showDiscount.value = false
    toast.add({ title: 'Discount applied', color: 'success' })
    await load()
  } catch (err) {
    discountError.value = apiErrorMessage(err)
  } finally {
    discountLoading.value = false
  }
}

// Assign agent
const {
  open: showAgent,
  target: agentTarget,
  loading: agentLoading,
  error: agentError,
  openWith: openAgentWith
} = useTargetModal<SaleAgreement>()
const agentForm = ref<Record<string, any>>({})
const agentFields = computed<FieldDef[]>(() => [
  { name: 'agentId', label: 'Sales agent', type: 'select', required: true, options: agentOptions.value },
  { name: 'commissionRate', label: 'Commission rate (%)', type: 'number', min: 0, max: 100, step: 0.01, hint: 'Leave blank to use the agent’s default rate.' }
])
watch(showAgent, (value) => {
  if (value && agentTarget.value) {
    agentForm.value = { agentId: agentTarget.value.agentId ?? undefined, commissionRate: agentTarget.value.commissionRate ?? undefined }
  }
})
async function onAgentSubmit(values: Record<string, any>) {
  if (!agentTarget.value) return
  agentLoading.value = true
  agentError.value = ''
  try {
    await assignAgent(agentTarget.value.id, { agentId: values.agentId, commissionRate: values.commissionRate || undefined })
    showAgent.value = false
    toast.add({ title: 'Agent assigned', color: 'success' })
    await load()
  } catch (err) {
    agentError.value = apiErrorMessage(err)
  } finally {
    agentLoading.value = false
  }
}

// Mark commission paid
const commissionTarget = ref<SaleAgreement | null>(null)
const commissionLoading = ref(false)
function openCommissionWith(row: SaleAgreement) {
  commissionTarget.value = row
}
async function onCommissionConfirm() {
  if (!commissionTarget.value) return
  commissionLoading.value = true
  try {
    await markCommissionPaid(commissionTarget.value.id)
    toast.add({ title: 'Commission marked as paid', color: 'success' })
    commissionTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not mark commission paid', description: apiErrorMessage(err), color: 'error' })
  } finally {
    commissionLoading.value = false
  }
}

// Cancel
const {
  open: showCancel,
  target: cancelTarget,
  loading: cancelLoading,
  error: cancelError,
  openWith: openCancelWith
} = useTargetModal<SaleAgreement>()
const cancelForm = ref<Record<string, any>>({})
const cancelFields: FieldDef[] = [{ name: 'reason', type: 'textarea' }]
watch(showCancel, (value) => {
  if (value) cancelForm.value = {}
})
async function onCancelSubmit(values: Record<string, any>) {
  if (!cancelTarget.value) return
  cancelLoading.value = true
  cancelError.value = ''
  try {
    await cancel(cancelTarget.value.id, values.reason || undefined)
    showCancel.value = false
    toast.add({ title: 'Sale agreement cancelled', color: 'success' })
    await load()
  } catch (err) {
    cancelError.value = apiErrorMessage(err)
  } finally {
    cancelLoading.value = false
  }
}

// ── Manage modal ───────────────────────────────────────────────────────
const {
  open: showManage,
  target: manageTarget,
  openWith: openManageWith
} = useTargetModal<SaleAgreement>()

// Payment plan + schedule
const paymentPlan = ref<PaymentPlan | null>(null)
const schedule = ref<Installment[]>([])
const planLoading = ref(false)
const planForm = ref<Record<string, any>>({})
const planSaving = ref(false)
const planError = ref('')
const planFields: FieldDef[] = [
  { name: 'downPaymentAmount', label: 'Down payment amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'installmentCount', label: 'Installment count', type: 'number', required: true, min: 1, wrapper: 'half' },
  { name: 'installmentFrequency', label: 'Frequency', type: 'select', required: true, options: BILLING_CYCLE_OPTIONS, wrapper: 'half' },
  { name: 'firstInstallmentDate', label: 'First installment date', type: 'date', required: true, wrapper: 'half' }
]
const generatingSchedule = ref(false)

async function onCreatePlan(values: Record<string, any>) {
  if (!manageTarget.value) return
  planSaving.value = true
  planError.value = ''
  try {
    paymentPlan.value = await createPlan(manageTarget.value.id, {
      downPaymentAmount: values.downPaymentAmount,
      installmentCount: values.installmentCount,
      installmentFrequency: values.installmentFrequency,
      firstInstallmentDate: values.firstInstallmentDate
    })
    toast.add({ title: 'Payment plan created', color: 'success' })
  } catch (err) {
    planError.value = apiErrorMessage(err)
  } finally {
    planSaving.value = false
  }
}
async function onGenerateSchedule() {
  if (!manageTarget.value) return
  generatingSchedule.value = true
  try {
    schedule.value = await generateSchedule(manageTarget.value.id)
    if (paymentPlan.value) paymentPlan.value.scheduleGenerated = true
    toast.add({ title: 'Installment schedule generated', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not generate schedule', description: apiErrorMessage(err), color: 'error' })
  } finally {
    generatingSchedule.value = false
  }
}

// Record an installment payment
const {
  open: showRecordPayment,
  target: recordPaymentTarget,
  loading: recordPaymentLoading,
  error: recordPaymentError,
  openWith: openRecordPaymentWithRaw
} = useTargetModal<Installment>()
const recordPaymentForm = ref<Record<string, any>>({})
const recordPaymentFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
function openRecordPaymentWith(inst: Installment) {
  openRecordPaymentWithRaw(inst)
  recordPaymentForm.value = { amount: inst.balanceDue, paymentDate: new Date().toISOString().slice(0, 10) }
}
async function onRecordPaymentSubmit(values: Record<string, any>) {
  if (!recordPaymentTarget.value || !manageTarget.value) return
  recordPaymentLoading.value = true
  recordPaymentError.value = ''
  try {
    await createInstallmentPayment(recordPaymentTarget.value.id, {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method,
      referenceNumber: values.referenceNumber || undefined,
      notes: values.notes || undefined
    })
    showRecordPayment.value = false
    toast.add({ title: 'Installment payment recorded', color: 'success' })
    schedule.value = await getSchedule(manageTarget.value.id)
    payments.value = await listPayments(manageTarget.value.id)
  } catch (err) {
    recordPaymentError.value = apiErrorMessage(err)
  } finally {
    recordPaymentLoading.value = false
  }
}

// Agreement-level payments (down payment + other) + record-down-payment form
const payments = ref<SalePayment[]>([])
const paymentsLoading = ref(false)
const downPaymentForm = ref<Record<string, any>>({})
const downPaymentSaving = ref(false)
const downPaymentError = ref('')
const downPaymentFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
async function onRecordDownPayment(values: Record<string, any>) {
  if (!manageTarget.value) return
  downPaymentSaving.value = true
  downPaymentError.value = ''
  try {
    await recordDownPayment(manageTarget.value.id, {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method,
      referenceNumber: values.referenceNumber || undefined,
      notes: values.notes || undefined
    })
    payments.value = await listPayments(manageTarget.value.id)
    downPaymentForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Down payment recorded', color: 'success' })
  } catch (err) {
    downPaymentError.value = apiErrorMessage(err)
  } finally {
    downPaymentSaving.value = false
  }
}

// Documents
const documents = ref<SaleAgreementDocument[]>([])
const documentsLoading = ref(false)
const docSelectedFile = ref<File | null>(null)
const docDescription = ref('')
const docUploading = ref(false)
const docUploadError = ref('')
const docFileInput = ref<HTMLInputElement | null>(null)
function onDocFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  docSelectedFile.value = target.files?.[0] ?? null
}
async function onUploadDocument() {
  if (!manageTarget.value || !docSelectedFile.value) return
  docUploading.value = true
  docUploadError.value = ''
  try {
    await uploadDoc(manageTarget.value.id, docSelectedFile.value, docDescription.value || undefined)
    docSelectedFile.value = null
    docDescription.value = ''
    if (docFileInput.value) docFileInput.value.value = ''
    documents.value = await listDocs(manageTarget.value.id)
    toast.add({ title: 'Document uploaded', color: 'success' })
  } catch (err) {
    docUploadError.value = apiErrorMessage(err)
  } finally {
    docUploading.value = false
  }
}
async function onDeleteDocument(doc: SaleAgreementDocument) {
  if (!manageTarget.value) return
  try {
    await removeDoc(manageTarget.value.id, doc.id)
    documents.value = await listDocs(manageTarget.value.id)
    toast.add({ title: 'Document deleted', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}
async function onDownloadDocument(doc: SaleAgreementDocument) {
  if (!manageTarget.value) return
  try {
    await downloadDoc(manageTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

// Handover
const handover = ref<SaleHandover | null>(null)
const handoverLoading = ref(false)
const handoverForm = ref<Record<string, any>>({})
const handoverSaving = ref(false)
const handoverError = ref('')
const handoverFields: FieldDef[] = [
  { name: 'handoverDate', label: 'Handover date', type: 'date', required: true, wrapper: 'half' },
  { name: 'condition', type: 'select', required: true, options: CONDITION_OPTIONS, wrapper: 'half' },
  { name: 'handedOverBy', label: 'Handed over by', required: true, wrapper: 'full' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
async function onCreateHandover(values: Record<string, any>) {
  if (!manageTarget.value) return
  handoverSaving.value = true
  handoverError.value = ''
  try {
    handover.value = await createHandover(manageTarget.value.id, {
      handoverDate: values.handoverDate,
      handedOverBy: values.handedOverBy,
      condition: values.condition,
      notes: values.notes || undefined
    })
    toast.add({ title: 'Handover recorded', color: 'success' })
  } catch (err) {
    handoverError.value = apiErrorMessage(err)
  } finally {
    handoverSaving.value = false
  }
}

// Refund
const refund = ref<SaleRefund | null>(null)
const refundLoading = ref(false)
const refundForm = ref<Record<string, any>>({})
const refundSaving = ref(false)
const refundError = ref('')
const refundProcessing = ref(false)
const refundFields: FieldDef[] = [
  { name: 'deductions', type: 'currency', wrapper: 'half', hint: 'Amount withheld from the refund, if any.' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
async function onCreateRefund(values: Record<string, any>) {
  if (!manageTarget.value) return
  refundSaving.value = true
  refundError.value = ''
  try {
    refund.value = await createRefund(manageTarget.value.id, { deductions: values.deductions || undefined, notes: values.notes || undefined })
    toast.add({ title: 'Refund calculated', color: 'success' })
  } catch (err) {
    refundError.value = apiErrorMessage(err)
  } finally {
    refundSaving.value = false
  }
}
async function onProcessRefund() {
  if (!manageTarget.value) return
  refundProcessing.value = true
  try {
    refund.value = await processRefund(manageTarget.value.id)
    toast.add({ title: 'Refund processed', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not process refund', description: apiErrorMessage(err), color: 'error' })
  } finally {
    refundProcessing.value = false
  }
}

// Ownership transfer
const transfer = ref<OwnershipTransfer | null>(null)
const transferLoading = ref(false)
const transferForm = ref<Record<string, any>>({})
const transferSaving = ref(false)
const transferError = ref('')
const transferFields: FieldDef[] = [
  { name: 'transferDate', label: 'Transfer date', type: 'date', required: true, wrapper: 'half' },
  { name: 'registeredBy', label: 'Registered by', required: true, wrapper: 'half' },
  { name: 'documentReference', label: 'Document reference', hint: 'e.g. deed/title registration number.' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
async function onCreateTransfer(values: Record<string, any>) {
  if (!manageTarget.value) return
  transferSaving.value = true
  transferError.value = ''
  try {
    transfer.value = await createTransfer(manageTarget.value.id, {
      transferDate: values.transferDate,
      registeredBy: values.registeredBy,
      documentReference: values.documentReference || undefined,
      notes: values.notes || undefined
    })
    toast.add({ title: 'Ownership transferred', color: 'success' })
  } catch (err) {
    transferError.value = apiErrorMessage(err)
  } finally {
    transferSaving.value = false
  }
}

// History
const historyEntries = ref<SaleHistoryEntry[]>([])
const historyLoading = ref(false)

function is404(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status === 404
}

watch(showManage, async (value) => {
  if (!value || !manageTarget.value) return
  const id = manageTarget.value.id

  paymentPlan.value = null
  schedule.value = []
  planForm.value = {}
  planError.value = ''
  planLoading.value = true
  handover.value = null
  handoverForm.value = {}
  handoverError.value = ''
  handoverLoading.value = true
  refund.value = null
  refundForm.value = {}
  refundError.value = ''
  refundLoading.value = true
  transfer.value = null
  transferForm.value = {}
  transferError.value = ''
  transferLoading.value = true
  documents.value = []
  documentsLoading.value = true
  docSelectedFile.value = null
  docDescription.value = ''
  docUploadError.value = ''
  payments.value = []
  paymentsLoading.value = true
  downPaymentForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
  downPaymentError.value = ''
  historyEntries.value = []
  historyLoading.value = true

  await Promise.all([
    (async () => {
      try {
        paymentPlan.value = await getPlan(id)
        if (paymentPlan.value.scheduleGenerated) {
          schedule.value = await getSchedule(id)
        }
      } catch (err) {
        if (!is404(err)) planError.value = apiErrorMessage(err)
      } finally {
        planLoading.value = false
      }
    })(),
    (async () => {
      try {
        payments.value = await listPayments(id)
      } catch (err) {
        toast.add({ title: 'Could not load payments', description: apiErrorMessage(err), color: 'error' })
      } finally {
        paymentsLoading.value = false
      }
    })(),
    (async () => {
      try {
        documents.value = await listDocs(id)
      } catch (err) {
        toast.add({ title: 'Could not load documents', description: apiErrorMessage(err), color: 'error' })
      } finally {
        documentsLoading.value = false
      }
    })(),
    (async () => {
      try {
        handover.value = await getHandover(id)
      } catch (err) {
        if (!is404(err)) handoverError.value = apiErrorMessage(err)
      } finally {
        handoverLoading.value = false
      }
    })(),
    (async () => {
      try {
        refund.value = await getRefund(id)
      } catch (err) {
        if (!is404(err)) refundError.value = apiErrorMessage(err)
      } finally {
        refundLoading.value = false
      }
    })(),
    (async () => {
      try {
        transfer.value = await getTransfer(id)
      } catch (err) {
        if (!is404(err)) transferError.value = apiErrorMessage(err)
      } finally {
        transferLoading.value = false
      }
    })(),
    (async () => {
      try {
        historyEntries.value = await history(id)
      } catch (err) {
        toast.add({ title: 'Could not load history', description: apiErrorMessage(err), color: 'error' })
      } finally {
        historyLoading.value = false
      }
    })()
  ])
})

watch(sort, load)
watch(() => [filter.unitId, filter.buyerId, filter.status], load)

const hasActiveFilter = computed(
  () => filter.unitId !== undefined || filter.buyerId !== undefined || filter.status !== undefined
)
function clearFilters() {
  filter.unitId = undefined
  filter.buyerId = undefined
  filter.status = undefined
  load()
}
</script>

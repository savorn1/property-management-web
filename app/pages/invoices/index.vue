<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">Generate invoice</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.leaseId" :items="leaseFilterOptions" placeholder="Lease" class="w-56" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-40" />
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
        v-model:selected="selected"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        :selectable="isAdmin"
        refreshable
        numbered
        exportable
        export-filename="invoices"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template v-if="isAdmin" #bulk-actions="{ selected: sel, clear }">
          <UButton
            v-if="eligibleForLateFee(sel).length > 0"
            size="xs"
            color="warning"
            variant="soft"
            icon="i-lucide-alarm-clock"
            @click="openBulkLateFee(sel, clear)"
          >
            Apply late fee ({{ eligibleForLateFee(sel).length }})
          </UButton>
          <UButton
            v-if="eligibleForCancel(sel).length > 0"
            size="xs"
            color="error"
            variant="soft"
            icon="i-lucide-ban"
            @click="openBulkCancel(sel, clear)"
          >
            Cancel ({{ eligibleForCancel(sel).length }})
          </UButton>
        </template>
        <template #actions-data="{ row }">
          <RowActions :actions="invoiceActions(row)" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No invoices match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-receipt" title="No invoices yet" description="Generate the first invoice for a lease to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">Generate invoice</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="Generate invoice">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="createFields"
          :loading="creating"
          :error="createError"
          submit-label="Generate"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="cancelTarget !== null"
      title="Cancel invoice"
      :description="`Cancel the invoice for '${cancelTarget?.tenantName ?? ''}' on unit '${cancelTarget?.unitNumber ?? ''}'? This cannot be undone.`"
      confirm-label="Cancel invoice"
      color="error"
      :loading="cancelling"
      @update:model-value="(v: boolean) => { if (!v) cancelTarget = null }"
      @confirm="onCancelConfirm"
    />

    <ConfirmModal
      :model-value="lateFeeTarget !== null"
      title="Apply late fee"
      :description="`Apply the configured late fee to the overdue invoice for '${lateFeeTarget?.tenantName ?? ''}' on unit '${lateFeeTarget?.unitNumber ?? ''}'?`"
      confirm-label="Apply late fee"
      color="warning"
      :loading="applyingLateFee"
      @update:model-value="(v: boolean) => { if (!v) lateFeeTarget = null }"
      @confirm="onLateFeeConfirm"
    />

    <ConfirmModal
      :model-value="bulkLateFeeTargets.length > 0"
      title="Apply late fee"
      :description="`Apply the configured late fee to ${bulkLateFeeTargets.length} overdue invoice${bulkLateFeeTargets.length === 1 ? '' : 's'}?`"
      confirm-label="Apply late fee"
      color="warning"
      :loading="bulkApplyingLateFee"
      @update:model-value="(v: boolean) => { if (!v) { bulkLateFeeTargets = []; bulkLateFeeClear = null } }"
      @confirm="onBulkLateFeeConfirm"
    />

    <ConfirmModal
      :model-value="bulkCancelTargets.length > 0"
      title="Cancel invoices"
      :description="`Cancel ${bulkCancelTargets.length} invoice${bulkCancelTargets.length === 1 ? '' : 's'}? This cannot be undone.`"
      confirm-label="Cancel invoices"
      color="error"
      :loading="bulkCancelling"
      @update:model-value="(v: boolean) => { if (!v) { bulkCancelTargets = []; bulkCancelClear = null } }"
      @confirm="onBulkCancelConfirm"
    />

    <UModal v-model:open="showRecordPayment" :title="`Record payment · ${recordPaymentTarget?.tenantName ?? ''} — Unit ${recordPaymentTarget?.unitNumber ?? ''}`">
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

    <UModal
      v-model:open="showDetails"
      :title="`Invoice · ${detailsTarget?.tenantName ?? ''} — Unit ${detailsTarget?.unitNumber ?? ''}`"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Payments
            </h3>
            <div v-if="detailsPaymentsLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="detailsPayments.length === 0" class="text-sm text-gray-400">
              No payments recorded yet.
            </div>
            <div v-else class="space-y-1.5">
              <div
                v-for="p in detailsPayments"
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
          </div>

          <template v-if="isAdmin">
            <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Credit notes
              </h3>
              <div v-if="detailsCreditNotesLoading" class="text-sm text-gray-400">Loading…</div>
              <div v-else-if="detailsCreditNotes.length === 0" class="text-sm text-gray-400 mb-3">
                No credit notes issued yet.
              </div>
              <div v-else class="space-y-1.5 mb-4">
                <div
                  v-for="n in detailsCreditNotes"
                  :key="n.id"
                  class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
                >
                  <span class="text-gray-600 dark:text-gray-300">
                    {{ formatDate(n.noteDate) }}
                    <span v-if="n.reason" class="text-gray-400">({{ n.reason }})</span>
                  </span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(n.amount) }}</span>
                </div>
              </div>
              <DynamicForm
                v-model="creditNoteForm"
                :fields="creditNoteFields"
                :loading="creditNoteSaving"
                :error="creditNoteError"
                submit-label="Issue credit note"
                @submit="onAddCreditNote"
              />
            </div>

            <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Debit notes
              </h3>
              <div v-if="detailsDebitNotesLoading" class="text-sm text-gray-400">Loading…</div>
              <div v-else-if="detailsDebitNotes.length === 0" class="text-sm text-gray-400 mb-3">
                No debit notes issued yet.
              </div>
              <div v-else class="space-y-1.5 mb-4">
                <div
                  v-for="n in detailsDebitNotes"
                  :key="n.id"
                  class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
                >
                  <span class="text-gray-600 dark:text-gray-300">
                    {{ formatDate(n.noteDate) }}
                    <span v-if="n.reason" class="text-gray-400">({{ n.reason }})</span>
                  </span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(n.amount) }}</span>
                </div>
              </div>
              <DynamicForm
                v-model="debitNoteForm"
                :fields="debitNoteFields"
                :loading="debitNoteSaving"
                :error="debitNoteError"
                submit-label="Issue debit note"
                @submit="onAddDebitNote"
              />
            </div>

            <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
              <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Refunds
              </h3>
              <div v-if="detailsRefundsLoading" class="text-sm text-gray-400">Loading…</div>
              <div v-else-if="detailsRefunds.length === 0" class="text-sm text-gray-400 mb-3">
                No refunds on this invoice yet.
              </div>
              <div v-else class="space-y-1.5 mb-4">
                <div
                  v-for="r in detailsRefunds"
                  :key="r.id"
                  class="flex items-center justify-between gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
                >
                  <span class="text-gray-600 dark:text-gray-300">
                    {{ formatDate(r.refundDate) }} · {{ formatEnum(r.method) }}
                    <span v-if="r.referenceNumber" class="text-gray-400">({{ r.referenceNumber }})</span>
                  </span>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(r.amount) }}</span>
                    <StatusBadge :status="r.status" />
                    <UButton
                      v-if="r.status === 'PENDING'"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      :loading="processingRefundId === r.id"
                      @click="onProcessRefund(r)"
                    >
                      Process
                    </UButton>
                  </div>
                </div>
              </div>
              <DynamicForm
                v-model="refundForm"
                :fields="refundFields"
                :loading="refundSaving"
                :error="refundError"
                submit-label="Create refund"
                @submit="onAddRefund"
              />
            </div>
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type { CreateInvoicePayload, CreatePaymentPayload, Invoice, InvoiceStatus } from '~/composables/useInvoices'
import type { Payment } from '#shared/domain'
import type { CreateCreditNotePayload, CreditNote } from '~/composables/useCreditNotes'
import type { CreateDebitNotePayload, DebitNote } from '~/composables/useDebitNotes'
import type { CreateRefundPayload, Refund } from '~/composables/useRefunds'

const { isAdmin } = useAuth()
const { list, create, cancel, applyLateFee, listPayments, createPayment } = useInvoices()
const { downloadInvoicePdf } = useDocumentPdf()
const { list: listLeases } = useLeases()
const { list: listCreditNotes, create: createCreditNote } = useCreditNotes()
const { list: listDebitNotes, create: createDebitNote } = useDebitNotes()
const { list: listRefunds, create: createRefund, process: processRefund } = useRefunds()
const toast = useToast()

const rows = ref<Invoice[]>([])
const loading = ref(false)
const error = ref('')
const selected = ref<Invoice[]>([])

const filter = reactive<{ leaseId: number | undefined; status: InvoiceStatus | undefined }>({
  leaseId: undefined,
  status: undefined
})

const leaseOptions = ref<{ label: string; value: number }[]>([])
const leaseFilterOptions = computed(() => [{ label: 'All leases', value: undefined }, ...leaseOptions.value])

const STATUS_OPTIONS: { label: string; value: InvoiceStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Partially paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Cancelled', value: 'CANCELLED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

// Same list/labels as leases' deposit-payment form.
const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]

async function loadOptions() {
  const res = await listLeases({ size: 200 })
  leaseOptions.value = res.data.map((l) => ({ label: `${l.tenantName ?? 'Tenant'} — Unit ${l.unitNumber ?? '?'}`, value: l.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Invoice>[] = [
  { key: 'tenantName', label: 'Tenant', value: (row) => row.tenantName ?? '—' },
  { key: 'unitNumber', label: 'Unit', value: (row) => row.unitNumber ?? '—' },
  { key: 'billingPeriodStart', label: 'Period start', type: 'date' },
  { key: 'billingPeriodEnd', label: 'Period end', type: 'date' },
  { key: 'dueDate', label: 'Due date', type: 'date' },
  { key: 'totalAmount', label: 'Total', type: 'currency' },
  { key: 'balanceDue', label: 'Balance due', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'overdue', label: 'Overdue', type: 'boolean', trueLabel: 'Overdue', trueColor: 'error', falseLabel: '' },
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
  { name: 'billingPeriodStart', label: 'Billing period start', type: 'date', required: true, wrapper: 'half' },
  {
    name: 'billingPeriodEnd',
    label: 'Billing period end',
    type: 'date',
    wrapper: 'half',
    hint: 'Leave blank to compute from the lease billing cycle.'
  },
  { name: 'dueDate', label: 'Due date', type: 'date', wrapper: 'half', hint: 'Leave blank to compute from the lease rent configuration.' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

// No useCrudModals here — invoices have no update/delete endpoints, only
// generate plus the cancel/apply-late-fee/record-payment actions below.
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
  const payload: CreateInvoicePayload = {
    leaseId: values.leaseId,
    billingPeriodStart: values.billingPeriodStart,
    billingPeriodEnd: values.billingPeriodEnd || undefined,
    dueDate: values.dueDate || undefined,
    notes: values.notes || undefined
  }
  try {
    await create(payload)
    toast.add({ title: 'Invoice generated', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Cancel — a plain confirm, no extra payload.
const cancelTarget = ref<Invoice | null>(null)
const cancelling = ref(false)
function openCancelWith(row: Invoice) {
  cancelTarget.value = row
}
async function onCancelConfirm() {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await cancel(cancelTarget.value.id)
    toast.add({ title: 'Invoice cancelled', color: 'success' })
    cancelTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not cancel invoice', description: apiErrorMessage(err), color: 'error' })
  } finally {
    cancelling.value = false
  }
}

// Apply late fee — a plain confirm, no extra payload.
const lateFeeTarget = ref<Invoice | null>(null)
const applyingLateFee = ref(false)
function openLateFeeWith(row: Invoice) {
  lateFeeTarget.value = row
}
async function onLateFeeConfirm() {
  if (!lateFeeTarget.value) return
  applyingLateFee.value = true
  try {
    await applyLateFee(lateFeeTarget.value.id)
    toast.add({ title: 'Late fee applied', color: 'success' })
    lateFeeTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not apply late fee', description: apiErrorMessage(err), color: 'error' })
  } finally {
    applyingLateFee.value = false
  }
}

// Record payment
const {
  open: showRecordPayment,
  target: recordPaymentTarget,
  loading: recordPaymentLoading,
  error: recordPaymentError,
  openWith: openRecordPaymentWith
} = useTargetModal<Invoice>()
const recordPaymentForm = ref<Record<string, any>>({})
const recordPaymentFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
watch(showRecordPayment, (value) => {
  if (value) recordPaymentForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
})
async function onRecordPaymentSubmit(values: Record<string, any>) {
  if (!recordPaymentTarget.value) return
  recordPaymentLoading.value = true
  recordPaymentError.value = ''
  const payload: CreatePaymentPayload = {
    amount: values.amount,
    paymentDate: values.paymentDate,
    method: values.method,
    referenceNumber: values.referenceNumber || undefined,
    notes: values.notes || undefined
  }
  try {
    await createPayment(recordPaymentTarget.value.id, payload)
    showRecordPayment.value = false
    toast.add({ title: 'Payment recorded', color: 'success' })
    await load()
  } catch (err) {
    recordPaymentError.value = apiErrorMessage(err)
  } finally {
    recordPaymentLoading.value = false
  }
}

// Download PDF — fetches this invoice's payments fresh (not reusing the
// Details modal's cache, since that may never have been opened) and lays
// them out as a single printable document, separate from DataTable's own
// bulk row export.
const downloadingPdfId = ref<number | null>(null)
async function onDownloadPdf(row: Invoice) {
  downloadingPdfId.value = row.id
  try {
    const payments = await listPayments(row.id)
    await downloadInvoicePdf(row, payments)
  } catch (err) {
    toast.add({ title: 'Could not generate PDF', description: apiErrorMessage(err), color: 'error' })
  } finally {
    downloadingPdfId.value = null
  }
}

// Details — payments (any user) plus credit notes / debit notes / refunds
// (admin only), all scoped to one invoice. Mirrors leases' Manage modal.
const { open: showDetails, target: detailsTarget, openWith: openDetailsWith } = useTargetModal<Invoice>()

const detailsPayments = ref<Payment[]>([])
const detailsPaymentsLoading = ref(false)

const detailsCreditNotes = ref<CreditNote[]>([])
const detailsCreditNotesLoading = ref(false)
const creditNoteForm = ref<Record<string, any>>({})
const creditNoteSaving = ref(false)
const creditNoteError = ref('')
const creditNoteFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'noteDate', label: 'Note date', type: 'date', required: true, wrapper: 'half' },
  { name: 'reason', type: 'textarea', wrapper: 'full' }
]

const detailsDebitNotes = ref<DebitNote[]>([])
const detailsDebitNotesLoading = ref(false)
const debitNoteForm = ref<Record<string, any>>({})
const debitNoteSaving = ref(false)
const debitNoteError = ref('')
const debitNoteFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'noteDate', label: 'Note date', type: 'date', required: true, wrapper: 'half' },
  { name: 'reason', type: 'textarea', wrapper: 'full' }
]

const detailsRefunds = ref<Refund[]>([])
const detailsRefundsLoading = ref(false)
const refundForm = ref<Record<string, any>>({})
const refundSaving = ref(false)
const refundError = ref('')
const refundFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'refundDate', label: 'Refund date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'reason', type: 'textarea', wrapper: 'full' }
]
const processingRefundId = ref<number | null>(null)

watch(showDetails, async (value) => {
  if (!value || !detailsTarget.value) return
  const invoiceId = detailsTarget.value.id

  detailsPaymentsLoading.value = true
  try {
    detailsPayments.value = await listPayments(invoiceId)
  } catch (err) {
    toast.add({ title: 'Could not load payments', description: apiErrorMessage(err), color: 'error' })
  } finally {
    detailsPaymentsLoading.value = false
  }

  if (!isAdmin.value) return

  const today = new Date().toISOString().slice(0, 10)

  creditNoteForm.value = { noteDate: today }
  creditNoteError.value = ''
  detailsCreditNotesLoading.value = true
  try {
    detailsCreditNotes.value = await listCreditNotes(invoiceId)
  } catch (err) {
    creditNoteError.value = apiErrorMessage(err)
  } finally {
    detailsCreditNotesLoading.value = false
  }

  debitNoteForm.value = { noteDate: today }
  debitNoteError.value = ''
  detailsDebitNotesLoading.value = true
  try {
    detailsDebitNotes.value = await listDebitNotes(invoiceId)
  } catch (err) {
    debitNoteError.value = apiErrorMessage(err)
  } finally {
    detailsDebitNotesLoading.value = false
  }

  refundForm.value = { refundDate: today }
  refundError.value = ''
  detailsRefundsLoading.value = true
  try {
    detailsRefunds.value = await listRefunds(invoiceId)
  } catch (err) {
    refundError.value = apiErrorMessage(err)
  } finally {
    detailsRefundsLoading.value = false
  }
})

async function onAddCreditNote(values: Record<string, any>) {
  if (!detailsTarget.value) return
  creditNoteSaving.value = true
  creditNoteError.value = ''
  const payload: CreateCreditNotePayload = {
    amount: values.amount,
    noteDate: values.noteDate,
    reason: values.reason || undefined
  }
  try {
    await createCreditNote(detailsTarget.value.id, payload)
    detailsCreditNotes.value = await listCreditNotes(detailsTarget.value.id)
    creditNoteForm.value = { noteDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Credit note issued', color: 'success' })
    await load()
  } catch (err) {
    creditNoteError.value = apiErrorMessage(err)
  } finally {
    creditNoteSaving.value = false
  }
}

async function onAddDebitNote(values: Record<string, any>) {
  if (!detailsTarget.value) return
  debitNoteSaving.value = true
  debitNoteError.value = ''
  const payload: CreateDebitNotePayload = {
    amount: values.amount,
    noteDate: values.noteDate,
    reason: values.reason || undefined
  }
  try {
    await createDebitNote(detailsTarget.value.id, payload)
    detailsDebitNotes.value = await listDebitNotes(detailsTarget.value.id)
    debitNoteForm.value = { noteDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Debit note issued', color: 'success' })
    await load()
  } catch (err) {
    debitNoteError.value = apiErrorMessage(err)
  } finally {
    debitNoteSaving.value = false
  }
}

async function onAddRefund(values: Record<string, any>) {
  if (!detailsTarget.value) return
  refundSaving.value = true
  refundError.value = ''
  const payload: CreateRefundPayload = {
    amount: values.amount,
    refundDate: values.refundDate,
    method: values.method,
    referenceNumber: values.referenceNumber || undefined,
    reason: values.reason || undefined
  }
  try {
    await createRefund(detailsTarget.value.id, payload)
    detailsRefunds.value = await listRefunds(detailsTarget.value.id)
    refundForm.value = { refundDate: new Date().toISOString().slice(0, 10) }
    toast.add({ title: 'Refund created', color: 'success' })
  } catch (err) {
    refundError.value = apiErrorMessage(err)
  } finally {
    refundSaving.value = false
  }
}

async function onProcessRefund(refund: Refund) {
  processingRefundId.value = refund.id
  try {
    await processRefund(refund.id)
    if (detailsTarget.value) detailsRefunds.value = await listRefunds(detailsTarget.value.id)
    toast.add({ title: 'Refund processed', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not process refund', description: apiErrorMessage(err), color: 'error' })
  } finally {
    processingRefundId.value = null
  }
}

// Bulk apply-late-fee / cancel — same single-item endpoints as the per-row
// actions, looped over the eligible subset of the selection (no dedicated
// bulk endpoint exists). "Eligible" mirrors each per-row button's own v-if.
function eligibleForLateFee(list: Invoice[]) {
  return list.filter((i) => (i.status === 'PENDING' || i.status === 'PARTIALLY_PAID') && i.overdue)
}
function eligibleForCancel(list: Invoice[]) {
  return list.filter((i) => i.status !== 'CANCELLED' && i.status !== 'PAID')
}

const bulkLateFeeTargets = ref<Invoice[]>([])
const bulkLateFeeClear = ref<(() => void) | null>(null)
const bulkApplyingLateFee = ref(false)
function openBulkLateFee(sel: Invoice[], clear: () => void) {
  const targets = eligibleForLateFee(sel)
  if (targets.length === 0) return
  bulkLateFeeTargets.value = targets
  bulkLateFeeClear.value = clear
}
async function onBulkLateFeeConfirm() {
  const targets = bulkLateFeeTargets.value
  bulkApplyingLateFee.value = true
  const results = await Promise.allSettled(targets.map((i) => applyLateFee(i.id)))
  const failed = results.filter((r) => r.status === 'rejected').length
  bulkApplyingLateFee.value = false
  bulkLateFeeTargets.value = []
  bulkLateFeeClear.value?.()
  bulkLateFeeClear.value = null
  toast.add({
    title:
      failed === 0
        ? `Applied late fee to ${targets.length} invoice${targets.length === 1 ? '' : 's'}`
        : `Applied late fee to ${targets.length - failed} of ${targets.length} invoices`,
    description: failed > 0 ? `${failed} failed` : undefined,
    color: failed === 0 ? 'success' : 'warning'
  })
  await load()
}

const bulkCancelTargets = ref<Invoice[]>([])
const bulkCancelClear = ref<(() => void) | null>(null)
const bulkCancelling = ref(false)
function openBulkCancel(sel: Invoice[], clear: () => void) {
  const targets = eligibleForCancel(sel)
  if (targets.length === 0) return
  bulkCancelTargets.value = targets
  bulkCancelClear.value = clear
}
async function onBulkCancelConfirm() {
  const targets = bulkCancelTargets.value
  bulkCancelling.value = true
  const results = await Promise.allSettled(targets.map((i) => cancel(i.id)))
  const failed = results.filter((r) => r.status === 'rejected').length
  bulkCancelling.value = false
  bulkCancelTargets.value = []
  bulkCancelClear.value?.()
  bulkCancelClear.value = null
  toast.add({
    title:
      failed === 0
        ? `Cancelled ${targets.length} invoice${targets.length === 1 ? '' : 's'}`
        : `Cancelled ${targets.length - failed} of ${targets.length} invoices`,
    description: failed > 0 ? `${failed} failed` : undefined,
    color: failed === 0 ? 'success' : 'warning'
  })
  await load()
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.leaseId, filter.status], () => {
  selected.value = []
  load()
})

const hasActiveFilter = computed(() => filter.leaseId !== undefined || filter.status !== undefined)

function clearFilters() {
  filter.leaseId = undefined
  filter.status = undefined
  selected.value = []
  load()
}

function invoiceActions(row: Invoice): RowAction[] {
  const actions: RowAction[] = [
    { label: 'Details', icon: 'i-lucide-eye', onClick: () => openDetailsWith(row) },
    { label: 'PDF', icon: 'i-lucide-file-down', loading: downloadingPdfId.value === row.id, onClick: () => onDownloadPdf(row) }
  ]
  if (isAdmin.value) {
    if (row.status !== 'CANCELLED' && row.status !== 'PAID') {
      actions.push({ label: 'Record payment', icon: 'i-lucide-hand-coins', color: 'primary', onClick: () => openRecordPaymentWith(row) })
    }
    if ((row.status === 'PENDING' || row.status === 'PARTIALLY_PAID') && row.overdue) {
      actions.push({ label: 'Apply late fee', icon: 'i-lucide-alarm-clock', color: 'warning', onClick: () => openLateFeeWith(row) })
    }
    if (row.status !== 'CANCELLED' && row.status !== 'PAID') {
      actions.push({ label: 'Cancel', icon: 'i-lucide-ban', color: 'error', onClick: () => openCancelWith(row) })
    }
  }
  return actions
}
</script>

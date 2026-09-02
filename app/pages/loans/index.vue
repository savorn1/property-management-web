<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Loans</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New loan</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.propertyId" :items="propertyFilterOptions" placeholder="Property" class="w-56" />
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
        export-filename="loans"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-settings-2" @click.stop="openManageWith(row)">
            Manage
          </UButton>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No loans match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-landmark" title="No loans yet" description="Record the first loan to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New loan</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New loan">
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

    <UModal
      v-model:open="showManage"
      :title="`Manage loan · ${manageTarget?.lender ?? ''}${manageTarget?.loanNumber ? ` — ${manageTarget.loanNumber}` : ''}`"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <div v-if="scheduleLoading" class="text-sm text-gray-400">Loading schedule…</div>

          <div v-else-if="!scheduleGenerated">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              No amortization schedule yet for this loan.
            </p>
            <UButton
              icon="i-lucide-calendar-plus"
              :loading="generatingSchedule"
              @click="onGenerateSchedule"
            >
              Generate schedule
            </UButton>
            <UAlert v-if="scheduleError" color="error" variant="subtle" class="mt-3" :title="scheduleError" />
          </div>

          <div v-else>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Amortization schedule
            </h3>
            <div class="overflow-x-auto -mx-1">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th class="px-1 py-1.5 font-medium">#</th>
                    <th class="px-1 py-1.5 font-medium">Due date</th>
                    <th class="px-1 py-1.5 font-medium text-right">Principal</th>
                    <th class="px-1 py-1.5 font-medium text-right">Interest</th>
                    <th class="px-1 py-1.5 font-medium text-right">Total</th>
                    <th class="px-1 py-1.5 font-medium text-right">Balance due</th>
                    <th class="px-1 py-1.5 font-medium">Status</th>
                    <th class="px-1 py-1.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="inst in installments"
                    :key="inst.id"
                    class="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td class="px-1 py-1.5 text-gray-500 dark:text-gray-400">{{ inst.installmentNumber }}</td>
                    <td class="px-1 py-1.5">{{ formatDate(inst.dueDate) }}</td>
                    <td class="px-1 py-1.5 text-right">{{ formatCurrency(inst.principalAmount) }}</td>
                    <td class="px-1 py-1.5 text-right">{{ formatCurrency(inst.interestAmount) }}</td>
                    <td class="px-1 py-1.5 text-right font-medium">{{ formatCurrency(inst.totalAmount) }}</td>
                    <td class="px-1 py-1.5 text-right">{{ formatCurrency(inst.balanceDue) }}</td>
                    <td class="px-1 py-1.5"><StatusBadge :status="inst.status" /></td>
                    <td class="px-1 py-1.5 text-right">
                      <UButton
                        v-if="inst.status !== 'PAID'"
                        size="xs"
                        color="neutral"
                        variant="soft"
                        icon="i-lucide-banknote"
                        @click="openPaymentFor(inst)"
                      >
                        Record payment
                      </UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="payingInstallment" class="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
              <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Record payment · installment #{{ payingInstallment.installmentNumber }}
              </h4>
              <DynamicForm
                v-model="paymentForm"
                :fields="paymentFields"
                :loading="paymentSaving"
                :error="paymentError"
                submit-label="Add payment"
                cancelable
                @submit="onAddPayment"
                @cancel="payingInstallment = null"
              />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { CreateLoanPayload, Loan, LoanInstallment, LoanStatus } from '~/composables/useLoans'

definePageMeta({ middleware: 'admin' })

const { list, create, getSchedule, generateSchedule } = useLoans()
const { createPayment } = useLoanInstallments()
const { list: listProperties } = useProperties()
const toast = useToast()

const rows = ref<Loan[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ propertyId: number | undefined; status: LoanStatus | undefined }>({
  propertyId: undefined,
  status: undefined
})

const propertyOptions = ref<{ label: string; value: number }[]>([])
const propertyFilterOptions = computed(() => [{ label: 'All properties', value: undefined }, ...propertyOptions.value])

const STATUS_OPTIONS: { label: string; value: LoanStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Closed', value: 'CLOSED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadOptions() {
  const res = await listProperties({ size: 200 })
  propertyOptions.value = res.data.map((p) => ({ label: p.name, value: p.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Loan>[] = [
  { key: 'lender' },
  { key: 'loanNumber', label: 'Loan #', value: (row) => row.loanNumber ?? '—' },
  { key: 'principalAmount', label: 'Principal', type: 'currency' },
  { key: 'interestRate', label: 'Rate', type: 'percent' },
  { key: 'termMonths', label: 'Term (months)' },
  { key: 'outstandingBalance', label: 'Outstanding', type: 'currency' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      propertyId: filter.propertyId,
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
  { name: 'propertyId', label: 'Property', type: 'select', options: propertyOptions.value, hint: 'Leave blank for a company-wide loan.', wrapper: 'half' },
  { name: 'lender', required: true, wrapper: 'half' },
  { name: 'loanNumber', label: 'Loan number', wrapper: 'half' },
  { name: 'principalAmount', label: 'Principal amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'interestRate', label: 'Interest rate', type: 'number', required: true, suffix: '%', step: 0.01, min: 0, wrapper: 'half' },
  { name: 'termMonths', label: 'Term (months)', type: 'number', required: true, min: 1, wrapper: 'half' },
  { name: 'startDate', label: 'Start date', type: 'date', required: true, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

// No useCrudModals here — loans have no update/delete, only create plus the
// nested schedule/payments managed below.
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref<Record<string, any>>({})

function openCreate() {
  createForm.value = {}
  createError.value = ''
  showCreate.value = true
}

async function onCreate(values: Record<string, any>) {
  creating.value = true
  createError.value = ''
  const payload: CreateLoanPayload = {
    propertyId: values.propertyId || undefined,
    lender: values.lender,
    loanNumber: values.loanNumber || undefined,
    principalAmount: values.principalAmount,
    interestRate: values.interestRate,
    termMonths: values.termMonths,
    startDate: values.startDate,
    notes: values.notes || undefined
  }
  try {
    await create(payload)
    toast.add({ title: 'Loan created', color: 'success' })
    showCreate.value = false
    await load()
  } catch (err) {
    createError.value = apiErrorMessage(err)
  } finally {
    creating.value = false
  }
}

// Manage — amortization schedule + per-installment payments.
const {
  open: showManage,
  target: manageTarget,
  openWith: openManageWith
} = useTargetModal<Loan>()

const scheduleLoading = ref(false)
const scheduleError = ref('')
const scheduleGenerated = ref(false)
const generatingSchedule = ref(false)
const installments = ref<LoanInstallment[]>([])

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]
const payingInstallment = ref<LoanInstallment | null>(null)
const paymentForm = ref<Record<string, any>>({})
const paymentSaving = ref(false)
const paymentError = ref('')
const paymentFields: FieldDef[] = [
  { name: 'amount', type: 'currency', required: true, wrapper: 'half' },
  { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, wrapper: 'half' },
  { name: 'method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { name: 'referenceNumber', label: 'Reference number' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

function openPaymentFor(inst: LoanInstallment) {
  payingInstallment.value = inst
  paymentError.value = ''
  paymentForm.value = { paymentDate: new Date().toISOString().slice(0, 10) }
}

async function loadSchedule(loanId: number) {
  scheduleError.value = ''
  scheduleLoading.value = true
  payingInstallment.value = null
  try {
    const schedule = await getSchedule(loanId)
    installments.value = schedule
    scheduleGenerated.value = schedule.length > 0
  } catch (err) {
    scheduleError.value = apiErrorMessage(err)
  } finally {
    scheduleLoading.value = false
  }
}

watch(showManage, async (value) => {
  if (!value || !manageTarget.value) return
  scheduleGenerated.value = manageTarget.value.scheduleGenerated
  installments.value = []
  await loadSchedule(manageTarget.value.id)
})

async function onGenerateSchedule() {
  if (!manageTarget.value) return
  generatingSchedule.value = true
  scheduleError.value = ''
  try {
    installments.value = await generateSchedule(manageTarget.value.id)
    scheduleGenerated.value = true
    toast.add({ title: 'Amortization schedule generated', color: 'success' })
    await load()
  } catch (err) {
    scheduleError.value = apiErrorMessage(err)
  } finally {
    generatingSchedule.value = false
  }
}

async function onAddPayment(values: Record<string, any>) {
  if (!payingInstallment.value || !manageTarget.value) return
  paymentSaving.value = true
  paymentError.value = ''
  try {
    await createPayment(payingInstallment.value.id, {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method,
      referenceNumber: values.referenceNumber || undefined,
      notes: values.notes || undefined
    })
    toast.add({ title: 'Loan payment recorded', color: 'success' })
    payingInstallment.value = null
    await loadSchedule(manageTarget.value.id)
    await load()
  } catch (err) {
    paymentError.value = apiErrorMessage(err)
  } finally {
    paymentSaving.value = false
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.propertyId, filter.status], load)

const hasActiveFilter = computed(() => filter.propertyId !== undefined || filter.status !== undefined)

function clearFilters() {
  filter.propertyId = undefined
  filter.status = undefined
  load()
}
</script>

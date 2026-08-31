<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model.number="filter.leaseId"
          type="number"
          placeholder="Lease ID"
          icon="i-lucide-file-signature"
          class="w-40"
          @keyup.enter="load"
        />
        <UInput
          v-model.number="filter.invoiceId"
          type="number"
          placeholder="Invoice ID"
          icon="i-lucide-receipt"
          class="w-40"
          @keyup.enter="load"
        />
        <USelect v-model="filter.type" :items="typeFilterOptions" placeholder="Type" class="w-44" />
        <USelect v-model="filter.method" :items="methodFilterOptions" placeholder="Method" class="w-48" />
        <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-search" @click="load">Search</UButton>
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
        export-filename="payments"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No payments match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-banknote" title="No payments recorded yet" description="Payments recorded against invoices or lease deposits will show up here." />
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { Payment, PaymentMethod, PaymentType } from '~/composables/usePayments'

const { list } = usePayments()

const rows = ref<Payment[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  leaseId: number | undefined
  invoiceId: number | undefined
  type: PaymentType | undefined
  method: PaymentMethod | undefined
}>({
  leaseId: undefined,
  invoiceId: undefined,
  type: undefined,
  method: undefined
})

const TYPE_OPTIONS: { label: string; value: PaymentType }[] = [
  { label: 'Rent', value: 'RENT' },
  { label: 'Deposit', value: 'DEPOSIT' }
]
const typeFilterOptions = [{ label: 'All types', value: undefined }, ...TYPE_OPTIONS]

// Same list/labels as leases' deposit-payment form and invoices' record-payment form.
const METHOD_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Card', value: 'CARD' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Other', value: 'OTHER' }
]
const methodFilterOptions = [{ label: 'All methods', value: undefined }, ...METHOD_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Payment>[] = [
  { key: 'leaseId', label: 'Lease', value: (row) => row.leaseId ?? '—' },
  { key: 'invoiceId', label: 'Invoice', value: (row) => row.invoiceId ?? '—' },
  { key: 'type', type: 'enum' },
  { key: 'amount', type: 'currency' },
  { key: 'paymentDate', label: 'Payment date', type: 'date' },
  { key: 'method', type: 'enum' },
  { key: 'referenceNumber', label: 'Reference', value: (row) => row.referenceNumber ?? '—' },
  { key: 'recordedBy', label: 'Recorded by', value: (row) => row.recordedBy ?? '—' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      leaseId: filter.leaseId || undefined,
      invoiceId: filter.invoiceId || undefined,
      type: filter.type,
      method: filter.method,
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

onMounted(load)
watch(sort, load)
watch(() => [filter.type, filter.method], load)

const hasActiveFilter = computed(
  () =>
    filter.leaseId !== undefined ||
    filter.invoiceId !== undefined ||
    filter.type !== undefined ||
    filter.method !== undefined
)

function clearFilters() {
  filter.leaseId = undefined
  filter.invoiceId = undefined
  filter.type = undefined
  filter.method = undefined
  load()
}
</script>

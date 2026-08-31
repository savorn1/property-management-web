<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Receipts</h1>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.sourceType" :items="sourceTypeFilterOptions" placeholder="Source type" class="w-52" />
        <UInput
          v-model.number="filter.sourceId"
          type="number"
          placeholder="Source ID"
          icon="i-lucide-hash"
          class="w-40"
          @keyup.enter="load"
        />
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
        export-filename="receipts"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No receipts match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-receipt-text" title="No receipts yet" description="Receipts are issued automatically whenever a payment is recorded." />
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
import type { Receipt, ReceiptSourceType } from '~/composables/useReceipts'

const { list } = useReceipts()

const rows = ref<Receipt[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ sourceType: ReceiptSourceType | undefined; sourceId: number | undefined }>({
  sourceType: undefined,
  sourceId: undefined
})

const SOURCE_TYPE_OPTIONS: { label: string; value: ReceiptSourceType }[] = [
  { label: 'Rent payment', value: 'RENT_PAYMENT' },
  { label: 'Deposit payment', value: 'DEPOSIT_PAYMENT' },
  { label: 'Sale payment', value: 'SALE_PAYMENT' },
  { label: 'Loan payment', value: 'LOAN_PAYMENT' }
]
const sourceTypeFilterOptions = [{ label: 'All sources', value: undefined }, ...SOURCE_TYPE_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Receipt>[] = [
  { key: 'receiptNumber', label: 'Receipt #' },
  { key: 'payerName', label: 'Payer' },
  { key: 'sourceType', label: 'Source', type: 'enum' },
  { key: 'sourceId', label: 'Source ID' },
  { key: 'amount', type: 'currency' },
  { key: 'paymentDate', label: 'Payment date', type: 'date' },
  { key: 'method', type: 'enum' },
  { key: 'referenceNumber', label: 'Reference', value: (row) => row.referenceNumber ?? '—' },
  { key: 'issuedAt', label: 'Issued', type: 'datetime' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      sourceType: filter.sourceType,
      sourceId: filter.sourceId || undefined,
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
watch(() => filter.sourceType, load)

const hasActiveFilter = computed(() => filter.sourceType !== undefined || filter.sourceId !== undefined)

function clearFilters() {
  filter.sourceType = undefined
  filter.sourceId = undefined
  load()
}
</script>

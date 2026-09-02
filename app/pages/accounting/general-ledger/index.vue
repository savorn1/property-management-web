<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">General ledger</h1>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Account</label>
          <USelect v-model="filter.accountId" :items="accountOptions" placeholder="Account" class="w-56" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">From date</label>
          <UInput v-model="filter.startDate" type="date" class="w-40" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">To date</label>
          <UInput v-model="filter.endDate" type="date" class="w-40" />
        </div>
        <UButton icon="i-lucide-play" :disabled="!canRun" :loading="loading" @click="load">Run report</UButton>
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

    <template v-if="report">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <StatTile
          label="Account"
          :value="`${report.accountCode} — ${report.accountName}`"
          icon="i-lucide-list-tree"
          color="neutral"
        />
        <StatTile label="Opening balance" :value="formatCurrency(report.openingBalance)" icon="i-lucide-log-in" />
        <StatTile label="Closing balance" :value="formatCurrency(report.closingBalance)" icon="i-lucide-log-out" color="success" />
      </div>

      <UCard>
        <DataTable
          :rows="report.entries"
          :columns="columns"
          numbered
          exportable
          export-filename="general-ledger"
        >
          <template #empty-state>
            <EmptyState icon="i-lucide-inbox" title="No activity" description="No journal entries posted to this account in the selected date range." />
          </template>
        </DataTable>
      </UCard>
    </template>
    <UCard v-else-if="!loading">
      <EmptyState
        icon="i-lucide-book-open-text"
        title="Run a report"
        description="Pick an account and a date range, then click Run report."
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { GeneralLedgerEntry, GeneralLedgerReport } from '~/composables/useAccountingReports'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const { getGeneralLedger } = useAccountingReports()
const { list: listAccounts } = useAccounts()

const loading = ref(false)
const error = ref('')
const report = ref<GeneralLedgerReport | null>(null)

const today = new Date().toISOString().slice(0, 10)
const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const initialAccountId = Number(route.query.accountId) || undefined
const filter = reactive<{ accountId: number | undefined; startDate: string; endDate: string }>({
  accountId: initialAccountId,
  startDate: monthAgo,
  endDate: today
})

const accountOptions = ref<{ label: string; value: number }[]>([])
async function loadAccountOptions() {
  const res = await listAccounts({ active: true, size: 200 })
  accountOptions.value = res.data.map((a) => ({
    label: `${a.code} — ${a.name}${a.schemeName ? ` (${a.schemeName})` : ''}`,
    value: a.id
  }))
}

const canRun = computed(() => !!filter.accountId && !!filter.startDate && !!filter.endDate)

const columns: ColumnDef<GeneralLedgerEntry>[] = [
  { key: 'entryDate', type: 'date' },
  { key: 'description', value: (row) => row.description ?? '—' },
  { key: 'debit', type: 'currency' },
  { key: 'credit', type: 'currency' },
  { key: 'runningBalance', label: 'Running balance', type: 'currency' }
]

async function load() {
  if (!canRun.value) return
  loading.value = true
  error.value = ''
  try {
    report.value = await getGeneralLedger({
      accountId: filter.accountId!,
      startDate: filter.startDate,
      endDate: filter.endDate
    })
  } catch (err) {
    error.value = apiErrorMessage(err)
    report.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadAccountOptions()
  if (canRun.value) await load()
})
</script>

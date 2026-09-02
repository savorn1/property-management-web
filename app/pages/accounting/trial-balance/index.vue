<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Trial balance</h1>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Scheme</label>
          <USelect v-model="filter.schemeId" :items="schemeOptions" placeholder="Scheme" class="w-48" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">As of date</label>
          <UInput v-model="filter.asOfDate" type="date" class="w-40" />
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
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <StatTile label="Total debits" :value="formatCurrency(report.totalDebits)" icon="i-lucide-arrow-down-to-line" />
        <StatTile label="Total credits" :value="formatCurrency(report.totalCredits)" icon="i-lucide-arrow-up-from-line" />
        <UBadge :color="report.balanced ? 'success' : 'error'" variant="subtle" size="lg" class="gap-1.5">
          <UIcon :name="report.balanced ? 'i-lucide-check-circle' : 'i-lucide-triangle-alert'" class="w-4 h-4" />
          {{ report.balanced ? 'Balanced' : 'Out of balance' }}
        </UBadge>
      </div>

      <UCard>
        <DataTable
          :rows="report.lines"
          :columns="columns"
          numbered
          exportable
          export-filename="trial-balance"
        >
          <template #empty-state>
            <EmptyState icon="i-lucide-inbox" title="No accounts" description="This scheme has no posted activity as of the selected date." />
          </template>
        </DataTable>
        <div v-if="report.lines.length > 0" class="flex justify-end gap-6 pt-3 mt-3 border-t border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-900 dark:text-white">
          <span>Total: {{ formatCurrency(report.totalDebits) }}</span>
          <span>{{ formatCurrency(report.totalCredits) }}</span>
        </div>
      </UCard>
    </template>
    <UCard v-else-if="!loading">
      <EmptyState
        icon="i-lucide-scale"
        title="Run a report"
        description="Pick a scheme and an as-of date, then click Run report."
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { TrialBalanceLine, TrialBalanceReport } from '~/composables/useAccountingReports'

definePageMeta({ middleware: 'admin' })

const { getTrialBalance } = useAccountingReports()
const { list: listSchemes } = useAccountingSchemes()

const loading = ref(false)
const error = ref('')
const report = ref<TrialBalanceReport | null>(null)

const filter = reactive<{ schemeId: number | undefined; asOfDate: string }>({
  schemeId: undefined,
  asOfDate: new Date().toISOString().slice(0, 10)
})

const schemeOptions = ref<{ label: string; value: number }[]>([])
async function loadSchemeOptions() {
  const res = await listSchemes({ size: 200 })
  schemeOptions.value = res.data.map((s) => ({ label: s.name, value: s.id }))
  if (!filter.schemeId && schemeOptions.value.length > 0) {
    filter.schemeId = schemeOptions.value[0]!.value
  }
}

const canRun = computed(() => !!filter.schemeId && !!filter.asOfDate)

const columns: ColumnDef<TrialBalanceLine>[] = [
  { key: 'accountCode', label: 'Code' },
  { key: 'accountName', label: 'Account' },
  { key: 'accountType', label: 'Type', type: 'enum' },
  { key: 'debitBalance', label: 'Debit balance', type: 'currency' },
  { key: 'creditBalance', label: 'Credit balance', type: 'currency' }
]

async function load() {
  if (!canRun.value) return
  loading.value = true
  error.value = ''
  try {
    report.value = await getTrialBalance({ schemeId: filter.schemeId!, asOfDate: filter.asOfDate })
  } catch (err) {
    error.value = apiErrorMessage(err)
    report.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadSchemeOptions()
  if (canRun.value) await load()
})
</script>

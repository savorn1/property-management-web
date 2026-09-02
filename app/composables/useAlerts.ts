// Aggregates the same report/count endpoints the dashboard already uses
// (see pages/index.vue) into a flat list of "needs attention" items for the
// navbar alerts bell — no new backend endpoints, just a different view onto
// data that's already fetched there.

export interface AlertItem {
  key: string
  label: string
  count: number
  // Omitted where the backend has no filter that isolates exactly this
  // count (e.g. "overdue" isn't a list filter) — matches the dashboard's own
  // StatTile.to choices, which leave the same items unlinked.
  to?: string
  color: 'error' | 'warning' | 'neutral'
}

export function useAlerts() {
  const { getCollections, getRental, getMaintenance } = useReports()
  const { list: listUtilityBills } = useUtilityBills()
  const { list: listJournalEntries } = useJournalEntries()
  const { isAdmin } = useAuth()

  const alerts = ref<AlertItem[]>([])
  const loading = ref(false)

  function monthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const toIso = (d: Date) => d.toISOString().slice(0, 10)
    return { startDate: toIso(start), endDate: toIso(now) }
  }

  async function load() {
    loading.value = true
    const { startDate, endDate } = monthRange()

    const [collections, rental, maintenance, pendingUtilityBills, draftEntries] = await Promise.all([
      getCollections().catch(() => null),
      getRental().catch(() => null),
      getMaintenance(startDate, endDate).catch(() => null),
      listUtilityBills({ status: 'PENDING', size: 1 }).catch(() => null),
      isAdmin.value ? listJournalEntries({ status: 'DRAFT', size: 1 }).catch(() => null) : Promise.resolve(null)
    ])

    const items: AlertItem[] = []
    if (collections?.overdueInvoiceCount) {
      items.push({ key: 'overdue-invoices', label: 'Overdue invoices', count: collections.overdueInvoiceCount, color: 'error' })
    }
    if (collections?.overdueInstallmentCount) {
      items.push({ key: 'overdue-installments', label: 'Overdue installments', count: collections.overdueInstallmentCount, color: 'error' })
    }
    if (rental?.expiringWithin30Days) {
      items.push({ key: 'expiring-leases', label: 'Leases expiring within 30 days', count: rental.expiringWithin30Days, to: '/leases?status=ACTIVE', color: 'warning' })
    }
    if (rental?.pendingApprovalLeases) {
      items.push({ key: 'pending-leases', label: 'Leases pending approval', count: rental.pendingApprovalLeases, to: '/leases?status=PENDING_APPROVAL', color: 'warning' })
    }
    if (maintenance?.openCount) {
      items.push({ key: 'open-maintenance', label: 'Open maintenance requests', count: maintenance.openCount, to: '/maintenance?status=OPEN', color: 'warning' })
    }
    if (pendingUtilityBills?.metadata.totalCount) {
      items.push({ key: 'pending-utility-bills', label: 'Pending utility bills', count: pendingUtilityBills.metadata.totalCount, to: '/utility-bills?status=PENDING', color: 'neutral' })
    }
    if (isAdmin.value && draftEntries?.metadata.totalCount) {
      items.push({ key: 'draft-journal-entries', label: 'Draft journal entries', count: draftEntries.metadata.totalCount, to: '/accounting/journal-entries?status=DRAFT', color: 'neutral' })
    }

    alerts.value = items
    loading.value = false
  }

  const totalCount = computed(() => alerts.value.reduce((sum, a) => sum + a.count, 0))

  return { alerts, totalCount, loading, load }
}

<template>
  <UBadge :color="meta.color" variant="subtle" class="gap-1">
    <UIcon :name="meta.icon" class="w-3 h-3" />
    {{ label }}
  </UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{ status: string }>()

type StatusColor = 'success' | 'error' | 'neutral' | 'warning' | 'info' | 'secondary' | 'cancelled'

// Generic status set — extend as new statuses show up (e.g. lease/booking
// states like ACTIVE, VACANT, OCCUPIED, MAINTENANCE).
const STATUS_META: Record<string, { color: StatusColor; icon: string }> = {
  PENDING: { color: 'warning', icon: 'i-lucide-clock' },
  PROCESSING: { color: 'info', icon: 'i-lucide-loader-circle' },
  SUCCESS: { color: 'success', icon: 'i-lucide-check-circle' },
  COMPLETED: { color: 'success', icon: 'i-lucide-check-circle' },
  PAID: { color: 'success', icon: 'i-lucide-badge-check' },
  APPROVED: { color: 'success', icon: 'i-lucide-check-circle' },
  ACTIVE: { color: 'success', icon: 'i-lucide-check-circle' },
  FAILED: { color: 'error', icon: 'i-lucide-x-circle' },
  REJECTED: { color: 'error', icon: 'i-lucide-x-circle' },
  EXPIRED: { color: 'error', icon: 'i-lucide-triangle-alert' },
  // Distinct from CANCELLED/VOIDED below — "reversed" is a different outcome
  // than "never settled," and looked identical (both neutral gray) before.
  REFUNDED: { color: 'secondary', icon: 'i-lucide-undo-2' },
  REVERSED: { color: 'secondary', icon: 'i-lucide-undo-2' },
  CANCELLED: { color: 'cancelled', icon: 'i-lucide-ban' },
  VOIDED: { color: 'cancelled', icon: 'i-lucide-ban' },
  DRAFT: { color: 'neutral', icon: 'i-lucide-pencil' },
  UP: { color: 'success', icon: 'i-lucide-check-circle' },
  DOWN: { color: 'error', icon: 'i-lucide-x-circle' },
  DISABLED: { color: 'neutral', icon: 'i-lucide-power-off' },
  // Unit occupancy status (useUnits' OccupancyStatus). AVAILABLE is shared
  // with ParkingSpotStatus and Unit's SaleStatus (both use that spelling).
  AVAILABLE: { color: 'success', icon: 'i-lucide-check-circle' },
  VACANT: { color: 'success', icon: 'i-lucide-check-circle' },
  OCCUPIED: { color: 'info', icon: 'i-lucide-door-closed' },
  RESERVED: { color: 'warning', icon: 'i-lucide-bookmark' },
  UNAVAILABLE: { color: 'cancelled', icon: 'i-lucide-ban' },
  // Unit sale status (useUnits' SaleStatus) — AVAILABLE/RESERVED/SOLD already covered.
  NOT_FOR_SALE: { color: 'neutral', icon: 'i-lucide-circle-slash' },
  SOLD: { color: 'secondary', icon: 'i-lucide-tag' },
  // Unit maintenance status (useUnits' UnitMaintenanceStatus).
  NORMAL: { color: 'success', icon: 'i-lucide-check-circle' },
  MAINTENANCE: { color: 'warning', icon: 'i-lucide-wrench' },
  // Tenant status (useTenants' TenantStatus) — ACTIVE already covered above.
  INACTIVE: { color: 'neutral', icon: 'i-lucide-power-off' },
  BLACKLISTED: { color: 'error', icon: 'i-lucide-ban' },
  // Lease status (useLeases' LeaseStatus) — ACTIVE already covered above.
  PENDING_APPROVAL: { color: 'warning', icon: 'i-lucide-clock' },
  TERMINATED: { color: 'cancelled', icon: 'i-lucide-ban' },
  // Financial period status (useFinancialPeriods' FinancialPeriodStatus).
  OPEN: { color: 'success', icon: 'i-lucide-lock-open' },
  CLOSED: { color: 'neutral', icon: 'i-lucide-lock' },
  // Journal entry status (useJournalEntries' JournalEntryStatus) — DRAFT
  // already covered above. Distinct key from VOIDED: this backend's enum
  // literal is VOID, not VOIDED.
  POSTED: { color: 'success', icon: 'i-lucide-check-circle' },
  VOID: { color: 'cancelled', icon: 'i-lucide-ban' },
  // Invoice status (useInvoices' InvoiceStatus) — PAID/CANCELLED already
  // covered above; distinct from PENDING so a partially-settled invoice
  // doesn't look identical to a fully outstanding one.
  PARTIALLY_PAID: { color: 'info', icon: 'i-lucide-circle-dot' },
  // Maintenance status (useMaintenance' MaintenanceStatus) — OPEN/COMPLETED/
  // CANCELLED already covered above.
  ASSIGNED: { color: 'info', icon: 'i-lucide-user-check' },
  IN_PROGRESS: { color: 'warning', icon: 'i-lucide-loader-circle' },
  // Lead status (useLeads' LeadStatus) — CONVERTED doubles as SaleReservation's
  // "became an agreement" state.
  NEW: { color: 'info', icon: 'i-lucide-sparkle' },
  CONTACTED: { color: 'warning', icon: 'i-lucide-phone' },
  QUALIFIED: { color: 'success', icon: 'i-lucide-check-circle' },
  LOST: { color: 'cancelled', icon: 'i-lucide-ban' },
  CONVERTED: { color: 'secondary', icon: 'i-lucide-arrow-right-circle' },
  // Sale listing status (useSaleListings' SaleListingStatus) — ACTIVE/SOLD
  // already covered above (ACTIVE/SOLD).
  WITHDRAWN: { color: 'neutral', icon: 'i-lucide-archive' },
  // Synthetic label used by UnitOwner's `current` boolean (units page ownership
  // history), not a backend enum value.
  CURRENT: { color: 'success', icon: 'i-lucide-badge-check' },
  // Move-in/move-out InspectionCondition.
  EXCELLENT: { color: 'success', icon: 'i-lucide-sparkles' },
  GOOD: { color: 'success', icon: 'i-lucide-thumbs-up' },
  FAIR: { color: 'warning', icon: 'i-lucide-alert-triangle' },
  POOR: { color: 'error', icon: 'i-lucide-thumbs-down' },
  // Deposit settlement status (useMoveOut' SettlementStatus) — PENDING already
  // covered above.
  SETTLED: { color: 'success', icon: 'i-lucide-badge-check' },
  // Building status (useBuildings' BuildingStatus) — ACTIVE/INACTIVE already
  // covered above.
  UNDER_CONSTRUCTION: { color: 'warning', icon: 'i-lucide-hard-hat' },
  RENOVATION: { color: 'warning', icon: 'i-lucide-hammer' }
}

const DEFAULT_META: { color: StatusColor; icon: string } = {
  color: 'neutral',
  icon: 'i-lucide-help-circle'
}

const meta = computed(() => STATUS_META[props.status] ?? DEFAULT_META)
const label = computed(() => formatEnum(props.status))
</script>

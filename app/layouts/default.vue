<template>
  <UDashboardGroup class="bg-gray-50 dark:bg-gray-950">
    <UDashboardSidebar collapsible :collapsed-size="4" class="bg-white dark:bg-gray-900">
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2.5" :class="collapsed ? 'justify-center w-full' : ''">
          <span
            class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500 text-white shrink-0"
          >
            <UIcon name="i-lucide-building-2" class="w-4 h-4" />
          </span>
          <span v-if="!collapsed" class="font-bold text-gray-900 dark:text-white tracking-tight">
            Property
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :tooltip="collapsed" :items="items" orientation="vertical" />
      </template>

      <template #footer>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar>
          <template #left>
            <UBreadcrumb :items="breadcrumbItems" />
          </template>

          <template #right>
            <UColorModeButton />
            <UDropdownMenu :items="profileItems" :content="{ align: 'end' }" :ui="{ content: 'w-56' }">
              <UButton size="sm" color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down">
                <UAvatar :alt="username ?? '?'" size="2xs" />
                {{ username }}
              </UButton>
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<script setup lang="ts">
import type { BreadcrumbItem, DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { username, role, isAdmin, logout } = useAuth()
const route = useRoute()

const profileItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: username.value ?? '',
      description: role.value === 'ADMIN' ? 'Administrator' : 'User',
      avatar: { alt: username.value ?? '?' },
      type: 'label'
    }
  ],
  [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }],
  [{ label: 'Log out', icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() }]
])

// Add more feature nav items here as pages are built (e.g. Maintenance,
// Invoices). The Administration section stays admin-only.
const items = computed<NavigationMenuItem[]>(() => [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Properties', to: '/properties', icon: 'i-lucide-building' },
  { label: 'Buildings', to: '/buildings', icon: 'i-lucide-building-2' },
  { label: 'Floors', to: '/floors', icon: 'i-lucide-layers' },
  { label: 'Unit types', to: '/unit-types', icon: 'i-lucide-layout-grid' },
  { label: 'Units', to: '/units', icon: 'i-lucide-door-open' },
  { label: 'Tenants', to: '/tenants', icon: 'i-lucide-user-round' },
  { label: 'Leases', to: '/leases', icon: 'i-lucide-file-signature' },
  { label: 'Move-in requests', to: '/move-in', icon: 'i-lucide-log-in' },
  { label: 'Move-out requests', to: '/move-out', icon: 'i-lucide-log-out' },
  { label: 'Buyers', to: '/buyers', icon: 'i-lucide-handshake' },
  { label: 'Leads', to: '/leads', icon: 'i-lucide-contact' },
  { label: 'Sale listings', to: '/sale-listings', icon: 'i-lucide-tag' },
  { label: 'Sale reservations', to: '/sale-reservations', icon: 'i-lucide-bookmark' },
  { label: 'Sale agreements', to: '/sale-agreements', icon: 'i-lucide-file-signature' },
  { label: 'Invoices', to: '/invoices', icon: 'i-lucide-receipt' },
  { label: 'Payments', to: '/payments', icon: 'i-lucide-banknote' },
  { label: 'Receipts', to: '/receipts', icon: 'i-lucide-receipt-text' },
  // Read-open to any authenticated user (write actions are gated inline within
  // each page) — kept outside the isAdmin block below so USER-role staff can
  // still find them, unlike the pages that follow which require ADMIN even to view.
  { label: 'Maintenance', to: '/maintenance', icon: 'i-lucide-wrench' },
  { label: 'Meters', to: '/meters', icon: 'i-lucide-gauge' },
  { label: 'Utility bills', to: '/utility-bills', icon: 'i-lucide-zap' },
  { label: 'Parking spots', to: '/parking-spots', icon: 'i-lucide-square-parking' },
  ...(isAdmin.value
    ? [
        { label: 'Accounting', type: 'label' as const },
        { label: 'Accounting schemes', to: '/accounting/schemes', icon: 'i-lucide-book-marked' },
        { label: 'Chart of accounts', to: '/accounting/chart-of-accounts', icon: 'i-lucide-list-tree' },
        { label: 'Financial periods', to: '/accounting/financial-periods', icon: 'i-lucide-calendar-range' },
        { label: 'Journal entries', to: '/accounting/journal-entries', icon: 'i-lucide-book-text' },
        { label: 'Journal templates', to: '/accounting/journal-templates', icon: 'i-lucide-file-cog' },
        { label: 'General ledger', to: '/accounting/general-ledger', icon: 'i-lucide-book-open-text' },
        { label: 'Trial balance', to: '/accounting/trial-balance', icon: 'i-lucide-scale' },
        { label: 'Expense categories', to: '/expense-categories', icon: 'i-lucide-tags' },
        { label: 'Expenses', to: '/expenses', icon: 'i-lucide-wallet' },
        { label: 'Loans', to: '/loans', icon: 'i-lucide-landmark' },
        { label: 'Payables', to: '/payables', icon: 'i-lucide-file-text' },
        { label: 'Sales', type: 'label' as const },
        { label: 'Sales agents', to: '/sales-agents', icon: 'i-lucide-user-round' },
        { label: 'Property setup', type: 'label' as const },
        { label: 'Zones', to: '/zones', icon: 'i-lucide-map' },
        { label: 'Amenities', to: '/amenities', icon: 'i-lucide-sparkles' },
        { label: 'Operations', type: 'label' as const },
        { label: 'Vendors', to: '/vendors', icon: 'i-lucide-truck' },
        { label: 'Technicians', to: '/technicians', icon: 'i-lucide-hard-hat' },
        { label: 'Spare parts', to: '/spare-parts', icon: 'i-lucide-cog' },
        { label: 'Administration', type: 'label' as const },
        { label: 'Users', to: '/users', icon: 'i-lucide-users' }
      ]
    : [])
])

// Derived from the same nav list so it can never drift out of sync with the
// sidebar — walks `items` tracking the last `type: 'label'` group seen (e.g.
// "Administration") as the section a page belongs to.
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  let section: string | undefined
  for (const item of items.value) {
    if (item.type === 'label') {
      section = item.label
      continue
    }
    if (item.to !== route.path) continue
    return section ? [{ label: section }, { label: item.label, icon: item.icon }] : [{ label: item.label, icon: item.icon }]
  }
  // Routes outside the sidebar nav (e.g. /profile) fall back to the last path segment.
  const segment = route.path.split('/').filter(Boolean).pop()
  return [{ label: segment ? humanize(segment) : 'Dashboard' }]
})
</script>

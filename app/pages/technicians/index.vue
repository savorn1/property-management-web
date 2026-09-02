<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Technicians</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New technician</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="filter.fullName"
          placeholder="Search name"
          icon="i-lucide-search"
          class="w-56"
          @keyup.enter="load"
        />
        <UInput
          v-model="filter.specialty"
          placeholder="Specialty"
          icon="i-lucide-wrench"
          class="w-48"
          @keyup.enter="load"
        />
        <USelect v-model="filter.active" :items="activeFilterOptions" placeholder="Status" class="w-40" />
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
        export-filename="technicians"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
              Edit
            </UButton>
            <UButton
              size="xs"
              :color="row.active ? 'error' : 'success'"
              variant="soft"
              :icon="row.active ? 'i-lucide-ban' : 'i-lucide-check'"
              @click.stop="openStatusWith(row)"
            >
              {{ row.active ? 'Deactivate' : 'Activate' }}
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No technicians match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-hard-hat" title="No technicians yet" description="Add the first technician to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New technician</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New technician">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="fields"
          :loading="creating"
          :error="createError"
          submit-label="Create"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showEdit" :title="`Edit technician '${editingRow?.fullName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="fields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="statusTarget !== null"
      :title="statusTarget?.active ? 'Deactivate technician' : 'Activate technician'"
      :description="
        statusTarget?.active
          ? `Deactivate technician '${statusTarget?.fullName ?? ''}'?`
          : `Activate technician '${statusTarget?.fullName ?? ''}'?`
      "
      :confirm-label="statusTarget?.active ? 'Deactivate' : 'Activate'"
      :color="statusTarget?.active ? 'error' : 'success'"
      :loading="statusLoading"
      @update:model-value="(v: boolean) => { if (!v) statusTarget = null }"
      @confirm="onStatusConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Technician, TechnicianPayload } from '~/composables/useTechnicians'

definePageMeta({ middleware: 'admin' })

const { list, create, update, updateStatus } = useTechnicians()
const toast = useToast()

const rows = ref<Technician[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ fullName: string; specialty: string; active: boolean | undefined }>({
  fullName: '',
  specialty: '',
  active: undefined
})
const activeFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false }
]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Technician>[] = [
  { key: 'fullName', label: 'Name', sortable: true },
  { key: 'specialty', value: (row) => row.specialty ?? '—' },
  { key: 'phone', value: (row) => row.phone ?? '—' },
  { key: 'email', value: (row) => row.email ?? '—' },
  { key: 'active', type: 'boolean' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      fullName: filter.fullName || undefined,
      specialty: filter.specialty || undefined,
      active: filter.active,
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

const fields: FieldDef[] = [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'specialty', wrapper: 'half', hint: 'e.g. Electrical, Plumbing, HVAC.' },
  { name: 'phone', wrapper: 'half' },
  { name: 'email', type: 'email', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate,
  onCreate,
  showEdit,
  editing,
  editError,
  editingRow,
  editForm,
  openEdit,
  onEdit
} = useCrudModals<Technician, TechnicianPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload)
  },
  load,
  {
    entityName: 'Technician',
    createDefaults: () => ({}),
    toForm: (row) => ({
      fullName: row.fullName,
      specialty: row.specialty ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      notes: row.notes ?? ''
    }),
    toPayload: (values) => ({
      fullName: values.fullName,
      specialty: values.specialty || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      notes: values.notes || undefined
    })
  }
)

const statusTarget = ref<Technician | null>(null)
const statusLoading = ref(false)
function openStatusWith(row: Technician) {
  statusTarget.value = row
}
async function onStatusConfirm() {
  if (!statusTarget.value) return
  statusLoading.value = true
  try {
    const nextActive = !statusTarget.value.active
    await updateStatus(statusTarget.value.id, nextActive)
    toast.add({ title: `Technician ${nextActive ? 'activated' : 'deactivated'}`, color: 'success' })
    statusTarget.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update technician status', description: apiErrorMessage(err), color: 'error' })
  } finally {
    statusLoading.value = false
  }
}

onMounted(load)
watch(sort, load)
watch(() => filter.active, load)

const hasActiveFilter = computed(() => filter.fullName !== '' || filter.specialty !== '' || filter.active !== undefined)

function clearFilters() {
  filter.fullName = ''
  filter.specialty = ''
  filter.active = undefined
  load()
}
</script>

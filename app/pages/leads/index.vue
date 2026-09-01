<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
      <UButton v-if="isAdmin" icon="i-lucide-plus" @click="openCreate">New lead</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect v-model="filter.purpose" :items="purposeFilterOptions" placeholder="Purpose" class="w-44" />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-48" />
        <UInput v-model="filter.fullName" placeholder="Search name" icon="i-lucide-search" class="w-56" @keyup.enter="load" />
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

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="leads"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="isAdmin && row.purpose === 'RENTAL' && canConvert(row)"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-user-check"
              @click="openConvertWith(row)"
            >
              Convert to tenant
            </UButton>
            <UButton
              v-if="isAdmin && row.purpose === 'SALE' && canConvert(row)"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-handshake"
              @click="openConvertReservationWith(row)"
            >
              Convert to reservation
            </UButton>
            <UButton
              v-if="isAdmin && row.status !== 'CONVERTED'"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-flag"
              @click="openStatusWith(row)"
            >
              Status
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-history" @click="openHistoryWith(row)">
              History
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-paperclip" @click="openDocumentsWith(row)">
              Documents
            </UButton>
            <UButton v-if="isAdmin" size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
              Edit
            </UButton>
            <UButton
              v-if="isAdmin && row.status !== 'CONVERTED'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              @click="confirmDelete = row"
            >
              Delete
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No leads match your filters"
            description="Try a different filter or clear it."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-contact" title="No leads yet" description="Add the first lead to get started.">
            <template v-if="isAdmin" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New lead</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New lead">
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

    <UModal v-model:open="showEdit" :title="`Edit lead '${editingRow?.fullName ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete lead"
      :description="`Delete the lead for '${confirmDelete?.fullName ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />

    <UModal v-model:open="showStatus" :title="`Update status · ${statusTarget?.fullName ?? ''}`">
      <template #body>
        <DynamicForm
          v-model="statusForm"
          :fields="statusFields"
          :loading="statusLoading"
          :error="statusError"
          submit-label="Update"
          cancelable
          @submit="onStatusSubmit"
          @cancel="showStatus = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showConvert" :title="`Convert '${convertTarget?.fullName ?? ''}' to tenant`">
      <template #body>
        <DynamicForm
          v-model="convertForm"
          :fields="convertFields"
          :loading="convertLoading"
          :error="convertError"
          submit-label="Convert"
          cancelable
          @submit="onConvertSubmit"
          @cancel="showConvert = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showConvertReservation" :title="`Convert '${convertReservationTarget?.fullName ?? ''}' to reservation`">
      <template #body>
        <UAlert
          v-if="convertReservationTarget && !convertReservationTarget.interestedUnitId"
          class="mb-3"
          color="warning"
          variant="subtle"
          title="This lead has no interested unit set — conversion will fail server-side."
        />
        <DynamicForm
          v-model="convertReservationForm"
          :fields="convertReservationFields"
          :loading="convertReservationLoading"
          :error="convertReservationError"
          submit-label="Convert"
          cancelable
          @submit="onConvertReservationSubmit"
          @cancel="showConvertReservation = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showHistory" :title="`History · ${historyTarget?.fullName ?? ''}`">
      <template #body>
        <div v-if="historyLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="historyEntries.length === 0" class="text-sm text-gray-400">No history recorded yet.</div>
        <div v-else class="space-y-3">
          <div v-for="h in historyEntries" :key="h.id" class="border-b border-gray-100 dark:border-gray-800 pb-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-gray-900 dark:text-white">{{ formatEnum(h.action) }}</span>
              <span class="text-gray-400">{{ formatDateTime(h.createdAt) }}</span>
            </div>
            <p v-if="h.description" class="text-sm text-gray-600 dark:text-gray-300">{{ h.description }}</p>
            <p v-if="h.performedBy" class="text-xs text-gray-400">by {{ h.performedBy }}</p>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showDocuments" :title="`Documents · ${documentsTarget?.fullName ?? ''}`">
      <template #body>
        <div class="space-y-4">
          <div v-if="documentsLoading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="documents.length === 0" class="text-sm text-gray-400">No documents uploaded yet.</div>
          <div v-else class="space-y-1.5">
            <div
              v-for="d in documents"
              :key="d.id"
              class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <div>
                <button class="text-primary-500 hover:underline text-left" @click="onDownload(d)">{{ d.fileName }}</button>
                <span v-if="d.description" class="text-gray-400"> — {{ d.description }}</span>
                <div class="text-xs text-gray-400">{{ formatDateTime(d.createdAt) }} · {{ d.uploadedBy ?? '—' }}</div>
              </div>
              <UButton
                v-if="isAdmin"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="onDeleteDocument(d)"
              />
            </div>
          </div>

          <div v-if="isAdmin" class="border-t border-gray-200 dark:border-gray-800 pt-4">
            <FileUploadField :upload="uploadForTarget" @uploaded="onDocumentUploaded" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Lead, LeadPurpose, LeadStatus, LeadHistoryEntry } from '~/composables/useLeads'
import type { LeadDocument } from '~/composables/useLeadDocuments'

const { list, create, update, updateStatus, convert, convertToReservation, remove, history } = useLeads()
const { list: listDocuments, upload, remove: removeDocument, download } = useLeadDocuments()
const { list: listUnits } = useUnits()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<Lead[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ purpose: LeadPurpose | undefined; status: LeadStatus | undefined; fullName: string }>({
  purpose: undefined,
  status: undefined,
  fullName: ''
})

const unitOptions = ref<{ label: string; value: number }[]>([])
async function loadOptions() {
  const res = await listUnits({ size: 200 })
  unitOptions.value = res.data.map((u) => ({
    label: `${u.unitNumber}${u.buildingName ? ` — ${u.buildingName}` : ''}`,
    value: u.id
  }))
}

const PURPOSE_OPTIONS: { label: string; value: LeadPurpose }[] = [
  { label: 'Rental', value: 'RENTAL' },
  { label: 'Sale', value: 'SALE' }
]
const purposeFilterOptions = [{ label: 'All purposes', value: undefined }, ...PURPOSE_OPTIONS]

const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Qualified', value: 'QUALIFIED' },
  { label: 'Lost', value: 'LOST' },
  { label: 'Converted', value: 'CONVERTED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'id', direction: 'desc' })
const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Lead>[] = [
  { key: 'fullName', label: 'Name' },
  { key: 'contact', label: 'Contact', value: (row) => row.email ?? row.phone ?? '—' },
  { key: 'purpose', type: 'enum' },
  { key: 'interestedUnitNumber', label: 'Interested unit', value: (row) => row.interestedUnitNumber ?? '—' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      purpose: filter.purpose,
      status: filter.status,
      fullName: filter.fullName || undefined,
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

function canConvert(row: Lead) {
  return row.status !== 'CONVERTED' && row.status !== 'LOST'
}

const createFields = computed<FieldDef[]>(() => [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'purpose', type: 'select', required: true, default: 'RENTAL', options: PURPOSE_OPTIONS },
  { name: 'email', type: 'email', wrapper: 'half' },
  { name: 'phone', wrapper: 'half' },
  { name: 'source', hint: 'e.g. Website, Referral, Walk-in, Phone, Social media.', wrapper: 'half' },
  { name: 'interestedUnitId', label: 'Interested unit', type: 'select', options: unitOptions.value, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])
const editFields = computed<FieldDef[]>(() => [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'email', type: 'email', wrapper: 'half' },
  { name: 'phone', wrapper: 'half' },
  { name: 'source', wrapper: 'half' },
  { name: 'interestedUnitId', label: 'Interested unit', type: 'select', options: unitOptions.value, wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
])

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
  onEdit,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<Lead>(
  {
    create: (payload) => create(payload as any),
    update: (row, payload) => update(row.id, payload as any),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Lead',
    createDefaults: () => ({ purpose: 'RENTAL' }),
    toForm: (row) => ({
      fullName: row.fullName,
      email: row.email ?? '',
      phone: row.phone ?? '',
      source: row.source ?? '',
      interestedUnitId: row.interestedUnitId ?? undefined,
      notes: row.notes ?? ''
    }),
    toPayload: (values) => ({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      source: values.source || undefined,
      purpose: values.purpose,
      interestedUnitId: values.interestedUnitId || undefined,
      notes: values.notes || undefined
    }),
    toEditPayload: (values) => ({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      source: values.source || undefined,
      interestedUnitId: values.interestedUnitId || undefined,
      notes: values.notes || undefined
    })
  }
)

// Update status
const {
  open: showStatus,
  target: statusTarget,
  loading: statusLoading,
  error: statusError,
  openWith: openStatusWith
} = useTargetModal<Lead>()
const statusForm = ref<Record<string, any>>({})
const statusFields: FieldDef[] = [{ name: 'status', type: 'select', required: true, options: STATUS_OPTIONS }]
watch(showStatus, (value) => {
  if (value && statusTarget.value) statusForm.value = { status: statusTarget.value.status }
})
async function onStatusSubmit(values: Record<string, any>) {
  if (!statusTarget.value) return
  statusLoading.value = true
  statusError.value = ''
  try {
    await updateStatus(statusTarget.value.id, values.status)
    showStatus.value = false
    toast.add({ title: 'Lead status updated', color: 'success' })
    await load()
  } catch (err) {
    statusError.value = apiErrorMessage(err)
  } finally {
    statusLoading.value = false
  }
}

// Convert to tenant (RENTAL leads)
const {
  open: showConvert,
  target: convertTarget,
  loading: convertLoading,
  error: convertError,
  openWith: openConvertWith
} = useTargetModal<Lead>()
const convertForm = ref<Record<string, any>>({})
const convertFields: FieldDef[] = [
  { name: 'nationalId', label: 'National ID', wrapper: 'half' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date', wrapper: 'half' },
  { name: 'address', wrapper: 'full' },
  { name: 'occupation', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
watch(showConvert, (value) => {
  if (value) convertForm.value = {}
})
async function onConvertSubmit(values: Record<string, any>) {
  if (!convertTarget.value) return
  convertLoading.value = true
  convertError.value = ''
  try {
    await convert(convertTarget.value.id, {
      nationalId: values.nationalId || undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      address: values.address || undefined,
      occupation: values.occupation || undefined,
      notes: values.notes || undefined
    })
    showConvert.value = false
    toast.add({ title: 'Lead converted to tenant', color: 'success' })
    await load()
  } catch (err) {
    convertError.value = apiErrorMessage(err)
  } finally {
    convertLoading.value = false
  }
}

// Convert to reservation (SALE leads) — requires the lead's interested unit
// to already have an ACTIVE sale listing (enforced server-side).
const {
  open: showConvertReservation,
  target: convertReservationTarget,
  loading: convertReservationLoading,
  error: convertReservationError,
  openWith: openConvertReservationWith
} = useTargetModal<Lead>()
const convertReservationForm = ref<Record<string, any>>({})
const convertReservationFields: FieldDef[] = [
  { name: 'nationalId', label: 'National ID', wrapper: 'half' },
  { name: 'reservationDate', label: 'Reservation date', type: 'date', wrapper: 'half', default: new Date().toISOString().slice(0, 10) },
  { name: 'address', wrapper: 'full' },
  { name: 'expiryDate', label: 'Expiry date', type: 'date', wrapper: 'half' },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]
watch(showConvertReservation, (value) => {
  if (value) convertReservationForm.value = { reservationDate: new Date().toISOString().slice(0, 10) }
})
async function onConvertReservationSubmit(values: Record<string, any>) {
  if (!convertReservationTarget.value) return
  convertReservationLoading.value = true
  convertReservationError.value = ''
  try {
    const reservation = await convertToReservation(convertReservationTarget.value.id, {
      nationalId: values.nationalId || undefined,
      address: values.address || undefined,
      reservationDate: values.reservationDate || undefined,
      expiryDate: values.expiryDate || undefined,
      notes: values.notes || undefined
    })
    showConvertReservation.value = false
    toast.add({ title: `Lead converted — reservation #${reservation.id} created`, color: 'success' })
    await load()
  } catch (err) {
    convertReservationError.value = apiErrorMessage(err)
  } finally {
    convertReservationLoading.value = false
  }
}

// History (read-only)
const {
  open: showHistory,
  target: historyTarget,
  openWith: openHistoryWith
} = useTargetModal<Lead>()
const historyEntries = ref<LeadHistoryEntry[]>([])
const historyLoading = ref(false)
watch(showHistory, async (value) => {
  if (!value || !historyTarget.value) return
  historyLoading.value = true
  try {
    historyEntries.value = await history(historyTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load history', description: apiErrorMessage(err), color: 'error' })
  } finally {
    historyLoading.value = false
  }
})

// Documents (multipart upload/list/delete)
const {
  open: showDocuments,
  target: documentsTarget,
  openWith: openDocumentsWith
} = useTargetModal<Lead>()
const documents = ref<LeadDocument[]>([])
const documentsLoading = ref(false)

async function loadDocuments() {
  if (!documentsTarget.value) return
  documentsLoading.value = true
  try {
    documents.value = await listDocuments(documentsTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load documents', description: apiErrorMessage(err), color: 'error' })
  } finally {
    documentsLoading.value = false
  }
}
watch(showDocuments, (value) => {
  if (value) loadDocuments()
})

function uploadForTarget(file: File, description?: string) {
  return upload(documentsTarget.value!.id, file, description)
}

async function onDocumentUploaded() {
  toast.add({ title: 'Document uploaded', color: 'success' })
  await loadDocuments()
}

async function onDeleteDocument(doc: LeadDocument) {
  if (!documentsTarget.value) return
  try {
    await removeDocument(documentsTarget.value.id, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments()
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownload(doc: LeadDocument) {
  if (!documentsTarget.value) return
  try {
    await download(documentsTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

onMounted(async () => {
  await loadOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.purpose, filter.status], load)

const hasActiveFilter = computed(
  () => filter.purpose !== undefined || filter.status !== undefined || filter.fullName !== ''
)
function clearFilters() {
  filter.purpose = undefined
  filter.status = undefined
  filter.fullName = ''
  load()
}
</script>

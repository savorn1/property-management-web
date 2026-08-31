<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenants</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New tenant</UButton>
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
          v-model="filter.email"
          placeholder="Email"
          icon="i-lucide-mail"
          class="w-56"
          @keyup.enter="load"
        />
        <USelect
          v-model="filter.status"
          :items="statusFilterOptions"
          placeholder="Status"
          class="w-40"
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
        export-filename="tenants"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-file-signature"
              @click="navigateTo(`/leases?tenantId=${row.id}`)"
            >
              Leases
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-shield" @click="openStatusWith(row)">
              Status
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-folder" @click="openDocumentsWith(row)">
              Documents
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
              Edit
            </UButton>
            <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = row">
              Delete
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No tenants match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-user-round" title="No tenants yet" description="Add the first tenant to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New tenant</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New tenant">
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

    <UModal v-model:open="showEdit" :title="`Edit tenant '${editingRow?.fullName ?? ''}'`">
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

    <UModal v-model:open="showStatus" :title="`Update status for '${statusTarget?.fullName ?? ''}'`">
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
                <button class="text-primary-500 hover:underline text-left" @click="onDownloadDocument(d)">{{ d.fileName }}</button>
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

          <div v-if="isAdmin" class="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
            <input ref="documentFileInput" type="file" class="text-sm" @change="onDocumentFileChange" />
            <UInput v-model="documentUploadDescription" placeholder="Description (optional)" class="w-full" />
            <UAlert v-if="documentUploadError" color="error" variant="subtle" :title="documentUploadError" />
            <UButton :loading="documentUploading" :disabled="!selectedDocumentFile" icon="i-lucide-upload" @click="onUploadDocument">
              Upload
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete tenant"
      :description="`Delete tenant '${confirmDelete?.fullName ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Tenant, TenantPayload, TenantStatus } from '~/composables/useTenants'
import type { TenantDocument } from '~/composables/useTenantDocuments'

const route = useRoute()
const { list, create, update, updateStatus, remove } = useTenants()
const { list: listDocuments, upload: uploadDocument, remove: removeDocument, download: downloadDocument } = useTenantDocuments()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<Tenant[]>([])
const loading = ref(false)
const error = ref('')

const initialStatus = (route.query.status as TenantStatus | undefined) || undefined
const filter = reactive<{ fullName: string; email: string; status: TenantStatus | undefined }>({
  fullName: '',
  email: '',
  status: initialStatus
})

const STATUS_OPTIONS: { label: string; value: TenantStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Blacklisted', value: 'BLACKLISTED' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Tenant>[] = [
  { key: 'fullName', label: 'Name', sortable: true },
  { key: 'email', value: (row) => row.email ?? '—' },
  { key: 'phone', value: (row) => row.phone ?? '—' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      fullName: filter.fullName || undefined,
      email: filter.email || undefined,
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

const fields: FieldDef[] = [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'email', type: 'email', wrapper: 'half' },
  { name: 'phone', wrapper: 'half' },
  { name: 'nationalId', label: 'National ID', wrapper: 'half' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date', wrapper: 'half' },
  { name: 'occupation' },
  { name: 'address', type: 'textarea', wrapper: 'full' },
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
  onEdit,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<Tenant, TenantPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Tenant',
    createDefaults: () => ({}),
    toForm: (row) => ({
      fullName: row.fullName,
      email: row.email ?? '',
      phone: row.phone ?? '',
      nationalId: row.nationalId ?? '',
      dateOfBirth: row.dateOfBirth ?? '',
      occupation: row.occupation ?? '',
      address: row.address ?? '',
      notes: row.notes ?? ''
    }),
    toPayload: (values) => ({
      fullName: values.fullName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      nationalId: values.nationalId || undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      occupation: values.occupation || undefined,
      address: values.address || undefined,
      notes: values.notes || undefined
    })
  }
)

const {
  open: showStatus,
  target: statusTarget,
  loading: statusLoading,
  error: statusError,
  openWith: openStatusWith
} = useTargetModal<Tenant>()

const statusForm = ref<Record<string, any>>({})
const statusFields: FieldDef[] = [{ name: 'status', type: 'select', required: true, options: STATUS_OPTIONS }]

watch(showStatus, (value) => {
  if (value && statusTarget.value) {
    statusForm.value = { status: statusTarget.value.status }
  }
})

async function onStatusSubmit(values: Record<string, any>) {
  if (!statusTarget.value) return
  statusLoading.value = true
  statusError.value = ''
  try {
    await updateStatus(statusTarget.value.id, values.status)
    showStatus.value = false
    toast.add({ title: 'Tenant status updated', color: 'success' })
    await load()
  } catch (err) {
    statusError.value = apiErrorMessage(err)
  } finally {
    statusLoading.value = false
  }
}

// Documents (multipart upload/list/delete)
const {
  open: showDocuments,
  target: documentsTarget,
  openWith: openDocumentsWith
} = useTargetModal<Tenant>()
const documents = ref<TenantDocument[]>([])
const documentsLoading = ref(false)
const selectedDocumentFile = ref<File | null>(null)
const documentUploadDescription = ref('')
const documentUploading = ref(false)
const documentUploadError = ref('')
const documentFileInput = ref<HTMLInputElement | null>(null)

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
  if (value) {
    selectedDocumentFile.value = null
    documentUploadDescription.value = ''
    documentUploadError.value = ''
    loadDocuments()
  }
})

function onDocumentFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  selectedDocumentFile.value = target.files?.[0] ?? null
}

async function onUploadDocument() {
  if (!documentsTarget.value || !selectedDocumentFile.value) return
  documentUploading.value = true
  documentUploadError.value = ''
  try {
    await uploadDocument(documentsTarget.value.id, selectedDocumentFile.value, documentUploadDescription.value || undefined)
    selectedDocumentFile.value = null
    documentUploadDescription.value = ''
    if (documentFileInput.value) documentFileInput.value.value = ''
    toast.add({ title: 'Document uploaded', color: 'success' })
    await loadDocuments()
  } catch (err) {
    documentUploadError.value = apiErrorMessage(err)
  } finally {
    documentUploading.value = false
  }
}

async function onDeleteDocument(doc: TenantDocument) {
  if (!documentsTarget.value) return
  try {
    await removeDocument(documentsTarget.value.id, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments()
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadDocument(doc: TenantDocument) {
  if (!documentsTarget.value) return
  try {
    await downloadDocument(documentsTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

onMounted(load)
watch(sort, load)
watch(() => filter.status, load)

const hasActiveFilter = computed(
  () => filter.fullName !== '' || filter.email !== '' || filter.status !== undefined
)

function clearFilters() {
  filter.fullName = ''
  filter.email = ''
  filter.status = undefined
  load()
}
</script>

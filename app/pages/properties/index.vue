<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Properties</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New property</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="filter.name"
          placeholder="Search name"
          icon="i-lucide-search"
          class="w-56"
          @keyup.enter="load"
        />
        <UInput
          v-model="filter.city"
          placeholder="City"
          icon="i-lucide-map-pin"
          class="w-44"
          @keyup.enter="load"
        />
        <USelect v-model="filter.type" :items="typeFilterOptions" placeholder="Type" class="w-44" />
        <USelect v-model="filter.zoneId" :items="zoneFilterOptions" placeholder="Zone" class="w-44" />
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
        export-filename="properties"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row) => navigateTo(`/properties/${row.id}`)"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-eye"
              @click.stop="navigateTo(`/properties/${row.id}`)"
            >
              Overview
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-building-2"
              @click.stop="navigateTo(`/buildings?propertyId=${row.id}`)"
            >
              Buildings
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-settings-2" @click.stop="openManageWith(row)">
              Manage
            </UButton>
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
              Edit
            </UButton>
            <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click.stop="confirmDelete = row">
              Delete
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No properties match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-building" title="No properties yet" description="Add the first property to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New property</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New property">
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

    <UModal v-model:open="showEdit" :title="`Edit property '${editingRow?.name ?? ''}'`">
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
      :model-value="confirmDelete !== null"
      title="Delete property"
      :description="`Delete property '${confirmDelete?.name ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />

    <UModal v-model:open="showManage" :title="`Manage · ${manageTarget?.name ?? ''}`" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Documents
            </h3>
            <div v-if="documentsLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="documents.length === 0" class="text-sm text-gray-400 mb-3">
              No documents uploaded yet.
            </div>
            <div v-else class="space-y-1.5 mb-4">
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
            <div v-if="isAdmin" class="space-y-3">
              <input ref="documentFileInput" type="file" class="text-sm" @change="onDocumentFileChange" />
              <UInput v-model="documentUploadDescription" placeholder="Description (optional)" class="w-full" />
              <UAlert v-if="documentUploadError" color="error" variant="subtle" :title="documentUploadError" />
              <UButton :loading="documentUploading" :disabled="!selectedDocumentFile" icon="i-lucide-upload" @click="onUploadDocument">
                Upload
              </UButton>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Certificates
            </h3>
            <div v-if="certificatesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="certificates.length === 0" class="text-sm text-gray-400 mb-3">
              No certificates uploaded yet.
            </div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="c in certificates"
                :key="c.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <div>
                  <button class="text-primary-500 hover:underline text-left" @click="onDownloadCertificate(c)">{{ c.fileName }}</button>
                  <span v-if="c.description" class="text-gray-400"> — {{ c.description }}</span>
                  <div class="text-xs text-gray-400">{{ formatDateTime(c.createdAt) }} · {{ c.uploadedBy ?? '—' }}</div>
                </div>
                <UButton
                  v-if="isAdmin"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="onDeleteCertificate(c)"
                />
              </div>
            </div>
            <div v-if="isAdmin" class="space-y-3">
              <input ref="certificateFileInput" type="file" class="text-sm" @change="onCertificateFileChange" />
              <UInput v-model="certificateUploadDescription" placeholder="Description (optional)" class="w-full" />
              <UAlert v-if="certificateUploadError" color="error" variant="subtle" :title="certificateUploadError" />
              <UButton :loading="certificateUploading" :disabled="!selectedCertificateFile" icon="i-lucide-upload" @click="onUploadCertificate">
                Upload
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { PropertyItem, PropertyPayload, PropertyType } from '~/composables/useProperties'
import type { PropertyDocument } from '~/composables/usePropertyDocuments'
import type { PropertyCertificate } from '~/composables/usePropertyCertificates'

const { list, create, update, remove } = useProperties()
const { list: listDocuments, upload: uploadDocument, remove: removeDocument, download: downloadDocument } = usePropertyDocuments()
const { list: listCertificates, upload: uploadCertificate, remove: removeCertificate, download: downloadCertificate } = usePropertyCertificates()
const { list: listZones } = useZones()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<PropertyItem[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ name: string; city: string; type: PropertyType | undefined; zoneId: number | undefined }>({
  name: '',
  city: '',
  type: undefined,
  zoneId: undefined
})

const zoneOptions = ref<{ label: string; value: number }[]>([])
const zoneFilterOptions = computed(() => [{ label: 'All zones', value: undefined }, ...zoneOptions.value])

async function loadZoneOptions() {
  const res = await listZones({ size: 200 })
  zoneOptions.value = res.data.map((z) => ({ label: z.name, value: z.id }))
}

const PROPERTY_TYPE_OPTIONS: { label: string; value: PropertyType }[] = [
  { label: 'Apartment', value: 'APARTMENT' },
  { label: 'Condominium', value: 'CONDOMINIUM' },
  { label: 'Office', value: 'OFFICE' },
  { label: 'Shopping mall', value: 'SHOPPING_MALL' },
  { label: 'Warehouse', value: 'WAREHOUSE' },
  { label: 'Villa', value: 'VILLA' },
  { label: 'House', value: 'HOUSE' },
  { label: 'Land', value: 'LAND' },
  { label: 'Mixed use', value: 'MIXED_USE' }
]
const typeFilterOptions = [{ label: 'All types', value: undefined }, ...PROPERTY_TYPE_OPTIONS]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<PropertyItem>[] = [
  { key: 'name', sortable: true },
  { key: 'type', value: (row) => (row.type ? formatEnum(row.type) : '—') },
  { key: 'zoneName', label: 'Zone', value: (row) => row.zoneName ?? '—' },
  { key: 'code', value: (row) => row.code ?? '—' },
  { key: 'city', value: (row) => row.city ?? '—' },
  { key: 'state', value: (row) => row.state ?? '—' },
  { key: 'country', value: (row) => row.country ?? '—' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      name: filter.name || undefined,
      city: filter.city || undefined,
      type: filter.type,
      zoneId: filter.zoneId,
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

const fields = computed<FieldDef[]>(() => [
  { name: 'name', required: true },
  { name: 'type', label: 'Property type', type: 'select', required: true, options: PROPERTY_TYPE_OPTIONS, wrapper: 'half' },
  { name: 'zoneId', label: 'Zone', type: 'select', options: zoneOptions.value, wrapper: 'half' },
  { name: 'code', wrapper: 'half' },
  { name: 'address', wrapper: 'full' },
  { name: 'city' },
  { name: 'state' },
  { name: 'postalCode', label: 'Postal code' },
  { name: 'country' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
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
} = useCrudModals<PropertyItem, PropertyPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Property',
    createDefaults: () => ({}),
    toForm: (row) => ({
      name: row.name,
      code: row.code ?? '',
      type: row.type ?? undefined,
      zoneId: row.zoneId ?? undefined,
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      postalCode: row.postalCode ?? '',
      country: row.country ?? '',
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      name: values.name,
      type: values.type,
      code: values.code || undefined,
      zoneId: values.zoneId || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      postalCode: values.postalCode || undefined,
      country: values.country || undefined,
      description: values.description || undefined
    })
  }
)

onMounted(async () => {
  await loadZoneOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.type, filter.zoneId], load)

const hasActiveFilter = computed(
  () => filter.name !== '' || filter.city !== '' || filter.type !== undefined || filter.zoneId !== undefined
)

function clearFilters() {
  filter.name = ''
  filter.city = ''
  filter.type = undefined
  filter.zoneId = undefined
  load()
}

// Manage — Documents + Certificates, both scoped to one property.
const {
  open: showManage,
  target: manageTarget,
  openWith: openManageWith
} = useTargetModal<PropertyItem>()

// Documents
const documents = ref<PropertyDocument[]>([])
const documentsLoading = ref(false)
const selectedDocumentFile = ref<File | null>(null)
const documentUploadDescription = ref('')
const documentUploading = ref(false)
const documentUploadError = ref('')
const documentFileInput = ref<HTMLInputElement | null>(null)

// Certificates
const certificates = ref<PropertyCertificate[]>([])
const certificatesLoading = ref(false)
const selectedCertificateFile = ref<File | null>(null)
const certificateUploadDescription = ref('')
const certificateUploading = ref(false)
const certificateUploadError = ref('')
const certificateFileInput = ref<HTMLInputElement | null>(null)

async function loadDocuments() {
  if (!manageTarget.value) return
  documentsLoading.value = true
  try {
    documents.value = await listDocuments(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load documents', description: apiErrorMessage(err), color: 'error' })
  } finally {
    documentsLoading.value = false
  }
}

async function loadCertificates() {
  if (!manageTarget.value) return
  certificatesLoading.value = true
  try {
    certificates.value = await listCertificates(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load certificates', description: apiErrorMessage(err), color: 'error' })
  } finally {
    certificatesLoading.value = false
  }
}

watch(showManage, (value) => {
  if (!value) return
  selectedDocumentFile.value = null
  documentUploadDescription.value = ''
  documentUploadError.value = ''
  selectedCertificateFile.value = null
  certificateUploadDescription.value = ''
  certificateUploadError.value = ''
  loadDocuments()
  loadCertificates()
})

function onDocumentFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  selectedDocumentFile.value = target.files?.[0] ?? null
}

async function onUploadDocument() {
  if (!manageTarget.value || !selectedDocumentFile.value) return
  documentUploading.value = true
  documentUploadError.value = ''
  try {
    await uploadDocument(manageTarget.value.id, selectedDocumentFile.value, documentUploadDescription.value || undefined)
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

async function onDeleteDocument(doc: PropertyDocument) {
  if (!manageTarget.value) return
  try {
    await removeDocument(manageTarget.value.id, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments()
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadDocument(doc: PropertyDocument) {
  if (!manageTarget.value) return
  try {
    await downloadDocument(manageTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

function onCertificateFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  selectedCertificateFile.value = target.files?.[0] ?? null
}

async function onUploadCertificate() {
  if (!manageTarget.value || !selectedCertificateFile.value) return
  certificateUploading.value = true
  certificateUploadError.value = ''
  try {
    await uploadCertificate(manageTarget.value.id, selectedCertificateFile.value, certificateUploadDescription.value || undefined)
    selectedCertificateFile.value = null
    certificateUploadDescription.value = ''
    if (certificateFileInput.value) certificateFileInput.value.value = ''
    toast.add({ title: 'Certificate uploaded', color: 'success' })
    await loadCertificates()
  } catch (err) {
    certificateUploadError.value = apiErrorMessage(err)
  } finally {
    certificateUploading.value = false
  }
}

async function onDeleteCertificate(cert: PropertyCertificate) {
  if (!manageTarget.value) return
  try {
    await removeCertificate(manageTarget.value.id, cert.id)
    toast.add({ title: 'Certificate deleted', color: 'success' })
    await loadCertificates()
  } catch (err) {
    toast.add({ title: 'Could not delete certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadCertificate(cert: PropertyCertificate) {
  if (!manageTarget.value) return
  try {
    await downloadCertificate(manageTarget.value.id, cert.id, cert.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download certificate', description: apiErrorMessage(err), color: 'error' })
  }
}
</script>

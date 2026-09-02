<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Properties</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New property</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="search"
          placeholder="Search name or city"
          icon="i-lucide-search"
          class="w-56"
        />
        <USelect v-model="filter.type" :items="typeFilterOptions" placeholder="Type" class="w-36" />
        <USelect v-model="filter.zoneId" :items="zoneFilterOptions" placeholder="Zone" class="w-36" />
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
        export-filename="properties"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row) => navigateTo(`/properties/${row.id}`)"
      >
        <template #actions-data="{ row }">
          <RowActions :actions="propertyActions(row)" />
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

    <UModal v-model:open="showImages" :title="`Images · ${imagesTarget?.name ?? ''}`">
      <template #body>
        <div v-if="imagesLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="images.length === 0" class="text-sm text-gray-400 mb-3">No images uploaded yet.</div>
        <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          <div v-for="img in images" :key="img.id" class="relative group">
            <img
              v-if="imageUrls[img.id]"
              :src="imageUrls[img.id]"
              :alt="img.caption ?? img.fileName"
              class="w-full h-20 object-cover rounded border border-gray-200 dark:border-gray-800 cursor-pointer"
              @click="openImageLightbox(img.id)"
            >
            <div v-else class="w-full h-20 rounded border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-300">
              <UIcon name="i-lucide-image" class="size-5" />
            </div>
            <span
              v-if="img.primary"
              class="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded"
            >
              Primary
            </span>
            <div v-if="isAdmin" class="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity py-1">
              <UButton
                v-if="!img.primary"
                size="xs"
                color="neutral"
                variant="solid"
                icon="i-lucide-star"
                @click="onSetPrimaryImage(img)"
              />
              <UButton
                size="xs"
                color="error"
                variant="solid"
                icon="i-lucide-trash-2"
                @click="onDeleteImage(img)"
              />
            </div>
          </div>
        </div>
        <ImageUploadCropField v-if="isAdmin" :upload="uploadImageForTarget" @uploaded="onImageUploaded" />
        <ImageLightbox v-model:open="showImageLightbox" v-model:index="imageLightboxIndex" :images="imageLightboxItems" />
      </template>
    </UModal>

    <UModal v-model:open="showDocuments" :title="`Documents · ${documentsTarget?.name ?? ''}`">
      <template #body>
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
        <FileUploadField v-if="isAdmin" :upload="uploadDocumentForTarget" @uploaded="onDocumentUploaded" />
      </template>
    </UModal>

    <UModal v-model:open="showCertificates" :title="`Certificates · ${certificatesTarget?.name ?? ''}`">
      <template #body>
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
        <FileUploadField v-if="isAdmin" :upload="uploadCertificateForTarget" @uploaded="onCertificateUploaded" />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type { PropertyItem, PropertyPayload, PropertyType } from '~/composables/useProperties'
import type { PropertyDocument } from '~/composables/usePropertyDocuments'
import type { PropertyCertificate } from '~/composables/usePropertyCertificates'
import type { PropertyImage } from '~/composables/usePropertyImages'

const { list, create, update, remove } = useProperties()
const { list: listDocuments, upload: uploadDocument, remove: removeDocument, download: downloadDocument } = usePropertyDocuments()
const { list: listCertificates, upload: uploadCertificate, remove: removeCertificate, download: downloadCertificate } = usePropertyCertificates()
const {
  list: listImages,
  upload: uploadImage,
  setPrimary: setPrimaryImage,
  remove: removeImage,
  getObjectUrl: getImageUrl
} = usePropertyImages()
const { list: listZones } = useZones()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<PropertyItem[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ type: PropertyType | undefined; zoneId: number | undefined }>({
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

const { page, pageSize, total, rows: pagedRows, truncated, search } = useClientTable(rows, {
  pageSize: 10,
  searchFields: ['name', 'city']
})

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
  () => search.value !== '' || filter.type !== undefined || filter.zoneId !== undefined
)

function clearFilters() {
  search.value = ''
  filter.type = undefined
  filter.zoneId = undefined
  load()
}

// Images, Documents, and Certificates each get their own modal/target
// (rather than one general-purpose "Manage" catch-all) — distinct,
// self-contained concerns scoped to one property.
const {
  open: showImages,
  target: imagesTarget,
  openWith: openImagesWith
} = useTargetModal<PropertyItem>()
const {
  open: showDocuments,
  target: documentsTarget,
  openWith: openDocumentsWith
} = useTargetModal<PropertyItem>()
const {
  open: showCertificates,
  target: certificatesTarget,
  openWith: openCertificatesWith
} = useTargetModal<PropertyItem>()

// Images
const images = ref<PropertyImage[]>([])
const imagesLoading = ref(false)
const imageUrls = ref<Record<number, string>>({})

async function loadImages() {
  if (!imagesTarget.value) return
  imagesLoading.value = true
  try {
    images.value = await listImages(imagesTarget.value.id)
    for (const url of Object.values(imageUrls.value)) URL.revokeObjectURL(url)
    const urls: Record<number, string> = {}
    for (const img of images.value) {
      urls[img.id] = await getImageUrl(imagesTarget.value.id, img.id)
    }
    imageUrls.value = urls
  } finally {
    imagesLoading.value = false
  }
}

function uploadImageForTarget(file: File, caption?: string, primary?: boolean) {
  return uploadImage(imagesTarget.value!.id, file, caption, primary)
}

const showImageLightbox = ref(false)
const imageLightboxIndex = ref(0)
const imageLightboxItems = computed(() =>
  images.value
    .filter((img) => imageUrls.value[img.id])
    .map((img) => ({ id: img.id, url: imageUrls.value[img.id]!, fileName: img.fileName, caption: img.caption }))
)

function openImageLightbox(imageId: number) {
  const index = imageLightboxItems.value.findIndex((img) => img.id === imageId)
  if (index === -1) return
  imageLightboxIndex.value = index
  showImageLightbox.value = true
}

async function onImageUploaded() {
  toast.add({ title: 'Image uploaded', color: 'success' })
  await loadImages()
}

async function onSetPrimaryImage(img: PropertyImage) {
  if (!imagesTarget.value) return
  try {
    await setPrimaryImage(imagesTarget.value.id, img.id)
    toast.add({ title: 'Primary image updated', color: 'success' })
    await loadImages()
  } catch (err) {
    toast.add({ title: 'Could not set primary image', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteImage(img: PropertyImage) {
  if (!imagesTarget.value) return
  try {
    await removeImage(imagesTarget.value.id, img.id)
    toast.add({ title: 'Image deleted', color: 'success' })
    await loadImages()
  } catch (err) {
    toast.add({ title: 'Could not delete image', description: apiErrorMessage(err), color: 'error' })
  }
}

// Documents
const documents = ref<PropertyDocument[]>([])
const documentsLoading = ref(false)

// Certificates
const certificates = ref<PropertyCertificate[]>([])
const certificatesLoading = ref(false)

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

async function loadCertificates() {
  if (!certificatesTarget.value) return
  certificatesLoading.value = true
  try {
    certificates.value = await listCertificates(certificatesTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load certificates', description: apiErrorMessage(err), color: 'error' })
  } finally {
    certificatesLoading.value = false
  }
}

watch(showImages, (value) => {
  if (value) loadImages()
})
watch(showDocuments, (value) => {
  if (value) loadDocuments()
})
watch(showCertificates, (value) => {
  if (value) loadCertificates()
})

function uploadDocumentForTarget(file: File, description?: string) {
  return uploadDocument(documentsTarget.value!.id, file, description)
}

async function onDocumentUploaded() {
  toast.add({ title: 'Document uploaded', color: 'success' })
  await loadDocuments()
}

async function onDeleteDocument(doc: PropertyDocument) {
  if (!documentsTarget.value) return
  try {
    await removeDocument(documentsTarget.value.id, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments()
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadDocument(doc: PropertyDocument) {
  if (!documentsTarget.value) return
  try {
    await downloadDocument(documentsTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

function uploadCertificateForTarget(file: File, description?: string) {
  return uploadCertificate(certificatesTarget.value!.id, file, description)
}

async function onCertificateUploaded() {
  toast.add({ title: 'Certificate uploaded', color: 'success' })
  await loadCertificates()
}

async function onDeleteCertificate(cert: PropertyCertificate) {
  if (!certificatesTarget.value) return
  try {
    await removeCertificate(certificatesTarget.value.id, cert.id)
    toast.add({ title: 'Certificate deleted', color: 'success' })
    await loadCertificates()
  } catch (err) {
    toast.add({ title: 'Could not delete certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadCertificate(cert: PropertyCertificate) {
  if (!certificatesTarget.value) return
  try {
    await downloadCertificate(certificatesTarget.value.id, cert.id, cert.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

function propertyActions(row: PropertyItem): RowAction[] {
  return [
    { label: 'Overview', icon: 'i-lucide-eye', onClick: () => navigateTo(`/properties/${row.id}`) },
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openEdit(row) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) },
    { label: 'Buildings', icon: 'i-lucide-building-2', onClick: () => navigateTo(`/buildings?propertyId=${row.id}`) },
    { label: 'Images', icon: 'i-lucide-image', onClick: () => openImagesWith(row) },
    { label: 'Documents', icon: 'i-lucide-folder', onClick: () => openDocumentsWith(row) },
    { label: 'Certificates', icon: 'i-lucide-award', onClick: () => openCertificatesWith(row) }
  ]
}
</script>

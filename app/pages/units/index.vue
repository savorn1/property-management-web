<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Units</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New unit</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect
          v-model="filter.unitTypeId"
          :items="unitTypeFilterOptions"
          placeholder="Unit type"
          class="w-56"
        />
        <USelect
          v-model="filter.status"
          :items="statusFilterOptions"
          placeholder="Status"
          class="w-40"
        />
        <UInput
          v-model="filter.unitNumber"
          placeholder="Unit number"
          icon="i-lucide-search"
          class="w-44"
          @keyup.enter="load"
        />
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
        export-filename="units"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw-off"
              @click="openStatusWith(row)"
            >
              Status
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
              Edit
            </UButton>
            <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = row">
              Delete
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-settings-2" @click="openManageWith(row)">
              Manage
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No units match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-door-open" title="No units yet" description="Add the first unit to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New unit</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New unit">
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

    <UModal v-model:open="showEdit" :title="`Edit unit '${editingRow?.unitNumber ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showStatus" :title="`Update status for unit '${statusTarget?.unitNumber ?? ''}'`">
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

    <UModal
      v-model:open="showManage"
      :title="`Manage unit '${manageTarget?.unitNumber ?? ''}'`"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="max-h-[70vh] overflow-y-auto space-y-6 pr-1">
          <!-- Amenities -->
          <div>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Amenities
            </h3>
            <div v-if="amenitiesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitAmenities.length === 0" class="text-sm text-gray-400 mb-3">No amenities assigned.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="a in unitAmenities"
                :key="a.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ a.amenityName }}
                  <span v-if="a.amenityCategory" class="text-gray-400">({{ a.amenityCategory }})</span>
                  <span v-if="a.notes" class="text-gray-400"> — {{ a.notes }}</span>
                </span>
                <UButton
                  v-if="isAdmin"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="onRemoveAmenity(a)"
                />
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="assignAmenityForm"
              :fields="assignAmenityFields"
              :loading="assigningAmenity"
              :error="assignAmenityError"
              submit-label="Assign"
              @submit="onAssignAmenity"
            />
          </div>

          <!-- Images -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Images
            </h3>
            <div v-if="imagesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitImages.length === 0" class="text-sm text-gray-400 mb-3">No images uploaded yet.</div>
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
              <div v-for="img in unitImages" :key="img.id" class="relative group">
                <img
                  v-if="imageUrls[img.id]"
                  :src="imageUrls[img.id]"
                  :alt="img.caption ?? img.fileName"
                  class="w-full h-20 object-cover rounded border border-gray-200 dark:border-gray-800"
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

            <div v-if="isAdmin" class="space-y-3">
              <input ref="imageFileInput" type="file" accept="image/*" class="text-sm" @change="onImageFileChange">
              <UInput v-model="imageCaption" placeholder="Caption (optional)" class="w-full" />
              <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input v-model="imagePrimary" type="checkbox">
                Set as primary
              </label>
              <UAlert v-if="imageUploadError" color="error" variant="subtle" :title="imageUploadError" />
              <UButton :loading="uploadingImage" :disabled="!selectedImageFile" icon="i-lucide-upload" @click="onUploadImage">
                Upload
              </UButton>
            </div>
          </div>

          <!-- Certificates -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Certificates
            </h3>
            <div v-if="certificatesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitCertificates.length === 0" class="text-sm text-gray-400 mb-3">No certificates uploaded yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="c in unitCertificates"
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
              <input ref="certificateFileInput" type="file" class="text-sm" @change="onCertificateFileChange">
              <UInput v-model="certificateDescription" placeholder="Description (optional)" class="w-full" />
              <UAlert v-if="certificateUploadError" color="error" variant="subtle" :title="certificateUploadError" />
              <UButton :loading="uploadingCertificate" :disabled="!selectedCertificateFile" icon="i-lucide-upload" @click="onUploadCertificate">
                Upload
              </UButton>
            </div>
          </div>

          <!-- Documents -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Documents
            </h3>
            <div v-if="documentsLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitDocuments.length === 0" class="text-sm text-gray-400 mb-3">No documents uploaded yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="d in unitDocuments"
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
              <input ref="documentFileInput" type="file" class="text-sm" @change="onDocumentFileChange">
              <UInput v-model="documentDescription" placeholder="Description (optional)" class="w-full" />
              <UAlert v-if="documentUploadError" color="error" variant="subtle" :title="documentUploadError" />
              <UButton :loading="uploadingDocument" :disabled="!selectedDocumentFile" icon="i-lucide-upload" @click="onUploadDocument">
                Upload
              </UButton>
            </div>
          </div>

          <!-- Ownership history -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Ownership history
            </h3>
            <div v-if="ownersLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitOwners.length === 0" class="text-sm text-gray-400 mb-3">No ownership records yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="o in unitOwners"
                :key="o.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ o.ownerName }}
                  <span v-if="o.ownerContact" class="text-gray-400">({{ o.ownerContact }})</span>
                  <span class="text-gray-400"> · {{ formatDate(o.ownershipStartDate) }} – {{ o.ownershipEndDate ? formatDate(o.ownershipEndDate) : 'present' }}</span>
                  <StatusBadge v-if="o.current" status="CURRENT" class="ml-1" />
                </span>
                <UButton
                  v-if="isAdmin && o.current"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-square-x"
                  :loading="endingOwnerId === o.id"
                  @click="onEndOwnership(o)"
                >
                  End
                </UButton>
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="addOwnerForm"
              :fields="addOwnerFields"
              :loading="addingOwner"
              :error="addOwnerError"
              submit-label="Add owner"
              @submit="onAddOwner"
            />
          </div>

          <!-- Price history -->
          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Price history
            </h3>
            <div v-if="pricesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="unitPrices.length === 0" class="text-sm text-gray-400 mb-3">No prices recorded yet.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="p in unitPrices"
                :key="p.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ formatEnum(p.priceType) }} · {{ formatDate(p.effectiveDate) }}
                  <span v-if="p.notes" class="text-gray-400"> — {{ p.notes }}</span>
                </span>
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(p.amount) }}</span>
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="addPriceForm"
              :fields="addPriceFields"
              :loading="addingPrice"
              :error="addPriceError"
              submit-label="Record price"
              @submit="onAddPrice"
            />
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete unit"
      :description="`Delete unit '${confirmDelete?.unitNumber ?? ''}'? This cannot be undone.`"
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
import type { CreateUnitPayload, Unit, UnitStatus, UpdateUnitPayload } from '~/composables/useUnits'
import type { UnitAmenity } from '~/composables/useUnitAmenities'
import type { UnitImage } from '~/composables/useUnitImages'
import type { UnitCertificate } from '~/composables/useUnitCertificates'
import type { UnitDocument } from '~/composables/useUnitDocuments'
import type { UnitOwner } from '~/composables/useUnitOwners'
import type { PriceType, UnitPrice } from '~/composables/useUnitPrices'

const route = useRoute()
const { isAdmin } = useAuth()
const { list, create, update, updateStatus, remove } = useUnits()
const { list: listUnitTypes } = useUnitTypes()
const { list: listAmenities } = useAmenities()
const { list: listUnitAmenities, assign: assignUnitAmenity, remove: removeUnitAmenity } = useUnitAmenities()
const {
  list: listUnitImages,
  upload: uploadUnitImage,
  setPrimary: setPrimaryUnitImage,
  remove: removeUnitImage,
  getObjectUrl: getUnitImageUrl
} = useUnitImages()
const {
  list: listUnitCertificates,
  upload: uploadUnitCertificate,
  remove: removeUnitCertificate,
  download: downloadUnitCertificate
} = useUnitCertificates()
const {
  list: listUnitDocuments,
  upload: uploadUnitDocument,
  remove: removeUnitDocument,
  download: downloadUnitDocument
} = useUnitDocuments()
const { list: listUnitOwners, create: createUnitOwner, end: endUnitOwner } = useUnitOwners()
const { list: listUnitPrices, create: createUnitPrice } = useUnitPrices()
const toast = useToast()

const rows = ref<Unit[]>([])
const loading = ref(false)
const error = ref('')

const initialUnitTypeId = Number(route.query.unitTypeId) || undefined
const initialStatus = (route.query.status as UnitStatus | undefined) || undefined
const filter = reactive<{ unitTypeId: number | undefined; status: UnitStatus | undefined; unitNumber: string }>({
  unitTypeId: initialUnitTypeId,
  status: initialStatus,
  unitNumber: ''
})

const unitTypeOptions = ref<{ label: string; value: number }[]>([])
const unitTypeFilterOptions = computed(() => [{ label: 'All unit types', value: undefined }, ...unitTypeOptions.value])

const STATUS_OPTIONS: { label: string; value: UnitStatus }[] = [
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Occupied', value: 'OCCUPIED' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Unavailable', value: 'UNAVAILABLE' },
  { label: 'Sold', value: 'SOLD' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

async function loadUnitTypeOptions() {
  const res = await listUnitTypes({ size: 200 })
  unitTypeOptions.value = res.data.map((t) => ({
    label: `${t.buildingName ?? 'Building'} — ${t.name}`,
    value: t.id
  }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'unitNumber',
  direction: 'asc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Unit>[] = [
  { key: 'unitNumber', label: 'Unit #', sortable: true },
  { key: 'unitTypeName', label: 'Unit type', value: (row) => row.unitTypeName ?? '—' },
  { key: 'buildingName', label: 'Building', value: (row) => row.buildingName ?? '—' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      unitTypeId: filter.unitTypeId,
      status: filter.status,
      unitNumber: filter.unitNumber || undefined,
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

const createFields = computed<FieldDef[]>(() => [
  { name: 'unitTypeId', label: 'Unit type', type: 'select', required: true, options: unitTypeOptions.value },
  { name: 'unitNumber', label: 'Unit number', required: true },
  { name: 'status', type: 'select', options: STATUS_OPTIONS, default: 'AVAILABLE' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields: FieldDef[] = [
  { name: 'unitNumber', label: 'Unit number', required: true },
  { name: 'description', type: 'textarea', wrapper: 'full' }
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
} = useCrudModals<Unit, CreateUnitPayload, UpdateUnitPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Unit',
    createDefaults: () => ({ unitTypeId: filter.unitTypeId, status: 'AVAILABLE' }),
    toForm: (row) => ({
      unitNumber: row.unitNumber,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      unitTypeId: values.unitTypeId,
      unitNumber: values.unitNumber,
      status: values.status,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      unitNumber: values.unitNumber,
      description: values.description || undefined
    })
  }
)

const {
  open: showStatus,
  target: statusTarget,
  loading: statusLoading,
  error: statusError,
  openWith: openStatusWith
} = useTargetModal<Unit>()

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
    toast.add({ title: 'Unit status updated', color: 'success' })
    await load()
  } catch (err) {
    statusError.value = apiErrorMessage(err)
  } finally {
    statusLoading.value = false
  }
}

onMounted(async () => {
  await loadUnitTypeOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.unitTypeId, filter.status], load)

const hasActiveFilter = computed(
  () => filter.unitTypeId !== undefined || filter.status !== undefined || filter.unitNumber !== ''
)

function clearFilters() {
  filter.unitTypeId = undefined
  filter.status = undefined
  filter.unitNumber = ''
  load()
}

// ── Manage modal — 6 nested sub-resource sections ──────────────────────────
const { open: showManage, target: manageTarget, openWith: openManageWith } = useTargetModal<Unit>()

// Amenities
const unitAmenities = ref<UnitAmenity[]>([])
const amenitiesLoading = ref(false)
const amenityOptions = ref<{ label: string; value: number }[]>([])
const assignAmenityForm = ref<Record<string, any>>({})
const assigningAmenity = ref(false)
const assignAmenityError = ref('')
const assignAmenityFields = computed<FieldDef[]>(() => [
  { name: 'amenityId', label: 'Amenity', type: 'select', required: true, options: amenityOptions.value },
  { name: 'notes' }
])

async function loadAmenitiesSection(unitId: number) {
  amenitiesLoading.value = true
  try {
    unitAmenities.value = await listUnitAmenities(unitId)
  } finally {
    amenitiesLoading.value = false
  }
}

async function onAssignAmenity(values: Record<string, any>) {
  if (!manageTarget.value) return
  assigningAmenity.value = true
  assignAmenityError.value = ''
  try {
    await assignUnitAmenity(manageTarget.value.id, { amenityId: values.amenityId, notes: values.notes || undefined })
    assignAmenityForm.value = {}
    toast.add({ title: 'Amenity assigned', color: 'success' })
    await loadAmenitiesSection(manageTarget.value.id)
  } catch (err) {
    assignAmenityError.value = apiErrorMessage(err)
  } finally {
    assigningAmenity.value = false
  }
}

async function onRemoveAmenity(row: UnitAmenity) {
  if (!manageTarget.value) return
  try {
    await removeUnitAmenity(manageTarget.value.id, row.id)
    toast.add({ title: 'Amenity removed', color: 'success' })
    await loadAmenitiesSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not remove amenity', description: apiErrorMessage(err), color: 'error' })
  }
}

// Images
const unitImages = ref<UnitImage[]>([])
const imagesLoading = ref(false)
const imageUrls = ref<Record<number, string>>({})
const imageFileInput = ref<HTMLInputElement | null>(null)
const selectedImageFile = ref<File | null>(null)
const imageCaption = ref('')
const imagePrimary = ref(false)
const uploadingImage = ref(false)
const imageUploadError = ref('')

function onImageFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  selectedImageFile.value = files && files.length > 0 ? files[0]! : null
}

async function loadImagesSection(unitId: number) {
  imagesLoading.value = true
  try {
    unitImages.value = await listUnitImages(unitId)
    for (const url of Object.values(imageUrls.value)) URL.revokeObjectURL(url)
    const urls: Record<number, string> = {}
    for (const img of unitImages.value) {
      urls[img.id] = await getUnitImageUrl(unitId, img.id)
    }
    imageUrls.value = urls
  } finally {
    imagesLoading.value = false
  }
}

async function onUploadImage() {
  if (!manageTarget.value || !selectedImageFile.value) return
  uploadingImage.value = true
  imageUploadError.value = ''
  try {
    await uploadUnitImage(manageTarget.value.id, selectedImageFile.value, imageCaption.value || undefined, imagePrimary.value)
    selectedImageFile.value = null
    imageCaption.value = ''
    imagePrimary.value = false
    if (imageFileInput.value) imageFileInput.value.value = ''
    toast.add({ title: 'Image uploaded', color: 'success' })
    await loadImagesSection(manageTarget.value.id)
  } catch (err) {
    imageUploadError.value = apiErrorMessage(err)
  } finally {
    uploadingImage.value = false
  }
}

async function onSetPrimaryImage(img: UnitImage) {
  if (!manageTarget.value) return
  try {
    await setPrimaryUnitImage(manageTarget.value.id, img.id)
    toast.add({ title: 'Primary image updated', color: 'success' })
    await loadImagesSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not set primary image', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteImage(img: UnitImage) {
  if (!manageTarget.value) return
  try {
    await removeUnitImage(manageTarget.value.id, img.id)
    toast.add({ title: 'Image deleted', color: 'success' })
    await loadImagesSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete image', description: apiErrorMessage(err), color: 'error' })
  }
}

// Certificates
const unitCertificates = ref<UnitCertificate[]>([])
const certificatesLoading = ref(false)
const certificateFileInput = ref<HTMLInputElement | null>(null)
const selectedCertificateFile = ref<File | null>(null)
const certificateDescription = ref('')
const uploadingCertificate = ref(false)
const certificateUploadError = ref('')

function onCertificateFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  selectedCertificateFile.value = files && files.length > 0 ? files[0]! : null
}

async function loadCertificatesSection(unitId: number) {
  certificatesLoading.value = true
  try {
    unitCertificates.value = await listUnitCertificates(unitId)
  } finally {
    certificatesLoading.value = false
  }
}

async function onUploadCertificate() {
  if (!manageTarget.value || !selectedCertificateFile.value) return
  uploadingCertificate.value = true
  certificateUploadError.value = ''
  try {
    await uploadUnitCertificate(manageTarget.value.id, selectedCertificateFile.value, certificateDescription.value || undefined)
    selectedCertificateFile.value = null
    certificateDescription.value = ''
    if (certificateFileInput.value) certificateFileInput.value.value = ''
    toast.add({ title: 'Certificate uploaded', color: 'success' })
    await loadCertificatesSection(manageTarget.value.id)
  } catch (err) {
    certificateUploadError.value = apiErrorMessage(err)
  } finally {
    uploadingCertificate.value = false
  }
}

async function onDownloadCertificate(c: UnitCertificate) {
  if (!manageTarget.value) return
  try {
    await downloadUnitCertificate(manageTarget.value.id, c.id, c.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteCertificate(c: UnitCertificate) {
  if (!manageTarget.value) return
  try {
    await removeUnitCertificate(manageTarget.value.id, c.id)
    toast.add({ title: 'Certificate deleted', color: 'success' })
    await loadCertificatesSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

// Documents
const unitDocuments = ref<UnitDocument[]>([])
const documentsLoading = ref(false)
const documentFileInput = ref<HTMLInputElement | null>(null)
const selectedDocumentFile = ref<File | null>(null)
const documentDescription = ref('')
const uploadingDocument = ref(false)
const documentUploadError = ref('')

function onDocumentFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  selectedDocumentFile.value = files && files.length > 0 ? files[0]! : null
}

async function loadDocumentsSection(unitId: number) {
  documentsLoading.value = true
  try {
    unitDocuments.value = await listUnitDocuments(unitId)
  } finally {
    documentsLoading.value = false
  }
}

async function onUploadDocument() {
  if (!manageTarget.value || !selectedDocumentFile.value) return
  uploadingDocument.value = true
  documentUploadError.value = ''
  try {
    await uploadUnitDocument(manageTarget.value.id, selectedDocumentFile.value, documentDescription.value || undefined)
    selectedDocumentFile.value = null
    documentDescription.value = ''
    if (documentFileInput.value) documentFileInput.value.value = ''
    toast.add({ title: 'Document uploaded', color: 'success' })
    await loadDocumentsSection(manageTarget.value.id)
  } catch (err) {
    documentUploadError.value = apiErrorMessage(err)
  } finally {
    uploadingDocument.value = false
  }
}

async function onDownloadDocument(d: UnitDocument) {
  if (!manageTarget.value) return
  try {
    await downloadUnitDocument(manageTarget.value.id, d.id, d.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteDocument(d: UnitDocument) {
  if (!manageTarget.value) return
  try {
    await removeUnitDocument(manageTarget.value.id, d.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocumentsSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

// Ownership history
const unitOwners = ref<UnitOwner[]>([])
const ownersLoading = ref(false)
const addOwnerForm = ref<Record<string, any>>({})
const addingOwner = ref(false)
const addOwnerError = ref('')
const endingOwnerId = ref<number | null>(null)
const addOwnerFields: FieldDef[] = [
  { name: 'ownerName', label: 'Owner name', required: true },
  { name: 'ownerContact', label: 'Contact' },
  { name: 'ownershipStartDate', label: 'Start date', type: 'date', required: true },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

async function loadOwnersSection(unitId: number) {
  ownersLoading.value = true
  try {
    unitOwners.value = await listUnitOwners(unitId)
  } finally {
    ownersLoading.value = false
  }
}

async function onAddOwner(values: Record<string, any>) {
  if (!manageTarget.value) return
  addingOwner.value = true
  addOwnerError.value = ''
  try {
    await createUnitOwner(manageTarget.value.id, {
      ownerName: values.ownerName,
      ownerContact: values.ownerContact || undefined,
      ownershipStartDate: values.ownershipStartDate,
      notes: values.notes || undefined
    })
    addOwnerForm.value = {}
    toast.add({ title: 'Owner added', color: 'success' })
    await loadOwnersSection(manageTarget.value.id)
  } catch (err) {
    addOwnerError.value = apiErrorMessage(err)
  } finally {
    addingOwner.value = false
  }
}

async function onEndOwnership(o: UnitOwner) {
  if (!manageTarget.value) return
  endingOwnerId.value = o.id
  try {
    await endUnitOwner(manageTarget.value.id, o.id)
    toast.add({ title: 'Ownership ended', color: 'success' })
    await loadOwnersSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not end ownership', description: apiErrorMessage(err), color: 'error' })
  } finally {
    endingOwnerId.value = null
  }
}

// Price history
const unitPrices = ref<UnitPrice[]>([])
const pricesLoading = ref(false)
const addPriceForm = ref<Record<string, any>>({})
const addingPrice = ref(false)
const addPriceError = ref('')
const PRICE_TYPE_OPTIONS: { label: string; value: PriceType }[] = [
  { label: 'Rent', value: 'RENT' },
  { label: 'Sale', value: 'SALE' }
]
const addPriceFields: FieldDef[] = [
  { name: 'priceType', label: 'Price type', type: 'select', required: true, options: PRICE_TYPE_OPTIONS },
  { name: 'amount', type: 'currency', required: true },
  { name: 'effectiveDate', label: 'Effective date', type: 'date', required: true },
  { name: 'notes', type: 'textarea', wrapper: 'full' }
]

async function loadPricesSection(unitId: number) {
  pricesLoading.value = true
  try {
    unitPrices.value = await listUnitPrices(unitId)
  } finally {
    pricesLoading.value = false
  }
}

async function onAddPrice(values: Record<string, any>) {
  if (!manageTarget.value) return
  addingPrice.value = true
  addPriceError.value = ''
  try {
    await createUnitPrice(manageTarget.value.id, {
      priceType: values.priceType,
      amount: values.amount,
      effectiveDate: values.effectiveDate,
      notes: values.notes || undefined
    })
    addPriceForm.value = {}
    toast.add({ title: 'Price recorded', color: 'success' })
    await loadPricesSection(manageTarget.value.id)
  } catch (err) {
    addPriceError.value = apiErrorMessage(err)
  } finally {
    addingPrice.value = false
  }
}

watch(showManage, async (value) => {
  if (!value || !manageTarget.value) return
  const unitId = manageTarget.value.id

  assignAmenityForm.value = {}
  assignAmenityError.value = ''
  selectedImageFile.value = null
  imageCaption.value = ''
  imagePrimary.value = false
  imageUploadError.value = ''
  selectedCertificateFile.value = null
  certificateDescription.value = ''
  certificateUploadError.value = ''
  selectedDocumentFile.value = null
  documentDescription.value = ''
  documentUploadError.value = ''
  addOwnerForm.value = {}
  addOwnerError.value = ''
  addPriceForm.value = {}
  addPriceError.value = ''

  const amenitiesRes = await listAmenities({ size: 200 })
  amenityOptions.value = amenitiesRes.data.map((a) => ({ label: a.name, value: a.id }))

  await Promise.all([
    loadAmenitiesSection(unitId),
    loadImagesSection(unitId),
    loadCertificatesSection(unitId),
    loadDocumentsSection(unitId),
    loadOwnersSection(unitId),
    loadPricesSection(unitId)
  ])
})
</script>

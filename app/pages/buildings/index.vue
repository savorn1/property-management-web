<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Buildings</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New building</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <USelect
          v-model="filter.propertyId"
          :items="propertyFilterOptions"
          placeholder="Property"
          class="w-56"
        />
        <UInput
          v-model="filter.name"
          placeholder="Search name"
          icon="i-lucide-search"
          class="w-56"
          @keyup.enter="load"
        />
        <USelect v-model="filter.status" :items="statusFilterOptions" placeholder="Status" class="w-44" />
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
        export-filename="buildings"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
        @select="(row) => navigateTo(`/floors?buildingId=${row.id}`)"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-layers"
              @click.stop="navigateTo(`/floors?buildingId=${row.id}`)"
            >
              Floors
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-settings-2" @click.stop="openManageWith(row)">
              Manage
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-pencil" @click.stop="openEdit(row)">
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
            title="No buildings match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-building-2" title="No buildings yet" description="Add the first building to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New building</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <UModal v-model:open="showCreate" title="New building">
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

    <UModal v-model:open="showEdit" :title="`Edit building '${editingRow?.name ?? ''}'`">
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

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete building"
      :description="`Delete building '${confirmDelete?.name ?? ''}'? This cannot be undone.`"
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
              Facilities
            </h3>
            <div v-if="facilitiesLoading" class="text-sm text-gray-400">Loading…</div>
            <div v-else-if="facilities.length === 0" class="text-sm text-gray-400 mb-3">No facilities assigned.</div>
            <div v-else class="space-y-1.5 mb-4">
              <div
                v-for="f in facilities"
                :key="f.id"
                class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
              >
                <span class="text-gray-600 dark:text-gray-300">
                  {{ f.amenityName }}
                  <span v-if="f.amenityCategory" class="text-gray-400">({{ f.amenityCategory }})</span>
                  <span v-if="f.notes" class="text-gray-400"> — {{ f.notes }}</span>
                </span>
                <UButton
                  v-if="isAdmin"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="onRemoveFacility(f)"
                />
              </div>
            </div>
            <DynamicForm
              v-if="isAdmin"
              v-model="assignFacilityForm"
              :fields="assignFacilityFields"
              :loading="assigningFacility"
              :error="assignFacilityError"
              submit-label="Assign"
              @submit="onAssignFacility"
            />
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
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
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { Building, BuildingStatus, CreateBuildingPayload, UpdateBuildingPayload } from '~/composables/useBuildings'
import type { BuildingFacility } from '~/composables/useBuildingFacilities'
import type { BuildingDocument } from '~/composables/useBuildingDocuments'

const route = useRoute()
const { list, create, update, remove } = useBuildings()
const { list: listProperties } = useProperties()
const { list: listAmenities } = useAmenities()
const { list: listFacilities, assign: assignFacility, remove: removeFacility } = useBuildingFacilities()
const {
  list: listDocuments,
  upload: uploadDocument,
  remove: removeDocument,
  download: downloadDocument
} = useBuildingDocuments()
const { isAdmin } = useAuth()
const toast = useToast()

const rows = ref<Building[]>([])
const loading = ref(false)
const error = ref('')

const initialPropertyId = Number(route.query.propertyId) || undefined
const initialStatus = (route.query.status as BuildingStatus | undefined) || undefined
const filter = reactive<{ propertyId: number | undefined; name: string; status: BuildingStatus | undefined }>({
  propertyId: initialPropertyId,
  name: '',
  status: initialStatus
})

const STATUS_OPTIONS: { label: string; value: BuildingStatus }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Under construction', value: 'UNDER_CONSTRUCTION' },
  { label: 'Renovation', value: 'RENOVATION' },
  { label: 'Inactive', value: 'INACTIVE' }
]
const statusFilterOptions = [{ label: 'All statuses', value: undefined }, ...STATUS_OPTIONS]

const propertyOptions = ref<{ label: string; value: number }[]>([])
const propertyFilterOptions = computed(() => [{ label: 'All properties', value: undefined }, ...propertyOptions.value])

async function loadPropertyOptions() {
  const res = await listProperties({ size: 200 })
  propertyOptions.value = res.data.map((p) => ({ label: p.name, value: p.id }))
}

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows } = useClientTable(rows, { pageSize: 10 })

const columns: ColumnDef<Building>[] = [
  { key: 'name', sortable: true },
  { key: 'propertyName', label: 'Property', value: (row) => row.propertyName ?? '—' },
  { key: 'code', value: (row) => row.code ?? '—' },
  { key: 'totalFloors', label: 'Total floors', value: (row) => row.totalFloors ?? '—' },
  { key: 'status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      propertyId: filter.propertyId,
      name: filter.name || undefined,
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

const createFields = computed<FieldDef[]>(() => [
  { name: 'propertyId', label: 'Property', type: 'select', required: true, options: propertyOptions.value },
  { name: 'name', required: true },
  { name: 'code', wrapper: 'half' },
  { name: 'status', type: 'select', options: STATUS_OPTIONS, wrapper: 'half' },
  { name: 'totalFloors', label: 'Total floors', type: 'number', min: 0, wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields: FieldDef[] = [
  { name: 'name', required: true },
  { name: 'code', wrapper: 'half' },
  { name: 'status', type: 'select', options: STATUS_OPTIONS, wrapper: 'half' },
  { name: 'totalFloors', label: 'Total floors', type: 'number', min: 0, wrapper: 'half' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
]

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate: openCreateModal,
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
} = useCrudModals<Building, CreateBuildingPayload, UpdateBuildingPayload>(
  {
    create: (payload) => create(payload),
    update: (row, payload) => update(row.id, payload),
    remove: (row) => remove(row.id)
  },
  load,
  {
    entityName: 'Building',
    createDefaults: () => ({ propertyId: filter.propertyId }),
    toForm: (row) => ({
      name: row.name,
      code: row.code ?? '',
      status: row.status ?? undefined,
      totalFloors: row.totalFloors ?? undefined,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      propertyId: values.propertyId,
      name: values.name,
      code: values.code || undefined,
      status: values.status || undefined,
      totalFloors: values.totalFloors,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      name: values.name,
      code: values.code || undefined,
      status: values.status || undefined,
      totalFloors: values.totalFloors,
      description: values.description || undefined
    })
  }
)

function openCreate() {
  openCreateModal()
}

// Facilities — a Building's own list of assigned Amenity catalog items
// (see useBuildingFacilities.ts), separate from any per-unit UnitAmenity.
const { open: showManage, target: manageTarget, openWith: openManageWith } = useTargetModal<Building>()
const facilities = ref<BuildingFacility[]>([])
const facilitiesLoading = ref(false)
const amenityOptions = ref<{ label: string; value: number }[]>([])
const assignFacilityForm = ref<Record<string, any>>({})
const assigningFacility = ref(false)
const assignFacilityError = ref('')
const assignFacilityFields = computed<FieldDef[]>(() => [
  { name: 'amenityId', label: 'Amenity', type: 'select', required: true, options: amenityOptions.value },
  { name: 'notes' }
])

async function loadFacilitiesSection(buildingId: number) {
  facilitiesLoading.value = true
  try {
    facilities.value = await listFacilities(buildingId)
  } finally {
    facilitiesLoading.value = false
  }
}

async function onAssignFacility(values: Record<string, any>) {
  if (!manageTarget.value) return
  assigningFacility.value = true
  assignFacilityError.value = ''
  try {
    await assignFacility(manageTarget.value.id, { amenityId: values.amenityId, notes: values.notes || undefined })
    assignFacilityForm.value = {}
    toast.add({ title: 'Facility assigned', color: 'success' })
    await loadFacilitiesSection(manageTarget.value.id)
  } catch (err) {
    assignFacilityError.value = apiErrorMessage(err)
  } finally {
    assigningFacility.value = false
  }
}

async function onRemoveFacility(row: BuildingFacility) {
  if (!manageTarget.value) return
  try {
    await removeFacility(manageTarget.value.id, row.id)
    toast.add({ title: 'Facility removed', color: 'success' })
    await loadFacilitiesSection(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not remove facility', description: apiErrorMessage(err), color: 'error' })
  }
}

// Documents — mirrors properties/index.vue's Documents section.
const documents = ref<BuildingDocument[]>([])
const documentsLoading = ref(false)
const selectedDocumentFile = ref<File | null>(null)
const documentUploadDescription = ref('')
const documentUploading = ref(false)
const documentUploadError = ref('')
const documentFileInput = ref<HTMLInputElement | null>(null)

async function loadDocuments(buildingId: number) {
  documentsLoading.value = true
  try {
    documents.value = await listDocuments(buildingId)
  } catch (err) {
    toast.add({ title: 'Could not load documents', description: apiErrorMessage(err), color: 'error' })
  } finally {
    documentsLoading.value = false
  }
}

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
    await loadDocuments(manageTarget.value.id)
  } catch (err) {
    documentUploadError.value = apiErrorMessage(err)
  } finally {
    documentUploading.value = false
  }
}

async function onDeleteDocument(doc: BuildingDocument) {
  if (!manageTarget.value) return
  try {
    await removeDocument(manageTarget.value.id, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments(manageTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadDocument(doc: BuildingDocument) {
  if (!manageTarget.value) return
  try {
    await downloadDocument(manageTarget.value.id, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

watch(showManage, async (value) => {
  if (!value || !manageTarget.value) return
  const buildingId = manageTarget.value.id

  assignFacilityForm.value = {}
  assignFacilityError.value = ''
  selectedDocumentFile.value = null
  documentUploadDescription.value = ''
  documentUploadError.value = ''

  const amenitiesRes = await listAmenities({ size: 200 })
  amenityOptions.value = amenitiesRes.data.map((a) => ({ label: a.name, value: a.id }))

  await Promise.all([loadFacilitiesSection(buildingId), loadDocuments(buildingId)])
})

onMounted(async () => {
  await loadPropertyOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.propertyId, filter.status], load)

const hasActiveFilter = computed(() => filter.propertyId !== undefined || filter.name !== '' || filter.status !== undefined)

function clearFilters() {
  filter.propertyId = undefined
  filter.name = ''
  filter.status = undefined
  load()
}
</script>

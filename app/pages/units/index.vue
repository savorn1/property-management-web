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
          v-model="filter.occupancyStatus"
          :items="occupancyStatusFilterOptions"
          placeholder="Occupancy"
          class="w-40"
        />
        <USelect
          v-model="filter.saleStatus"
          :items="saleStatusFilterOptions"
          placeholder="Sale status"
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
        <!-- Each status column doubles as its own edit trigger — clicking the
             badge opens the same modal the old dedicated button did, so the
             actions column doesn't carry three buttons that just duplicate
             the label already shown in the row. -->
        <template #occupancyStatus-data="{ row }">
          <button
            type="button"
            class="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            title="Change occupancy status"
            @click="openOccupancyStatusWith(row)"
          >
            <StatusBadge v-if="row.occupancyStatus" :status="row.occupancyStatus" />
            <span v-else class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Set —</span>
          </button>
        </template>
        <template #saleStatus-data="{ row }">
          <button
            type="button"
            class="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            title="Change sale status"
            @click="openSaleStatusWith(row)"
          >
            <StatusBadge v-if="row.saleStatus" :status="row.saleStatus" />
            <span v-else class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Set —</span>
          </button>
        </template>
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-pencil" @click="openEdit(row)">
              Edit
            </UButton>
            <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = row">
              Delete
            </UButton>
            <UDropdownMenu :items="rowActionItems(row)">
              <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-ellipsis" />
            </UDropdownMenu>
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

    <UModal v-model:open="showOccupancyStatus" :title="`Update occupancy status for unit '${occupancyStatusTarget?.unitNumber ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="occupancyStatusForm"
          :fields="occupancyStatusFields"
          :loading="occupancyStatusLoading"
          :error="occupancyStatusError"
          submit-label="Update"
          cancelable
          @submit="onOccupancyStatusSubmit"
          @cancel="showOccupancyStatus = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showSaleStatus" :title="`Update sale status for unit '${saleStatusTarget?.unitNumber ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="saleStatusForm"
          :fields="saleStatusFields"
          :loading="saleStatusLoading"
          :error="saleStatusError"
          submit-label="Update"
          cancelable
          @submit="onSaleStatusSubmit"
          @cancel="showSaleStatus = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showAmenities"
      :title="`Amenities · ${amenitiesTarget?.unitNumber ?? ''}`"
    >
      <template #body>
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
      </template>
    </UModal>

    <UModal
      v-model:open="showOwnership"
      :title="`Ownership history · ${ownershipTarget?.unitNumber ?? ''}`"
    >
      <template #body>
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
      </template>
    </UModal>

    <UModal
      v-model:open="showPriceHistory"
      :title="`Price history · ${priceHistoryTarget?.unitNumber ?? ''}`"
    >
      <template #body>
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
      </template>
    </UModal>

    <UModal
      v-model:open="showStatusHistory"
      :title="`Status history · ${statusHistoryTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <div v-if="statusHistoryLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="statusHistory.length === 0" class="text-sm text-gray-400">No status changes recorded yet.</div>
        <div v-else class="space-y-1.5">
          <div
            v-for="h in statusHistory"
            :key="h.id"
            class="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
          >
            <span class="text-gray-600 dark:text-gray-300">
              {{ formatEnum(h.statusField) }}: {{ h.previousStatus ? formatEnum(h.previousStatus) : '—' }} → {{ formatEnum(h.newStatus) }}
              <span v-if="h.reason" class="text-gray-400"> — {{ h.reason }}</span>
              <div class="text-xs text-gray-400">{{ formatDateTime(h.createdAt) }} · {{ h.changedBy ?? '—' }}</div>
            </span>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showImages"
      :title="`Images · ${imagesTarget?.unitNumber ?? ''}`"
    >
      <template #body>
        <div v-if="imagesLoading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="unitImages.length === 0" class="text-sm text-gray-400 mb-3">No images uploaded yet.</div>
        <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          <div v-for="img in unitImages" :key="img.id" class="relative group">
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

    <UModal
      v-model:open="showCertificates"
      :title="`Certificates · ${certificatesTarget?.unitNumber ?? ''}`"
    >
      <template #body>
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

        <FileUploadField v-if="isAdmin" :upload="uploadCertificateForTarget" @uploaded="onCertificateUploaded" />
      </template>
    </UModal>

    <UModal
      v-model:open="showDocuments"
      :title="`Documents · ${documentsTarget?.unitNumber ?? ''}`"
    >
      <template #body>
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

        <FileUploadField v-if="isAdmin" :upload="uploadDocumentForTarget" @uploaded="onDocumentUploaded" />
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
import type {
  CreateUnitPayload,
  OccupancyStatus,
  SaleStatus,
  Unit,
  UnitStatusHistoryEntry,
  UpdateUnitPayload
} from '~/composables/useUnits'
import type { UnitAmenity } from '~/composables/useUnitAmenities'
import type { UnitImage } from '~/composables/useUnitImages'
import type { UnitCertificate } from '~/composables/useUnitCertificates'
import type { UnitDocument } from '~/composables/useUnitDocuments'
import type { UnitOwner } from '~/composables/useUnitOwners'
import type { PriceType, UnitPrice } from '~/composables/useUnitPrices'

const route = useRoute()
const { isAdmin } = useAuth()
const {
  list,
  create,
  update,
  updateOccupancyStatus,
  updateSaleStatus,
  getStatusHistory,
  remove
} = useUnits()
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
const initialOccupancyStatus = (route.query.occupancyStatus as OccupancyStatus | undefined) || undefined
const initialSaleStatus = (route.query.saleStatus as SaleStatus | undefined) || undefined
const filter = reactive<{
  unitTypeId: number | undefined
  occupancyStatus: OccupancyStatus | undefined
  saleStatus: SaleStatus | undefined
  unitNumber: string
}>({
  unitTypeId: initialUnitTypeId,
  occupancyStatus: initialOccupancyStatus,
  saleStatus: initialSaleStatus,
  unitNumber: ''
})

const unitTypeOptions = ref<{ label: string; value: number }[]>([])
const unitTypeFilterOptions = computed(() => [{ label: 'All unit types', value: undefined }, ...unitTypeOptions.value])

const OCCUPANCY_STATUS_OPTIONS: { label: string; value: OccupancyStatus }[] = [
  { label: 'Vacant', value: 'VACANT' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Occupied', value: 'OCCUPIED' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Unavailable', value: 'UNAVAILABLE' }
]
const occupancyStatusFilterOptions = [{ label: 'All occupancy', value: undefined }, ...OCCUPANCY_STATUS_OPTIONS]

const SALE_STATUS_OPTIONS: { label: string; value: SaleStatus }[] = [
  { label: 'Not for sale', value: 'NOT_FOR_SALE' },
  { label: 'For sale', value: 'FOR_SALE' },
  { label: 'Reserved', value: 'RESERVED' },
  { label: 'Sold', value: 'SOLD' }
]
const saleStatusFilterOptions = [{ label: 'All sale statuses', value: undefined }, ...SALE_STATUS_OPTIONS]

// RESERVED/OCCUPIED are set only by the lease lifecycle (creating/approving
// a lease); FOR_SALE/RESERVED/SOLD are set only by their matching sale
// workflow (listing, agreement/reservation, ownership transfer). The manual
// status endpoints below reject those values server-side (UnitServiceImpl),
// so the create form and status-update modals only offer the values no
// other flow owns.
const MANUAL_OCCUPANCY_STATUS_OPTIONS: { label: string; value: OccupancyStatus }[] = [
  { label: 'Vacant', value: 'VACANT' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Unavailable', value: 'UNAVAILABLE' }
]
const MANUAL_SALE_STATUS_OPTIONS: { label: string; value: SaleStatus }[] = [
  { label: 'Not for sale', value: 'NOT_FOR_SALE' }
]

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
  { key: 'occupancyStatus', label: 'Occupancy', type: 'status' },
  { key: 'saleStatus', label: 'Sale status', type: 'status' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      unitTypeId: filter.unitTypeId,
      occupancyStatus: filter.occupancyStatus,
      saleStatus: filter.saleStatus,
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

const VIEW_OPTIONS = [
  { label: 'City', value: 'CITY' },
  { label: 'Garden', value: 'GARDEN' },
  { label: 'Pool', value: 'POOL' },
  { label: 'Sea', value: 'SEA' },
  { label: 'Street', value: 'STREET' }
]
const ORIENTATION_OPTIONS = [
  { label: 'North', value: 'NORTH' },
  { label: 'South', value: 'SOUTH' },
  { label: 'East', value: 'EAST' },
  { label: 'West', value: 'WEST' }
]

// New units always start NOT_FOR_SALE (see MANUAL_SALE_STATUS_OPTIONS
// comment above) — put them up for sale from the Sale listings page instead.
const createFields = computed<FieldDef[]>(() => [
  { name: 'unitTypeId', label: 'Unit type', type: 'select', required: true, options: unitTypeOptions.value },
  { name: 'unitNumber', label: 'Unit number', required: true, wrapper: 'half' },
  { name: 'name', wrapper: 'half' },
  { name: 'occupancyStatus', label: 'Occupancy status', type: 'select', options: MANUAL_OCCUPANCY_STATUS_OPTIONS, default: 'VACANT', wrapper: 'half' },
  { name: 'view', type: 'select', options: VIEW_OPTIONS, wrapper: 'half' },
  { name: 'orientation', type: 'select', options: ORIENTATION_OPTIONS, wrapper: 'half' },
  { name: 'kitchen', type: 'switch', onLabel: 'Yes', offLabel: 'No' },
  { name: 'balcony', type: 'switch', onLabel: 'Yes', offLabel: 'No' },
  { name: 'furnished', type: 'switch', onLabel: 'Yes', offLabel: 'No' },
  { name: 'description', type: 'textarea', wrapper: 'full' }
])

const editFields: FieldDef[] = [
  { name: 'unitNumber', label: 'Unit number', required: true, wrapper: 'half' },
  { name: 'name', wrapper: 'half' },
  { name: 'view', type: 'select', options: VIEW_OPTIONS, wrapper: 'half' },
  { name: 'orientation', type: 'select', options: ORIENTATION_OPTIONS, wrapper: 'half' },
  { name: 'kitchen', type: 'switch', onLabel: 'Yes', offLabel: 'No' },
  { name: 'balcony', type: 'switch', onLabel: 'Yes', offLabel: 'No' },
  { name: 'furnished', type: 'switch', onLabel: 'Yes', offLabel: 'No' },
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
    createDefaults: () => ({
      unitTypeId: filter.unitTypeId,
      occupancyStatus: 'VACANT'
    }),
    toForm: (row) => ({
      unitNumber: row.unitNumber,
      name: row.name ?? '',
      view: row.view ?? undefined,
      orientation: row.orientation ?? undefined,
      kitchen: row.kitchen ?? false,
      balcony: row.balcony ?? false,
      furnished: row.furnished ?? false,
      description: row.description ?? ''
    }),
    toPayload: (values) => ({
      unitTypeId: values.unitTypeId,
      unitNumber: values.unitNumber,
      name: values.name || undefined,
      occupancyStatus: values.occupancyStatus,
      view: values.view || undefined,
      orientation: values.orientation || undefined,
      kitchen: values.kitchen,
      balcony: values.balcony,
      furnished: values.furnished,
      description: values.description || undefined
    }),
    toEditPayload: (values) => ({
      unitNumber: values.unitNumber,
      name: values.name || undefined,
      view: values.view || undefined,
      orientation: values.orientation || undefined,
      kitchen: values.kitchen,
      balcony: values.balcony,
      furnished: values.furnished,
      description: values.description || undefined
    })
  }
)

// Occupancy status — its own endpoint, separate from sale status below.
const {
  open: showOccupancyStatus,
  target: occupancyStatusTarget,
  loading: occupancyStatusLoading,
  error: occupancyStatusError,
  openWith: openOccupancyStatusWith
} = useTargetModal<Unit>()

const occupancyStatusForm = ref<Record<string, any>>({})
// Reserved/Occupied are set automatically by creating/approving a lease for
// this unit (see the Leases page) — the backend rejects them here.
const occupancyStatusFields: FieldDef[] = [
  {
    name: 'occupancyStatus',
    label: 'Occupancy status',
    type: 'select',
    required: true,
    options: MANUAL_OCCUPANCY_STATUS_OPTIONS,
    hint: 'Reserved and Occupied are set automatically by the lease workflow, not here.'
  },
  { name: 'reason' }
]

watch(showOccupancyStatus, (value) => {
  if (value && occupancyStatusTarget.value) {
    occupancyStatusForm.value = { occupancyStatus: occupancyStatusTarget.value.occupancyStatus ?? undefined }
  }
})

async function onOccupancyStatusSubmit(values: Record<string, any>) {
  if (!occupancyStatusTarget.value) return
  occupancyStatusLoading.value = true
  occupancyStatusError.value = ''
  try {
    await updateOccupancyStatus(occupancyStatusTarget.value.id, {
      occupancyStatus: values.occupancyStatus,
      reason: values.reason || undefined
    })
    showOccupancyStatus.value = false
    toast.add({ title: 'Occupancy status updated', color: 'success' })
    await load()
  } catch (err) {
    occupancyStatusError.value = apiErrorMessage(err)
  } finally {
    occupancyStatusLoading.value = false
  }
}

// Sale status — its own endpoint, separate from occupancy status above.
const {
  open: showSaleStatus,
  target: saleStatusTarget,
  loading: saleStatusLoading,
  error: saleStatusError,
  openWith: openSaleStatusWith
} = useTargetModal<Unit>()

const saleStatusForm = ref<Record<string, any>>({})
// For sale/Reserved/Sold are set automatically by creating a sale listing,
// agreement/reservation, or completing an ownership transfer (see the Sale
// listings / Sale agreements pages) — the backend rejects them here. This
// modal only ever takes a unit off the market.
const saleStatusFields: FieldDef[] = [
  {
    name: 'saleStatus',
    label: 'Sale status',
    type: 'select',
    required: true,
    options: MANUAL_SALE_STATUS_OPTIONS,
    hint: 'For sale, Reserved, and Sold are set automatically by the sale workflow, not here.'
  },
  { name: 'reason' }
]

watch(showSaleStatus, (value) => {
  if (value && saleStatusTarget.value) {
    saleStatusForm.value = { saleStatus: saleStatusTarget.value.saleStatus ?? undefined }
  }
})

async function onSaleStatusSubmit(values: Record<string, any>) {
  if (!saleStatusTarget.value) return
  saleStatusLoading.value = true
  saleStatusError.value = ''
  try {
    await updateSaleStatus(saleStatusTarget.value.id, {
      saleStatus: values.saleStatus,
      reason: values.reason || undefined
    })
    showSaleStatus.value = false
    toast.add({ title: 'Sale status updated', color: 'success' })
    await load()
  } catch (err) {
    saleStatusError.value = apiErrorMessage(err)
  } finally {
    saleStatusLoading.value = false
  }
}

onMounted(async () => {
  await loadUnitTypeOptions()
  await load()
})
watch(sort, load)
watch(() => [filter.unitTypeId, filter.occupancyStatus, filter.saleStatus], load)

const hasActiveFilter = computed(
  () =>
    filter.unitTypeId !== undefined ||
    filter.occupancyStatus !== undefined ||
    filter.saleStatus !== undefined ||
    filter.unitNumber !== ''
)

function clearFilters() {
  filter.unitTypeId = undefined
  filter.occupancyStatus = undefined
  filter.saleStatus = undefined
  filter.unitNumber = ''
  load()
}

// ── Amenities — its own modal, separate from Manage below (was nested inside
// it; split out since it's a distinct, self-contained action). ─────────────
const { open: showAmenities, target: amenitiesTarget, openWith: openAmenitiesWith } = useTargetModal<Unit>()

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
  if (!amenitiesTarget.value) return
  assigningAmenity.value = true
  assignAmenityError.value = ''
  try {
    await assignUnitAmenity(amenitiesTarget.value.id, { amenityId: values.amenityId, notes: values.notes || undefined })
    assignAmenityForm.value = {}
    toast.add({ title: 'Amenity assigned', color: 'success' })
    await loadAmenitiesSection(amenitiesTarget.value.id)
  } catch (err) {
    assignAmenityError.value = apiErrorMessage(err)
  } finally {
    assigningAmenity.value = false
  }
}

async function onRemoveAmenity(row: UnitAmenity) {
  if (!amenitiesTarget.value) return
  try {
    await removeUnitAmenity(amenitiesTarget.value.id, row.id)
    toast.add({ title: 'Amenity removed', color: 'success' })
    await loadAmenitiesSection(amenitiesTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not remove amenity', description: apiErrorMessage(err), color: 'error' })
  }
}

watch(showAmenities, async (value) => {
  if (!value || !amenitiesTarget.value) return
  assignAmenityForm.value = {}
  assignAmenityError.value = ''
  const amenitiesRes = await listAmenities({ size: 200 })
  amenityOptions.value = amenitiesRes.data.map((a) => ({ label: a.name, value: a.id }))
  await loadAmenitiesSection(amenitiesTarget.value.id)
})

// ── Images — its own modal, separate from Manage (which no longer exists —
// every section that used to live there now has its own entry point). ─────
const { open: showImages, target: imagesTarget, openWith: openImagesWith } = useTargetModal<Unit>()

const unitImages = ref<UnitImage[]>([])
const imagesLoading = ref(false)
const imageUrls = ref<Record<number, string>>({})

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

function uploadImageForTarget(file: File, caption?: string, primary?: boolean) {
  return uploadUnitImage(imagesTarget.value!.id, file, caption, primary)
}

const showImageLightbox = ref(false)
const imageLightboxIndex = ref(0)
const imageLightboxItems = computed(() =>
  unitImages.value
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
  if (!imagesTarget.value) return
  toast.add({ title: 'Image uploaded', color: 'success' })
  await loadImagesSection(imagesTarget.value.id)
}

async function onSetPrimaryImage(img: UnitImage) {
  if (!imagesTarget.value) return
  try {
    await setPrimaryUnitImage(imagesTarget.value.id, img.id)
    toast.add({ title: 'Primary image updated', color: 'success' })
    await loadImagesSection(imagesTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not set primary image', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteImage(img: UnitImage) {
  if (!imagesTarget.value) return
  try {
    await removeUnitImage(imagesTarget.value.id, img.id)
    toast.add({ title: 'Image deleted', color: 'success' })
    await loadImagesSection(imagesTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete image', description: apiErrorMessage(err), color: 'error' })
  }
}

watch(showImages, async (value) => {
  if (!value || !imagesTarget.value) return
  await loadImagesSection(imagesTarget.value.id)
})

// ── Certificates — its own modal, separate from Manage. ────────────────────
const { open: showCertificates, target: certificatesTarget, openWith: openCertificatesWith } = useTargetModal<Unit>()

const unitCertificates = ref<UnitCertificate[]>([])
const certificatesLoading = ref(false)

async function loadCertificatesSection(unitId: number) {
  certificatesLoading.value = true
  try {
    unitCertificates.value = await listUnitCertificates(unitId)
  } finally {
    certificatesLoading.value = false
  }
}

function uploadCertificateForTarget(file: File, description?: string) {
  return uploadUnitCertificate(certificatesTarget.value!.id, file, description)
}

async function onCertificateUploaded() {
  if (!certificatesTarget.value) return
  toast.add({ title: 'Certificate uploaded', color: 'success' })
  await loadCertificatesSection(certificatesTarget.value.id)
}

async function onDownloadCertificate(c: UnitCertificate) {
  if (!certificatesTarget.value) return
  try {
    await downloadUnitCertificate(certificatesTarget.value.id, c.id, c.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteCertificate(c: UnitCertificate) {
  if (!certificatesTarget.value) return
  try {
    await removeUnitCertificate(certificatesTarget.value.id, c.id)
    toast.add({ title: 'Certificate deleted', color: 'success' })
    await loadCertificatesSection(certificatesTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

watch(showCertificates, async (value) => {
  if (!value || !certificatesTarget.value) return
  await loadCertificatesSection(certificatesTarget.value.id)
})

// ── Documents — its own modal, separate from Manage. ────────────────────────
const { open: showDocuments, target: documentsTarget, openWith: openDocumentsWith } = useTargetModal<Unit>()

const unitDocuments = ref<UnitDocument[]>([])
const documentsLoading = ref(false)

async function loadDocumentsSection(unitId: number) {
  documentsLoading.value = true
  try {
    unitDocuments.value = await listUnitDocuments(unitId)
  } finally {
    documentsLoading.value = false
  }
}

function uploadDocumentForTarget(file: File, description?: string) {
  return uploadUnitDocument(documentsTarget.value!.id, file, description)
}

async function onDocumentUploaded() {
  if (!documentsTarget.value) return
  toast.add({ title: 'Document uploaded', color: 'success' })
  await loadDocumentsSection(documentsTarget.value.id)
}

async function onDownloadDocument(d: UnitDocument) {
  if (!documentsTarget.value) return
  try {
    await downloadUnitDocument(documentsTarget.value.id, d.id, d.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteDocument(d: UnitDocument) {
  if (!documentsTarget.value) return
  try {
    await removeUnitDocument(documentsTarget.value.id, d.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocumentsSection(documentsTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

watch(showDocuments, async (value) => {
  if (!value || !documentsTarget.value) return
  await loadDocumentsSection(documentsTarget.value.id)
})

// ── Ownership history — its own modal, separate from Manage (same reasoning
// as Amenities above). ──────────────────────────────────────────────────
const { open: showOwnership, target: ownershipTarget, openWith: openOwnershipWith } = useTargetModal<Unit>()

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
  if (!ownershipTarget.value) return
  addingOwner.value = true
  addOwnerError.value = ''
  try {
    await createUnitOwner(ownershipTarget.value.id, {
      ownerName: values.ownerName,
      ownerContact: values.ownerContact || undefined,
      ownershipStartDate: values.ownershipStartDate,
      notes: values.notes || undefined
    })
    addOwnerForm.value = {}
    toast.add({ title: 'Owner added', color: 'success' })
    await loadOwnersSection(ownershipTarget.value.id)
  } catch (err) {
    addOwnerError.value = apiErrorMessage(err)
  } finally {
    addingOwner.value = false
  }
}

async function onEndOwnership(o: UnitOwner) {
  if (!ownershipTarget.value) return
  endingOwnerId.value = o.id
  try {
    await endUnitOwner(ownershipTarget.value.id, o.id)
    toast.add({ title: 'Ownership ended', color: 'success' })
    await loadOwnersSection(ownershipTarget.value.id)
  } catch (err) {
    toast.add({ title: 'Could not end ownership', description: apiErrorMessage(err), color: 'error' })
  } finally {
    endingOwnerId.value = null
  }
}

watch(showOwnership, async (value) => {
  if (!value || !ownershipTarget.value) return
  addOwnerForm.value = {}
  addOwnerError.value = ''
  await loadOwnersSection(ownershipTarget.value.id)
})

// ── Price history — its own modal, separate from Manage (same reasoning as
// Amenities/Ownership above). ───────────────────────────────────────────
const { open: showPriceHistory, target: priceHistoryTarget, openWith: openPriceHistoryWith } = useTargetModal<Unit>()

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
  if (!priceHistoryTarget.value) return
  addingPrice.value = true
  addPriceError.value = ''
  try {
    await createUnitPrice(priceHistoryTarget.value.id, {
      priceType: values.priceType,
      amount: values.amount,
      effectiveDate: values.effectiveDate,
      notes: values.notes || undefined
    })
    addPriceForm.value = {}
    toast.add({ title: 'Price recorded', color: 'success' })
    await loadPricesSection(priceHistoryTarget.value.id)
  } catch (err) {
    addPriceError.value = apiErrorMessage(err)
  } finally {
    addingPrice.value = false
  }
}

watch(showPriceHistory, async (value) => {
  if (!value || !priceHistoryTarget.value) return
  addPriceForm.value = {}
  addPriceError.value = ''
  await loadPricesSection(priceHistoryTarget.value.id)
})

// ── Status history — its own modal, separate from Manage (same reasoning as
// Amenities/Ownership/Price above). Read-only, populated from the same
// dedicated endpoint the occupancy/sale status updates write to. ──────────
const { open: showStatusHistory, target: statusHistoryTarget, openWith: openStatusHistoryWith } = useTargetModal<Unit>()

const statusHistory = ref<UnitStatusHistoryEntry[]>([])
const statusHistoryLoading = ref(false)

async function loadStatusHistorySection(unitId: number) {
  statusHistoryLoading.value = true
  try {
    statusHistory.value = await getStatusHistory(unitId)
  } finally {
    statusHistoryLoading.value = false
  }
}

watch(showStatusHistory, async (value) => {
  if (!value || !statusHistoryTarget.value) return
  await loadStatusHistorySection(statusHistoryTarget.value.id)
})

// Secondary row actions collapsed into a single "⋯" menu — Edit/Delete stay
// as direct buttons since they're the most common actions.
function rowActionItems(row: Unit) {
  return [
    [
      { label: 'Amenities', icon: 'i-lucide-sparkles', onSelect: () => openAmenitiesWith(row) },
      { label: 'Ownership', icon: 'i-lucide-user-check', onSelect: () => openOwnershipWith(row) },
      { label: 'Price history', icon: 'i-lucide-dollar-sign', onSelect: () => openPriceHistoryWith(row) },
      { label: 'Status history', icon: 'i-lucide-history', onSelect: () => openStatusHistoryWith(row) }
    ],
    [
      { label: 'Images', icon: 'i-lucide-image', onSelect: () => openImagesWith(row) },
      { label: 'Certificates', icon: 'i-lucide-file-badge', onSelect: () => openCertificatesWith(row) },
      { label: 'Documents', icon: 'i-lucide-file-text', onSelect: () => openDocumentsWith(row) }
    ]
  ]
}
</script>

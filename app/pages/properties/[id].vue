<template>
  <div>
    <UButton to="/properties" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" class="mb-4">
      Properties
    </UButton>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div v-if="loading && !property" class="space-y-4">
      <div class="h-8 w-64 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div class="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
    </div>

    <template v-else-if="property">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ property.name }}</h1>
            <UBadge v-if="property.type" color="neutral" variant="subtle" size="sm">{{ formatEnum(property.type) }}</UBadge>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ addressLine }}
            <span v-if="property.code" class="text-gray-400 dark:text-gray-500"> · {{ property.code }}</span>
            <span v-if="property.zoneName" class="text-gray-400 dark:text-gray-500"> · {{ property.zoneName }}</span>
          </p>
        </div>
        <UButton icon="i-lucide-building-2" color="neutral" variant="soft" :to="`/buildings?propertyId=${property.id}`">
          {{ buildingCount ?? 0 }} building{{ buildingCount === 1 ? '' : 's' }}
        </UButton>
      </div>

      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Units
        </h2>
        <UCard>
          <div v-if="loading" class="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <template v-else-if="units.length > 0">
            <div class="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              <div
                v-for="segment in unitSegments"
                :key="segment.key"
                :style="{ width: `${(segment.value / units.length) * 100}%` }"
                :class="segment.barClass"
                :title="`${segment.label}: ${segment.value}`"
                class="h-full border-r-2 border-white dark:border-gray-950 last:border-r-0"
              />
            </div>
            <div class="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
              <span v-for="segment in unitSegments" :key="segment.key" class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="segment.dotClass" />
                {{ segment.label }}
                <span class="font-medium text-gray-900 dark:text-white">{{ segment.value }}</span>
              </span>
            </div>
          </template>
          <EmptyState v-else icon="i-lucide-door-open" title="No units yet" description="Units for this property will show up here once added." />
        </UCard>
      </section>

      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Rental
        </h2>
        <UCard>
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
            <span class="text-gray-500 dark:text-gray-400">
              Active leases <span class="font-semibold text-gray-900 dark:text-white">{{ activeLeases.length }}</span>
            </span>
            <span class="text-gray-500 dark:text-gray-400">
              Total monthly rent <span class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(activeRentTotal) }}</span>
            </span>
          </div>
          <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="leases.length === 0" class="text-sm text-gray-400">No leases for this property yet.</div>
          <div v-else class="space-y-1.5">
            <div
              v-for="lease in leases"
              :key="lease.id"
              class="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <div class="min-w-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ lease.tenantName ?? 'Tenant' }}</span>
                <span class="text-gray-400"> · Unit {{ lease.unitNumber ?? '—' }}</span>
                <span class="text-gray-400"> · {{ formatDate(lease.startDate) }} – {{ formatDate(lease.endDate) }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(lease.rentAmount) }}</span>
                <StatusBadge :status="lease.status" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" @click="navigateTo(`/leases?unitId=${lease.unitId}`)" />
              </div>
            </div>
          </div>
        </UCard>
      </section>

      <section>
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Sales
        </h2>
        <UCard>
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-4">
            <span class="text-gray-500 dark:text-gray-400">
              Active agreements <span class="font-semibold text-gray-900 dark:text-white">{{ activeSaleAgreements.length }}</span>
            </span>
            <span class="text-gray-500 dark:text-gray-400">
              Total sale value <span class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(activeSaleValueTotal) }}</span>
            </span>
          </div>
          <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="saleAgreements.length === 0" class="text-sm text-gray-400">No sale agreements for this property yet.</div>
          <div v-else class="space-y-1.5">
            <div
              v-for="agreement in saleAgreements"
              :key="agreement.id"
              class="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-1.5"
            >
              <div class="min-w-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ agreement.buyerName ?? 'Buyer' }}</span>
                <span class="text-gray-400"> · Unit {{ agreement.unitNumber ?? '—' }}</span>
                <span class="text-gray-400"> · {{ formatDate(agreement.agreementDate) }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(agreement.netPrice) }}</span>
                <StatusBadge :status="agreement.status" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" @click="navigateTo(`/sale-agreements?unitId=${agreement.unitId}`)" />
              </div>
            </div>
          </div>
        </UCard>
      </section>

      <section class="mt-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Images
        </h2>
        <UCard>
          <div v-if="imagesLoading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="images.length === 0" class="text-sm text-gray-400 mb-3">No images uploaded yet.</div>
          <div v-else class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
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
          <ImageUploadCropField v-if="isAdmin" :upload="uploadImageForProperty" @uploaded="onImageUploaded" />
          <ImageLightbox v-model:open="showImageLightbox" v-model:index="imageLightboxIndex" :images="imageLightboxItems" />
        </UCard>
      </section>

      <section class="mt-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Documents
        </h2>
        <UCard>
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
          <FileUploadField v-if="isAdmin" :upload="uploadDocumentForProperty" @uploaded="onDocumentUploaded" />
        </UCard>
      </section>

      <section class="mt-8">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Certificates
        </h2>
        <UCard>
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
          <FileUploadField v-if="isAdmin" :upload="uploadCertificateForProperty" @uploaded="onCertificateUploaded" />
        </UCard>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PropertyItem } from '~/composables/useProperties'
import type { Unit } from '~/composables/useUnits'
import type { Lease } from '~/composables/useLeases'
import type { SaleAgreement } from '~/composables/useSaleAgreements'
import type { PropertyDocument } from '~/composables/usePropertyDocuments'
import type { PropertyCertificate } from '~/composables/usePropertyCertificates'
import type { PropertyImage } from '~/composables/usePropertyImages'

const route = useRoute()
const propertyId = computed(() => Number(route.params.id))

const { get: getProperty } = useProperties()
const { list: listBuildings } = useBuildings()
const { list: listUnits } = useUnits()
const { list: listLeases } = useLeases()
const { list: listSaleAgreements } = useSaleAgreements()
const { list: listDocuments, upload: uploadDocument, remove: removeDocument, download: downloadDocument } = usePropertyDocuments()
const { list: listCertificates, upload: uploadCertificate, remove: removeCertificate, download: downloadCertificate } = usePropertyCertificates()
const {
  list: listImages,
  upload: uploadImage,
  setPrimary: setPrimaryImage,
  remove: removeImage,
  getObjectUrl: getImageUrl
} = usePropertyImages()
const { isAdmin } = useAuth()
const toast = useToast()

const loading = ref(true)
const error = ref('')

const property = ref<PropertyItem | null>(null)
const buildingCount = ref<number | undefined>(undefined)
const units = ref<Unit[]>([])
const leases = ref<Lease[]>([])
const saleAgreements = ref<SaleAgreement[]>([])

const addressLine = computed(() => {
  if (!property.value) return '—'
  const parts = [property.value.address, property.value.city, property.value.state, property.value.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '—'
})

const activeLeases = computed(() => leases.value.filter((l) => l.status === 'ACTIVE'))
const activeRentTotal = computed(() => activeLeases.value.reduce((sum, l) => sum + l.rentAmount, 0))
const activeSaleAgreements = computed(() => saleAgreements.value.filter((a) => a.status === 'ACTIVE'))
const activeSaleValueTotal = computed(() => activeSaleAgreements.value.reduce((sum, a) => sum + a.netPrice, 0))

// Occupancy status (VACANT/RESERVED/OCCUPIED/MAINTENANCE/UNAVAILABLE) — sale
// status (NOT_FOR_SALE/FOR_SALE/RESERVED/SOLD) is a separate dimension on
// Unit, not part of occupancy (see useUnits.ts).
const UNIT_OCCUPANCY_SEGMENTS: { key: string; label: string; status: Unit['occupancyStatus']; barClass: string; dotClass: string }[] = [
  { key: 'occupied', label: 'Occupied', status: 'OCCUPIED', barClass: 'bg-info', dotClass: 'bg-info' },
  { key: 'vacant', label: 'Vacant', status: 'VACANT', barClass: 'bg-success', dotClass: 'bg-success' },
  { key: 'reserved', label: 'Reserved', status: 'RESERVED', barClass: 'bg-warning', dotClass: 'bg-warning' },
  { key: 'maintenance', label: 'Maintenance', status: 'MAINTENANCE', barClass: 'bg-warning', dotClass: 'bg-warning' },
  { key: 'unavailable', label: 'Unavailable', status: 'UNAVAILABLE', barClass: 'bg-cancelled', dotClass: 'bg-cancelled' }
]
const unitSegments = computed(() =>
  UNIT_OCCUPANCY_SEGMENTS.map((segment) => ({
    ...segment,
    value: units.value.filter((u) => u.occupancyStatus === segment.status).length
  })).filter((s) => s.value > 0)
)

function is404(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status === 404
}

// Units, leases, and sale agreements can't be filtered by propertyId
// server-side (UnitFilter only takes unitTypeId; LeaseFilter/SaleAgreementFilter
// only take unitId) — so, same as the dashboard's activePropertyCount, we fetch
// broadly and filter client-side using each row's denormalized propertyId/unitId.
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [propertyRes, buildingsRes, unitsRes, leasesRes, saleAgreementsRes] = await Promise.all([
      getProperty(propertyId.value),
      listBuildings({ propertyId: propertyId.value, size: 1 }),
      listUnits({ size: 500 }),
      listLeases({ size: 500 }),
      listSaleAgreements({ size: 500 })
    ])
    property.value = propertyRes
    buildingCount.value = buildingsRes.metadata.totalCount
    units.value = unitsRes.data.filter((u) => u.propertyId === propertyId.value)
    const unitIds = new Set(units.value.map((u) => u.id))
    leases.value = leasesRes.data.filter((l) => l.propertyId === propertyId.value)
    saleAgreements.value = saleAgreementsRes.data.filter((a) => unitIds.has(a.unitId))
  } catch (err) {
    error.value = is404(err) ? 'Property not found.' : apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

// Images
const images = ref<PropertyImage[]>([])
const imagesLoading = ref(false)
const imageUrls = ref<Record<number, string>>({})

async function loadImages() {
  imagesLoading.value = true
  try {
    images.value = await listImages(propertyId.value)
    for (const url of Object.values(imageUrls.value)) URL.revokeObjectURL(url)
    const urls: Record<number, string> = {}
    for (const img of images.value) {
      urls[img.id] = await getImageUrl(propertyId.value, img.id)
    }
    imageUrls.value = urls
  } finally {
    imagesLoading.value = false
  }
}

function uploadImageForProperty(file: File, caption?: string, primary?: boolean) {
  return uploadImage(propertyId.value, file, caption, primary)
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
  try {
    await setPrimaryImage(propertyId.value, img.id)
    toast.add({ title: 'Primary image updated', color: 'success' })
    await loadImages()
  } catch (err) {
    toast.add({ title: 'Could not set primary image', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDeleteImage(img: PropertyImage) {
  try {
    await removeImage(propertyId.value, img.id)
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
  documentsLoading.value = true
  try {
    documents.value = await listDocuments(propertyId.value)
  } catch (err) {
    toast.add({ title: 'Could not load documents', description: apiErrorMessage(err), color: 'error' })
  } finally {
    documentsLoading.value = false
  }
}

async function loadCertificates() {
  certificatesLoading.value = true
  try {
    certificates.value = await listCertificates(propertyId.value)
  } catch (err) {
    toast.add({ title: 'Could not load certificates', description: apiErrorMessage(err), color: 'error' })
  } finally {
    certificatesLoading.value = false
  }
}

function uploadDocumentForProperty(file: File, description?: string) {
  return uploadDocument(propertyId.value, file, description)
}

async function onDocumentUploaded() {
  toast.add({ title: 'Document uploaded', color: 'success' })
  await loadDocuments()
}

async function onDeleteDocument(doc: PropertyDocument) {
  try {
    await removeDocument(propertyId.value, doc.id)
    toast.add({ title: 'Document deleted', color: 'success' })
    await loadDocuments()
  } catch (err) {
    toast.add({ title: 'Could not delete document', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadDocument(doc: PropertyDocument) {
  try {
    await downloadDocument(propertyId.value, doc.id, doc.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download document', description: apiErrorMessage(err), color: 'error' })
  }
}

function uploadCertificateForProperty(file: File, description?: string) {
  return uploadCertificate(propertyId.value, file, description)
}

async function onCertificateUploaded() {
  toast.add({ title: 'Certificate uploaded', color: 'success' })
  await loadCertificates()
}

async function onDeleteCertificate(cert: PropertyCertificate) {
  try {
    await removeCertificate(propertyId.value, cert.id)
    toast.add({ title: 'Certificate deleted', color: 'success' })
    await loadCertificates()
  } catch (err) {
    toast.add({ title: 'Could not delete certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownloadCertificate(cert: PropertyCertificate) {
  try {
    await downloadCertificate(propertyId.value, cert.id, cert.fileName)
  } catch (err) {
    toast.add({ title: 'Could not download certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

onMounted(async () => {
  await load()
  await Promise.all([loadImages(), loadDocuments(), loadCertificates()])
})
</script>

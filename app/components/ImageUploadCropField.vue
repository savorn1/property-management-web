<template>
  <div class="space-y-3">
    <div
      v-if="!pendingBlob"
      class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer"
      :class="dragOver
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'"
      @click="fileInput?.click()"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange">
      <UIcon name="i-lucide-image-plus" class="size-6 text-gray-400 mx-auto mb-1.5" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        <span class="text-primary-500 font-medium">Click to browse</span> or drag an image here
      </p>
      <p class="text-xs text-gray-400 mt-1">Up to {{ maxSizeMb }} MB — you'll be able to crop it next</p>
    </div>

    <template v-else>
      <div class="flex items-center gap-3">
        <img :src="pendingPreviewUrl!" class="w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-800" alt="Cropped preview">
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-crop" @click="reopenCropper">
          Re-crop
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearAll" />
      </div>
      <UInput v-model="caption" placeholder="Caption (optional)" class="w-full" />
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input v-model="primary" type="checkbox">
        Set as primary
      </label>
      <UButton :loading="uploading" icon="i-lucide-upload" @click="submit">
        Upload
      </UButton>
    </template>

    <UAlert v-if="error" color="error" variant="subtle" :title="error" />

    <UModal v-model:open="showCropModal" title="Crop image" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div class="max-h-[60vh] overflow-hidden">
          <img ref="cropImageEl" :src="rawObjectUrl!" class="block max-w-full" alt="To crop">
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="cancelCrop">Cancel</UButton>
          <UButton icon="i-lucide-check" @click="confirmCrop">Crop &amp; continue</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

const props = withDefaults(defineProps<{
  upload: (file: File, caption?: string, primary?: boolean) => Promise<unknown>
  aspectRatio?: number
  maxSizeMb?: number
}>(), {
  aspectRatio: undefined,
  maxSizeMb: 10
})

const emit = defineEmits<{ uploaded: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const error = ref('')
const uploading = ref(false)

const rawFile = ref<File | null>(null)
const rawObjectUrl = ref<string | null>(null)
const showCropModal = ref(false)
const cropImageEl = ref<HTMLImageElement | null>(null)
let cropper: Cropper | null = null

const pendingBlob = ref<Blob | null>(null)
const pendingPreviewUrl = ref<string | null>(null)
const caption = ref('')
const primary = ref(false)

function acceptFile(file: File) {
  if (!file.type.startsWith('image/')) {
    error.value = 'Please choose an image file'
    return
  }
  if (file.size > props.maxSizeMb * 1024 * 1024) {
    error.value = `Image is too large — max ${props.maxSizeMb} MB`
    return
  }
  error.value = ''
  rawFile.value = file
  rawObjectUrl.value = URL.createObjectURL(file)
  showCropModal.value = true
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) acceptFile(file)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

function reopenCropper() {
  if (rawObjectUrl.value) showCropModal.value = true
}

watch(showCropModal, async (open) => {
  if (open) {
    await nextTick()
    if (cropImageEl.value) {
      cropper = new Cropper(cropImageEl.value, {
        aspectRatio: props.aspectRatio,
        viewMode: 1,
        autoCropArea: 1,
        background: false
      })
    }
  } else {
    cropper?.destroy()
    cropper = null
  }
})

function confirmCrop() {
  if (!cropper || !rawFile.value) return
  cropper.getCroppedCanvas().toBlob((blob) => {
    if (!blob) return
    if (pendingPreviewUrl.value) URL.revokeObjectURL(pendingPreviewUrl.value)
    pendingBlob.value = blob
    pendingPreviewUrl.value = URL.createObjectURL(blob)
    showCropModal.value = false
  }, rawFile.value.type)
}

function cancelCrop() {
  showCropModal.value = false
  // A cancelled first crop (no pending result yet) leaves nothing selected —
  // reset back to the dropzone rather than a stuck "picked but not cropped" state.
  if (!pendingBlob.value) clearAll()
}

function clearAll() {
  if (rawObjectUrl.value) URL.revokeObjectURL(rawObjectUrl.value)
  if (pendingPreviewUrl.value) URL.revokeObjectURL(pendingPreviewUrl.value)
  rawFile.value = null
  rawObjectUrl.value = null
  pendingBlob.value = null
  pendingPreviewUrl.value = null
  caption.value = ''
  primary.value = false
  error.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function submit() {
  if (!pendingBlob.value || !rawFile.value) return
  uploading.value = true
  error.value = ''
  try {
    const croppedFile = new File([pendingBlob.value], rawFile.value.name, { type: pendingBlob.value.type })
    await props.upload(croppedFile, caption.value || undefined, primary.value)
    clearAll()
    emit('uploaded')
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    uploading.value = false
  }
}

onBeforeUnmount(() => {
  cropper?.destroy()
  if (rawObjectUrl.value) URL.revokeObjectURL(rawObjectUrl.value)
  if (pendingPreviewUrl.value) URL.revokeObjectURL(pendingPreviewUrl.value)
})
</script>

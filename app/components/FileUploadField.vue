<template>
  <div class="space-y-3">
    <div
      class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer"
      :class="dragOver
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'"
      @click="fileInput?.click()"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" class="hidden" :accept="accept" @change="onFileChange">
      <template v-if="!selectedFile">
        <UIcon name="i-lucide-upload-cloud" class="size-6 text-gray-400 mx-auto mb-1.5" />
        <p class="text-sm text-gray-500 dark:text-gray-400">
          <span class="text-primary-500 font-medium">Click to browse</span> or drag a file here
        </p>
        <p class="text-xs text-gray-400 mt-1">{{ hint ?? `Up to ${maxSizeMb} MB` }}</p>
      </template>
      <div v-else class="flex items-center justify-between gap-3 text-left" @click.stop>
        <div class="flex items-center gap-2 min-w-0">
          <UIcon name="i-lucide-file" class="size-5 text-gray-400 shrink-0" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ selectedFile.name }}</p>
            <p class="text-xs text-gray-400">{{ formatFileSize(selectedFile.size) }}</p>
          </div>
        </div>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFile" />
      </div>
    </div>

    <template v-if="selectedFile">
      <UInput v-model="description" :placeholder="descriptionPlaceholder" class="w-full" />
      <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      <UButton :loading="uploading" icon="i-lucide-upload" @click="submit">
        Upload
      </UButton>
    </template>
    <UAlert v-else-if="error" color="error" variant="subtle" :title="error" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  // Composable's own upload(entityId, file, description) already has the
  // entityId bound by the caller — this just takes what's left.
  upload: (file: File, description?: string) => Promise<unknown>
  accept?: string
  maxSizeMb?: number
  descriptionPlaceholder?: string
  hint?: string
}>(), {
  accept: undefined,
  maxSizeMb: 20,
  descriptionPlaceholder: 'Description (optional)',
  hint: undefined
})

const emit = defineEmits<{ uploaded: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const selectedFile = ref<File | null>(null)
const description = ref('')
const uploading = ref(false)
const error = ref('')

function acceptFile(file: File) {
  if (file.size > props.maxSizeMb * 1024 * 1024) {
    error.value = `File is too large — max ${props.maxSizeMb} MB`
    return
  }
  error.value = ''
  selectedFile.value = file
  description.value = ''
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

function clearFile() {
  selectedFile.value = null
  description.value = ''
  error.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function submit() {
  if (!selectedFile.value) return
  uploading.value = true
  error.value = ''
  try {
    await props.upload(selectedFile.value, description.value || undefined)
    clearFile()
    emit('uploaded')
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-3xl' }">
    <template #content>
      <div class="relative bg-black">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="solid"
          size="sm"
          class="absolute top-3 right-3 z-10"
          @click="open = false"
        />
        <button
          v-if="images.length > 1"
          type="button"
          class="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-9 rounded-full bg-black/50 text-white hover:bg-black/70"
          @click="prev"
        >
          <UIcon name="i-lucide-chevron-left" class="size-5" />
        </button>
        <button
          v-if="images.length > 1"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-9 rounded-full bg-black/50 text-white hover:bg-black/70"
          @click="next"
        >
          <UIcon name="i-lucide-chevron-right" class="size-5" />
        </button>

        <img
          v-if="current"
          :src="current.url"
          :alt="current.caption ?? current.fileName"
          class="w-full max-h-[80vh] object-contain"
        >

        <div v-if="current && (current.caption || images.length > 1)" class="flex items-center justify-between gap-3 px-4 py-2.5 bg-black/80 text-sm text-gray-200">
          <span class="truncate">{{ current.caption ?? current.fileName }}</span>
          <span v-if="images.length > 1" class="shrink-0 text-gray-400">{{ index + 1 }} / {{ images.length }}</span>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  images: { id: number; url: string; fileName: string; caption?: string | null }[]
}>()

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const current = computed(() => props.images[index.value] ?? null)

function prev() {
  index.value = (index.value - 1 + props.images.length) % props.images.length
}

function next() {
  index.value = (index.value + 1) % props.images.length
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

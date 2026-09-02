<template>
  <component :is="to ? NuxtLink : 'div'" :to="to" :class="to ? 'block h-full' : 'h-full'">
    <UCard class="h-full" :ui="{ body: 'h-full' }" :class="to ? 'transition-all hover:shadow-md hover:-translate-y-0.5' : ''">
      <div class="flex items-start justify-between gap-3 h-full">
        <div class="min-w-0">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
          <div v-if="loading" class="h-8 w-24 mt-1.5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <p v-else class="text-2xl font-semibold text-gray-900 dark:text-white mt-1 truncate">{{ value }}</p>
          <p v-if="sublabel && !loading" class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ sublabel }}</p>
        </div>
        <div class="shrink-0 rounded-xl p-2.5 ring-1 ring-inset" :class="[colorClasses.bg, colorClasses.ring]">
          <UIcon :name="icon" class="w-5 h-5" :class="colorClasses.text" />
        </div>
      </div>
    </UCard>
  </component>
</template>

<script setup lang="ts">
type StatColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    sublabel?: string
    icon: string
    /** Wraps the tile in a link and adds a hover affordance — omit for a plain, non-interactive tile. */
    to?: string
    color?: StatColor
    /** Shows a skeleton in place of the value — use only for the first load, not on every refresh. */
    loading?: boolean
  }>(),
  { color: 'primary' }
)

const COLOR_CLASSES: Record<StatColor, { bg: string; text: string; ring: string }> = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-400/10', text: 'text-primary-500 dark:text-primary-400', ring: 'ring-primary-100 dark:ring-primary-400/10' },
  success: { bg: 'bg-success/10', text: 'text-success', ring: 'ring-success/15' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning/15' },
  error: { bg: 'bg-error/10', text: 'text-error', ring: 'ring-error/15' },
  info: { bg: 'bg-info/10', text: 'text-info', ring: 'ring-info/15' },
  neutral: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', ring: 'ring-gray-200 dark:ring-gray-700' }
}

const colorClasses = computed(() => COLOR_CLASSES[props.color])

// A string tag name in a dynamic `:is` only resolves for native HTML elements
// — Nuxt's globally-registered components (like NuxtLink) need an explicit
// resolveComponent, or `:is="'NuxtLink'"` silently renders a plain <div>.
const NuxtLink = resolveComponent('NuxtLink')
</script>

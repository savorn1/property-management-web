<template>
  <component :is="to ? NuxtLink : 'div'" :to="to" :class="to ? 'block h-full' : 'h-full'">
    <UCard class="h-full" :ui="{ body: 'h-full' }" :class="to ? 'transition-shadow hover:shadow-md' : ''">
      <div class="flex items-start justify-between gap-3 h-full">
        <div class="min-w-0">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
          <div v-if="loading" class="h-8 w-24 mt-1.5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <p v-else class="text-2xl font-semibold text-gray-900 dark:text-white mt-1 truncate">{{ value }}</p>
          <p v-if="sublabel && !loading" class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ sublabel }}</p>
        </div>
        <div class="shrink-0 rounded-lg p-2" :class="colorClasses.bg">
          <UIcon :name="icon" class="w-5 h-5" :class="colorClasses.text" />
        </div>
      </div>
    </UCard>
  </component>
</template>

<script setup lang="ts">
type StatColor = 'primary' | 'success' | 'warning' | 'info' | 'neutral'

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

const COLOR_CLASSES: Record<StatColor, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-400/10', text: 'text-primary-500 dark:text-primary-400' },
  success: { bg: 'bg-success/10', text: 'text-success' },
  warning: { bg: 'bg-warning/10', text: 'text-warning' },
  info: { bg: 'bg-info/10', text: 'text-info' },
  neutral: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' }
}

const colorClasses = computed(() => COLOR_CLASSES[props.color])

// A string tag name in a dynamic `:is` only resolves for native HTML elements
// — Nuxt's globally-registered components (like NuxtLink) need an explicit
// resolveComponent, or `:is="'NuxtLink'"` silently renders a plain <div>.
const NuxtLink = resolveComponent('NuxtLink')
</script>

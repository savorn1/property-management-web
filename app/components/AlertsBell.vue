<template>
  <UPopover>
    <UChip :show="totalCount > 0" :text="badgeText" color="error" size="sm">
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-bell"
        square
        :aria-label="totalCount > 0 ? `${totalCount} alerts` : 'Alerts'"
      />
    </UChip>

    <template #content>
      <div class="w-80 p-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Alerts</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="load"
          />
        </div>

        <div v-if="!loading && alerts.length === 0" class="text-sm text-gray-400 py-4 text-center">
          Nothing needs attention right now.
        </div>

        <ul v-else class="space-y-0.5">
          <li v-for="item in alerts" :key="item.key">
            <component
              :is="item.to ? NuxtLink : 'div'"
              :to="item.to"
              class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
              :class="item.to ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : ''"
            >
              <span class="text-gray-600 dark:text-gray-300">{{ item.label }}</span>
              <UBadge :color="item.color" variant="subtle" size="sm">{{ item.count }}</UBadge>
            </component>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const { alerts, totalCount, loading, load } = useAlerts()
const badgeText = computed(() => (totalCount.value > 99 ? '99+' : String(totalCount.value)))

// See StatTile for why a dynamic `:is` needs an explicit resolveComponent.
const NuxtLink = resolveComponent('NuxtLink')

onMounted(load)
</script>

<template>
  <UModal v-model:open="open" title="Change password">
    <template #body>
      <DynamicForm
        v-model="form"
        :fields="fields"
        :loading="loading"
        :error="error"
        submit-label="Change password"
        cancelable
        @submit="onSubmit"
        @cancel="open = false"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

const open = defineModel<boolean>({ default: false })

defineProps<{ loading?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [payload: { currentPassword: string; newPassword: string }] }>()

const form = ref<Record<string, any>>({})

const fields: FieldDef[] = [
  { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
  { name: 'newPassword', label: 'New password', type: 'password', required: true, hint: 'Minimum 6 characters.' }
]

// Reset the form (and any leftover error state carried by v-model) each time
// the modal is reopened, so a previously typed password never leaks into the
// next attempt.
watch(open, (value) => {
  if (value) form.value = {}
})

function onSubmit(values: Record<string, any>) {
  emit('submit', { currentPassword: values.currentPassword, newPassword: values.newPassword })
}
</script>

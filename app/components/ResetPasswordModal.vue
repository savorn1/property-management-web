<template>
  <UModal v-model:open="open" :title="`Reset password for '${username}'`">
    <template #body>
      <DynamicForm
        v-model="form"
        :fields="fields"
        :loading="loading"
        :error="error"
        submit-label="Reset password"
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

defineProps<{ username: string; loading?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [newPassword: string] }>()

const form = ref<Record<string, any>>({})

const fields: FieldDef[] = [
  { name: 'newPassword', label: 'New password', type: 'password', required: true, hint: 'Minimum 6 characters.' }
]

// Reset the form (and any leftover error state carried by v-model) each time
// the modal is reopened, so a previous target's typed password never leaks
// into the next one.
watch(open, (value) => {
  if (value) form.value = {}
})

function onSubmit(values: Record<string, any>) {
  emit('submit', values.newPassword)
}
</script>

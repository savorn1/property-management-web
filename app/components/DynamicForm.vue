<template>
  <UForm novalidate :state="model" class="space-y-4" @submit="onSubmit">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="field in visibleFields"
        :key="field.name"
        :class="(field.wrapper ?? 'full') === 'full' ? 'sm:col-span-2' : 'sm:col-span-1'"
      >
        <Field v-model="model[field.name]" :field="field" />
      </div>
    </div>

    <UAlert v-if="displayError" color="error" variant="subtle" :title="displayError" />

    <div class="flex justify-end gap-2 pt-2">
      <UButton
        v-if="cancelable"
        color="neutral"
        variant="ghost"
        :disabled="loading"
        @click="emit('cancel')"
        >Cancel</UButton
      >
      <UButton type="submit" :loading="loading">{{ submitLabel || 'Save' }}</UButton>
    </div>
  </UForm>
</template>

<script setup lang="ts">
// Renders a whole form from a FieldDef[]. The parent owns the value object via
// v-model; `default` values from field defs are applied once for keys the
// model doesn't have yet.
import type { FieldDef } from '#shared/types'

const props = withDefaults(
  defineProps<{
    fields: FieldDef[]
    loading?: boolean
    submitLabel?: string
    cancelable?: boolean
    error?: string
  }>(),
  {
    loading: false,
    submitLabel: '',
    cancelable: false,
    error: ''
  }
)

const model = defineModel<Record<string, any>>({ required: true })

const emit = defineEmits<{ submit: [Record<string, any>]; cancel: [] }>()

for (const field of props.fields) {
  if (field.default !== undefined && model.value[field.name] === undefined) {
    model.value[field.name] = field.default
  }
}

const visibleFields = computed(() =>
  props.fields.filter((field) => !field.showIf || field.showIf(model.value))
)

function onSubmit() {
  // Required fields rendered by non-native controls (select, date, radio)
  // don't get browser validation — enforce them here before emitting.
  for (const field of visibleFields.value) {
    const value = model.value[field.name]
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (field.required && isEmpty) {
      missingField.value = field
      return
    }
  }
  missingField.value = null
  emit('submit', { ...model.value })
}

const missingField = ref<FieldDef | null>(null)

const displayError = computed(() => {
  if (missingField.value) {
    const label = missingField.value.label ?? missingField.value.name
    return `Please fill in ${label}`
  }
  return props.error
})
</script>

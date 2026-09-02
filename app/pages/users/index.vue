<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New user</UButton>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="search"
          placeholder="Search username"
          icon="i-lucide-search"
          class="w-56"
        />
        <USelect
          v-model="filter.role"
          :items="roleFilterOptions"
          placeholder="Role"
          class="w-32"
        />
        <USelect
          v-model="filter.enabled"
          :items="statusFilterOptions"
          placeholder="Status"
          class="w-32"
        />
        <UButton
          v-if="hasActiveFilter"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="clearFilters"
        >
          Clear filters
        </UButton>
      </div>
    </UCard>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      class="mb-4"
      :title="error"
      icon="i-lucide-triangle-alert"
    />
    <TruncatedResultsAlert v-if="truncated" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="pagedRows"
        :columns="columns"
        :loading="loading"
        refreshable
        numbered
        exportable
        export-filename="users"
        :row-number-start="(page - 1) * pageSize"
        @refresh="load"
      >
        <template #actions-data="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-pencil"
              :disabled="row.username === myUsername"
              @click="openEdit(row)"
            >
              Edit
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-key-round"
              :disabled="row.username === myUsername"
              @click="openResetPasswordWith(row)"
            >
              Reset password
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              :disabled="row.username === myUsername"
              @click="confirmDelete = row"
            >
              Delete
            </UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No users match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-users" title="No users yet" description="Create the first user account to get started.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New user</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <ResetPasswordModal
      v-model="showResetPassword"
      :username="resetTarget?.username ?? ''"
      :loading="resettingPassword"
      :error="resetError"
      @submit="onResetPasswordSubmit"
    />

    <UModal v-model:open="showCreate" title="New user">
      <template #body>
        <DynamicForm
          v-model="createForm"
          :fields="createFields"
          :loading="creating"
          :error="createError"
          submit-label="Create"
          cancelable
          @submit="onCreate"
          @cancel="showCreate = false"
        />
      </template>
    </UModal>

    <UModal v-model:open="showEdit" :title="`Edit user '${editingUser?.username ?? ''}'`">
      <template #body>
        <DynamicForm
          v-model="editForm"
          :fields="editFields"
          :loading="editing"
          :error="editError"
          submit-label="Save changes"
          cancelable
          @submit="onEdit"
          @cancel="showEdit = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete user"
      :description="`Delete user '${confirmDelete?.username ?? ''}'? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => { if (!v) confirmDelete = null }"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef } from '#shared/types'
import type { AdminUser, CreateUserPayload, Role } from '~/composables/useUsers'

definePageMeta({ middleware: 'admin' })

const { list, create, updateRole, updateStatus, resetPassword, remove } = useUsers()
const { username: myUsername } = useAuth()
const toast = useToast()

const rows = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref('')

const filter = reactive<{ role: Role | undefined; enabled: boolean | undefined }>({
  role: undefined,
  enabled: undefined
})

const roleOptions = [
  { label: 'User', value: 'USER' },
  { label: 'Admin', value: 'ADMIN' }
]
const roleFilterOptions = [{ label: 'All roles', value: undefined }, ...roleOptions]
const statusFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false }
]

const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({
  column: 'id',
  direction: 'desc'
})

const { page, pageSize, total, rows: pagedRows, truncated, search } = useClientTable(rows, {
  pageSize: 10,
  searchFields: ['username']
})

const columns: ColumnDef<AdminUser>[] = [
 // { key: 'id', label: 'ID', sortable: true },
  { key: 'username', sortable: true },
  { key: 'email', value: (row) => row.email ?? '—' },
  { key: 'role', type: 'badge', color: (row) => (row.role === 'ADMIN' ? 'primary' : 'neutral') },
  { key: 'enabled', type: 'boolean', trueLabel: 'Enabled', falseLabel: 'Disabled' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      role: filter.role,
      enabled: filter.enabled,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      size: 200
    })
    rows.value = res.data
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const {
  open: showResetPassword,
  target: resetTarget,
  loading: resettingPassword,
  error: resetError,
  openWith: openResetPasswordWith
} = useTargetModal<AdminUser>()

async function onResetPasswordSubmit(newPassword: string) {
  if (!resetTarget.value) return
  resettingPassword.value = true
  resetError.value = ''
  try {
    await resetPassword(resetTarget.value.id, newPassword)
    showResetPassword.value = false
    toast.add({ title: 'Password reset', color: 'success' })
  } catch (err) {
    resetError.value = apiErrorMessage(err)
  } finally {
    resettingPassword.value = false
  }
}

const createFields: FieldDef[] = [
  { name: 'username', required: true },
  { name: 'password', type: 'password', required: true, hint: 'Minimum 6 characters.' },
  { name: 'email', type: 'email', hint: 'Optional — needed for the user to use "forgot password".' },
  { name: 'role', type: 'select', required: true, options: roleOptions },
  { name: 'enabled', type: 'switch', onLabel: 'Enabled', offLabel: 'Disabled', default: true }
]

const editFields: FieldDef[] = [
  { name: 'role', type: 'select', required: true, options: roleOptions },
  { name: 'enabled', type: 'switch', onLabel: 'Enabled', offLabel: 'Disabled' }
]

interface UserEditPayload {
  role: Role
  enabled: boolean
}

const {
  showCreate,
  creating,
  error: createError,
  createForm,
  openCreate,
  onCreate,
  showEdit,
  editing,
  editError,
  editingRow: editingUser,
  editForm,
  openEdit,
  onEdit,
  deleting,
  confirmDelete,
  onDelete
} = useCrudModals<AdminUser, CreateUserPayload, UserEditPayload>(
  {
    create: (payload) => create(payload),
    remove: (row) => remove(row.id),
    // No generic PUT /api/users/{id} exists on the backend — role and status
    // are separate endpoints, so only call whichever one actually changed.
    async update(row, payload) {
      let result = row
      if (payload.role !== row.role) result = await updateRole(row.id, payload.role)
      if (payload.enabled !== row.enabled) result = await updateStatus(row.id, payload.enabled)
      return result
    }
  },
  load,
  {
    entityName: 'User',
    createDefaults: () => ({ role: 'USER', enabled: true }),
    toPayload: (values) => ({
      username: values.username,
      password: values.password,
      email: values.email || undefined,
      role: values.role,
      enabled: values.enabled ?? true
    }),
    toForm: (row) => ({ role: row.role, enabled: row.enabled }),
    toEditPayload: (values) => ({ role: values.role, enabled: values.enabled })
  }
)

onMounted(load)
watch(sort, load)
watch(() => [filter.role, filter.enabled], load)

const hasActiveFilter = computed(() => search.value !== '' || filter.role !== undefined || filter.enabled !== undefined)

function clearFilters() {
  search.value = ''
  filter.role = undefined
  filter.enabled = undefined
  load()
}
</script>

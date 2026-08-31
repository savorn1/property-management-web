// Wraps the backend's admin-only UserController (/api/users/**, requires
// ROLE_ADMIN). Single-item endpoints wrap their payload in ApiResponse<T>;
// list wraps in PageResponse<T>.

export type Role = 'ADMIN' | 'USER'

export interface AdminUser {
  id: number
  username: string
  email: string | null
  role: Role
  enabled: boolean
}

export interface UserFilter {
  username?: string
  role?: Role
  enabled?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateUserPayload {
  username: string
  password: string
  email?: string
  role: Role
  enabled: boolean
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

interface PageMetadata {
  hasNext: boolean
  hasPrev: boolean
  totalPage: number
  currentPage: number
  limit: number
  totalCount: number
}

interface PageEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T[]
  metadata: PageMetadata
}

export function useUsers() {
  const api = useApi()

  function list(filter: UserFilter = {}) {
    return api<PageEnvelope<AdminUser>>('/api/users', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/users/${id}`)
    return res.data
  }

  async function create(payload: CreateUserPayload) {
    const res = await api<ApiEnvelope<AdminUser>>('/api/users', { method: 'POST', body: payload })
    return res.data
  }

  async function updateRole(id: number, role: Role) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/users/${id}/role`, {
      method: 'PUT',
      body: { role }
    })
    return res.data
  }

  async function updateStatus(id: number, enabled: boolean) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/users/${id}/status`, {
      method: 'PUT',
      body: { enabled }
    })
    return res.data
  }

  async function resetPassword(id: number, newPassword: string) {
    await api(`/api/users/${id}/password`, { method: 'PUT', body: { newPassword } })
  }

  async function remove(id: number) {
    await api(`/api/users/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, updateRole, updateStatus, resetPassword, remove }
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  username: string
  role: string
}

interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export function useAuth() {
  const { apiBase } = useRuntimeConfig().public

  // Cookie names are prefixed 'propmgmt_' (rather than the generic 'auth_*')
  // because other local Nuxt apps on this machine run on localhost too, just
  // a different port — and per RFC 6265, cookies are scoped by domain only,
  // not port. Sharing the plain 'auth_token' name meant logging out of one
  // app cleared the other's session as well.
  const token = useCookie<string | null>('propmgmt_auth_token', { default: () => null, sameSite: 'lax' })
  const refreshToken = useCookie<string | null>('propmgmt_auth_refresh_token', {
    default: () => null,
    sameSite: 'lax'
  })
  const username = useCookie<string | null>('propmgmt_auth_username', {
    default: () => null,
    sameSite: 'lax'
  })
  const role = useCookie<string | null>('propmgmt_auth_role', { default: () => null, sameSite: 'lax' })

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'ADMIN')

  function applySession(res: AuthResponse) {
    token.value = res.accessToken
    refreshToken.value = res.refreshToken
    username.value = res.username
    role.value = res.role
  }

  async function login(payload: LoginRequest) {
    const res = await $fetch<ApiEnvelope<AuthResponse>>('/api/auth/login', {
      baseURL: apiBase,
      method: 'POST',
      body: payload
    })
    applySession(res.data)
    return res.data
  }

  // Exchanges the stored refresh token for a new access + refresh token pair
  // (the old refresh token is rotated/invalidated server-side on use).
  async function refresh() {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }
    const res = await $fetch<ApiEnvelope<AuthResponse>>('/api/auth/refresh', {
      baseURL: apiBase,
      method: 'POST',
      body: { refreshToken: refreshToken.value }
    })
    applySession(res.data)
    return res.data
  }

  const refreshOnce = dedupeRefresh(refresh)

  async function logout() {
    const pendingRefreshToken = refreshToken.value
    token.value = null
    refreshToken.value = null
    username.value = null
    role.value = null
    if (pendingRefreshToken) {
      // Best-effort server-side revocation — the client-side session is already
      // cleared above regardless of whether this call succeeds.
      await $fetch('/api/auth/logout', {
        baseURL: apiBase,
        method: 'POST',
        body: { refreshToken: pendingRefreshToken }
      }).catch(() => {})
    }
    await navigateTo('/login')
  }

  return {
    token,
    username,
    role,
    isAuthenticated,
    isAdmin,
    login,
    refresh,
    refreshOnce,
    logout
  }
}

function dedupeRefresh(refresh: () => Promise<AuthResponse>) {
  return function refreshOnce() {
    const inflight = useState<Promise<AuthResponse> | null>('auth-refresh-inflight', () => null)
    if (!inflight.value) {
      inflight.value = refresh().finally(() => {
        inflight.value = null
      })
    }
    return inflight.value
  }
}

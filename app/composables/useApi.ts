// Thin wrapper around $fetch: attaches the Bearer token to every request. On a 401
// (expired/invalid access token) it silently exchanges the refresh token for a new
// access token and retries the request once; only if that also fails does it bounce
// to /login. All backend calls should go through this instead of raw $fetch.
export function useApi() {
  const { token, refreshOnce, logout } = useAuth()
  const { apiBase } = useRuntimeConfig().public

  const client = $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      if (token.value) {
        const headers = new Headers(options.headers as HeadersInit)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    }
  })

  // `any` here matches ofetch's own loosely-typed FetchOptions second parameter —
  // callers still get full inference on the return type via request<T>(...).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function request<T>(url: string, opts?: any): Promise<T> {
    try {
      return await client<T>(url, opts)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 401) {
        throw err
      }
      try {
        await refreshOnce()
        return await client<T>(url, opts)
      } catch {
        await logout()
        await navigateTo('/login')
        throw err
      }
    }
  }
}

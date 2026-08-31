const PUBLIC_PATHS = ['/login']

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_PATHS.includes(to.path)) return
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) return navigateTo('/login')
})

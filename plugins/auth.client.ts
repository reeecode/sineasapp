import { useAuth } from '~/composables/useAuth'

export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()
  await initAuth()
})


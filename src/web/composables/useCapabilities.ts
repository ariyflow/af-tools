import { onMounted, ref } from 'vue'
import type { ToolCapabilities } from '@/shared/api'

export function useCapabilities(toolId: string) {
  const capabilities = ref<ToolCapabilities | null>(null)

  onMounted(async () => {
    try {
      const response = await fetch('/api/tools')
      if (!response.ok) return
      const list = (await response.json()) as ToolCapabilities[]
      capabilities.value = list.find((item) => item.id === toolId) ?? null
    } catch {
      capabilities.value = null
    }
  })

  return { capabilities }
}

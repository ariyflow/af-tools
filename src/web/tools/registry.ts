import type { Locale, ToolMessages } from '@/shared/tool'
import type { WebToolModule } from './types'

const modules = import.meta.glob<{ default: WebToolModule }>('./*/index.ts', {
  eager: true,
})

export const tools: WebToolModule[] = Object.values(modules)
  .map((module) => module.default)
  .sort((left, right) => (left.meta.order ?? 100) - (right.meta.order ?? 100))

export function findTool(id: string): WebToolModule | undefined {
  return tools.find((tool) => tool.meta.id === id)
}

export const toolMessages: ToolMessages = {
  'zh-CN': {},
  'en-US': {},
}

for (const tool of tools) {
  if (!tool.messages) continue
  for (const locale of Object.keys(toolMessages) as Locale[]) {
    deepMerge(toolMessages[locale], tool.messages[locale] ?? {})
  }
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = value
    }
  }
}

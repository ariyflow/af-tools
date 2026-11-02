import type { Component } from 'vue'
import type { ToolMeta, ToolMessages } from '@/shared/tool'

export interface WebToolModule {
  meta: ToolMeta
  component: () => Promise<Component>
  messages?: ToolMessages
}

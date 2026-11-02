import type { JobPhase } from './api'

export type Locale = 'zh-CN' | 'en-US'

export type ToolCategory = 'video' | 'image' | 'text' | 'developer'

export type LocalizedText = Record<Locale, string>

export interface ToolMeta {
  id: string
  icon: string
  category: ToolCategory
  tags: string[]
  name: LocalizedText
  description: LocalizedText
  order?: number
}

export interface JobContext {
  jobId: string
  workDir: string
  signal: AbortSignal
  report: (progress: number, phase: JobPhase) => void
  log: {
    info: (message: string) => void
    warn: (message: string) => void
    error: (message: string) => void
  }
}

export interface Artifact {
  path: string
  filename: string
  mime: string
}

export type ToolMessages = Record<Locale, Record<string, unknown>>

export const ERROR_CODES = [
  'INVALID_FILE',
  'UNSUPPORTED_FORMAT',
  'FILE_TOO_LARGE',
  'DURATION_EXCEEDED',
  'INVALID_OPTIONS',
  'QUEUE_FULL',
  'PROCESS_FAILED',
  'CANCELLED',
  'EXPIRED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'NETWORK',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type JobStatus =
  'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'

export type JobPhase = 'queued' | 'probe' | 'palette' | 'encode' | 'done'

export interface JobArtifact {
  filename: string
  size: number
  mime: string
}

export interface JobSnapshot {
  id: string
  toolId: string
  status: JobStatus
  progress: number
  phase: JobPhase
  errorCode?: ErrorCode
  errorMessage?: string
  result?: JobArtifact
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface ToolCapabilities {
  id: string
  maxUploadBytes: number
  maxDurationSeconds: number
  resultTtlSeconds: number
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode
    message: string
  }
}

export interface CreateJobResponse {
  jobId: string
}

export interface MediaProbe {
  duration: number
  width: number
  height: number
  videoCodec?: string
  formatName?: string
}

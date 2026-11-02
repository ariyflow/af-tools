import type { ErrorCode } from '../../shared/api'

const statusByCode: Partial<Record<ErrorCode, number>> = {
  INVALID_FILE: 400,
  UNSUPPORTED_FORMAT: 415,
  FILE_TOO_LARGE: 413,
  DURATION_EXCEEDED: 400,
  INVALID_OPTIONS: 400,
  QUEUE_FULL: 429,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PROCESS_FAILED: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number

  constructor(code: ErrorCode, message: string, statusCode?: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode ?? statusByCode[code] ?? 400
  }
}

export class AbortError extends Error {
  constructor() {
    super('The operation was aborted')
    this.name = 'AbortError'
  }
}

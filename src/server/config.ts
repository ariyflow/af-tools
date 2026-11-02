import os from 'node:os'
import path from 'node:path'

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const maxUploadMb = intFromEnv('MAX_UPLOAD_MB', 200)
const concurrency = intFromEnv('JOB_CONCURRENCY', 2)

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: intFromEnv('PORT', 3000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  maxUploadBytes: maxUploadMb * 1024 * 1024,
  maxDurationSeconds: intFromEnv('MAX_DURATION_SECONDS', 60),
  concurrency,
  maxQueuedJobs: intFromEnv('MAX_QUEUED_JOBS', concurrency * 10),
  jobTtlMs: intFromEnv('JOB_TTL_MINUTES', 60) * 60 * 1000,
  processTimeoutMs: intFromEnv('PROCESS_TIMEOUT_SECONDS', 180) * 1000,
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH ?? 'ffprobe',
  tempDir: process.env.TEMP_DIR ?? path.join(os.tmpdir(), 'af-tools'),
  webDist: path.resolve(process.cwd(), 'dist/web'),
} as const

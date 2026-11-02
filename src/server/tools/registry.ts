import type { Artifact, JobContext } from '../../shared/tool'
import {
  MP4_TO_GIF_TOOL_ID,
  mp4ToGifOptionsSchema,
  type Mp4ToGifOptions,
} from '../../shared/tools/mp4-to-gif'
import { config } from '../config'
import { preflightMp4ToGif, runMp4ToGif } from './mp4-to-gif/handler'

export interface ServerToolHandler<O = unknown> {
  id: string
  maxUploadBytes: number
  maxDurationSeconds: number
  parseOptions: (raw: unknown) => O
  preflight?: (inputPath: string, options: O) => Promise<void>
  run: (context: JobContext, inputPath: string, options: O) => Promise<Artifact>
}

const mp4ToGifHandler: ServerToolHandler<Mp4ToGifOptions> = {
  id: MP4_TO_GIF_TOOL_ID,
  maxUploadBytes: config.maxUploadBytes,
  maxDurationSeconds: config.maxDurationSeconds,
  parseOptions: (raw) => mp4ToGifOptionsSchema.parse(raw),
  preflight: preflightMp4ToGif,
  run: runMp4ToGif,
}

const handlers = new Map<string, ServerToolHandler<any>>([
  [mp4ToGifHandler.id, mp4ToGifHandler],
])

export function getToolHandler(id: string): ServerToolHandler<any> | undefined {
  return handlers.get(id)
}

export function listToolCapabilities() {
  return [...handlers.values()].map((handler) => ({
    id: handler.id,
    maxUploadBytes: handler.maxUploadBytes,
    maxDurationSeconds: handler.maxDurationSeconds,
    resultTtlSeconds: Math.round(config.jobTtlMs / 1000),
  }))
}

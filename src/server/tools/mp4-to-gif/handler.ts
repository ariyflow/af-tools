import path from 'node:path'
import type { MediaProbe } from '../../../shared/api'
import type { Mp4ToGifOptions } from '../../../shared/tools/mp4-to-gif'
import type { Artifact, JobContext } from '../../../shared/tool'
import { config } from '../../config'
import { AppError } from '../../lib/errors'
import { probeVideo } from '../../lib/ffprobe'
import { runProcess } from '../../lib/process'
import { buildGifArgs, buildPaletteArgs, createProgressParser } from './command'

interface PreparedInput {
  probe: MediaProbe
  duration: number
}

async function prepareInput(
  inputPath: string,
  options: Mp4ToGifOptions,
  signal?: AbortSignal,
): Promise<PreparedInput> {
  const probe = await probeVideo(inputPath, signal)

  if (probe.duration <= 0.1) {
    throw new AppError('INVALID_FILE', 'The video is too short to convert')
  }

  if (options.startTime >= probe.duration) {
    throw new AppError('INVALID_OPTIONS', 'The start time is beyond the end of the video')
  }

  const remaining = probe.duration - options.startTime
  const requested =
    options.duration === 'full' ? remaining : Math.min(options.duration, remaining)

  if (options.duration !== 'full' && options.duration > config.maxDurationSeconds) {
    throw new AppError(
      'DURATION_EXCEEDED',
      `The clip may be at most ${config.maxDurationSeconds} seconds long`,
    )
  }

  const duration = Math.min(requested, config.maxDurationSeconds)

  if (!Number.isFinite(duration) || duration < 0.1) {
    throw new AppError('INVALID_OPTIONS', 'The selected clip is too short')
  }

  return { probe, duration }
}

export async function preflightMp4ToGif(
  inputPath: string,
  options: Mp4ToGifOptions,
  signal?: AbortSignal,
): Promise<void> {
  await prepareInput(inputPath, options, signal)
}

export async function runMp4ToGif(
  context: JobContext,
  inputPath: string,
  options: Mp4ToGifOptions,
): Promise<Artifact> {
  context.report(2, 'probe')
  const { duration } = await prepareInput(inputPath, options, context.signal)

  const buildInput = {
    inputPath,
    options,
    startTime: options.startTime,
    duration,
  }

  const palettePath = path.join(context.workDir, 'palette.png')
  const outputPath = path.join(context.workDir, 'output.gif')

  context.report(5, 'palette')
  const paletteProgress = createProgressParser(duration, (seconds) => {
    context.report(5 + (seconds / duration) * 25, 'palette')
  })

  await runProcess(config.ffmpegPath, buildPaletteArgs(buildInput, palettePath), {
    signal: context.signal,
    timeoutMs: config.processTimeoutMs,
    onStdout: paletteProgress,
  })

  context.report(30, 'encode')
  const encodeProgress = createProgressParser(duration, (seconds) => {
    context.report(30 + (seconds / duration) * 68, 'encode')
  })

  await runProcess(config.ffmpegPath, buildGifArgs(buildInput, palettePath, outputPath), {
    signal: context.signal,
    timeoutMs: config.processTimeoutMs,
    onStdout: encodeProgress,
  })

  context.report(99, 'encode')

  return {
    path: outputPath,
    filename: `mp4-to-gif-${context.jobId.slice(0, 8)}.gif`,
    mime: 'image/gif',
  }
}

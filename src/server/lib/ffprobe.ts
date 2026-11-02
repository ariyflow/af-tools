import type { MediaProbe } from '../../shared/api'
import { config } from '../config'
import { AppError } from './errors'
import { runProcess } from './process'

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  duration?: string
  disposition?: {
    attached_pic?: number
  }
}

interface FfprobeOutput {
  streams?: FfprobeStream[]
  format?: {
    duration?: string
    format_name?: string
  }
}

export async function probeVideo(
  filePath: string,
  signal?: AbortSignal,
): Promise<MediaProbe> {
  let stdout: string

  try {
    const result = await runProcess(
      config.ffprobePath,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { signal, timeoutMs: 20_000 },
    )
    stdout = result.stdout
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new AppError('INVALID_FILE', 'The uploaded file is not a valid video')
  }

  let parsed: FfprobeOutput
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput
  } catch {
    throw new AppError('INVALID_FILE', 'The uploaded file is not a valid video')
  }

  const video = parsed.streams?.find(
    (stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1,
  )

  if (!video) {
    throw new AppError(
      'UNSUPPORTED_FORMAT',
      'No playable video stream was found in this file',
    )
  }

  const duration = Number.parseFloat(parsed.format?.duration ?? video.duration ?? '0')

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError('INVALID_FILE', 'The video duration could not be determined')
  }

  return {
    duration,
    width: video.width ?? 0,
    height: video.height ?? 0,
    videoCodec: video.codec_name,
    formatName: parsed.format?.format_name,
  }
}

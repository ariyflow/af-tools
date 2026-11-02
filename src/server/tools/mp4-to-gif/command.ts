import type { Mp4ToGifOptions } from '../../../shared/tools/mp4-to-gif'

export interface FfmpegBuildInput {
  inputPath: string
  options: Mp4ToGifOptions
  startTime: number
  duration: number
}

function videoFilters(options: Mp4ToGifOptions): string {
  const filters = [`fps=${options.fps}`]
  if (options.width !== 'original') {
    filters.push(`scale=${options.width}:-1:flags=lanczos`)
  }
  return filters.join(',')
}

function seekArgs(startTime: number, duration: number): string[] {
  return ['-ss', startTime.toFixed(3), '-t', duration.toFixed(3)]
}

export function buildPaletteArgs(input: FfmpegBuildInput, palettePath: string): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    ...seekArgs(input.startTime, input.duration),
    '-i',
    input.inputPath,
    '-vf',
    `${videoFilters(input.options)},palettegen=stats_mode=diff`,
    '-frames:v',
    '1',
    '-progress',
    'pipe:1',
    '-nostats',
    palettePath,
  ]
}

export function buildGifArgs(
  input: FfmpegBuildInput,
  palettePath: string,
  outputPath: string,
): string[] {
  const filter = [
    `${videoFilters(input.options)}[palette_source]`,
    '[palette_source][1:v]paletteuse=dither=sierra2_4a[gif]',
  ].join(';')

  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    ...seekArgs(input.startTime, input.duration),
    '-i',
    input.inputPath,
    '-i',
    palettePath,
    '-filter_complex',
    filter,
    '-map',
    '[gif]',
    '-loop',
    input.options.loop ? '0' : '-1',
    '-progress',
    'pipe:1',
    '-nostats',
    outputPath,
  ]
}

export function createProgressParser(
  durationSeconds: number,
  onSeconds: (seconds: number) => void,
): (chunk: string) => void {
  let buffer = ''

  return (chunk: string) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const separator = line.indexOf('=')
      if (separator === -1) continue
      const key = line.slice(0, separator)
      const value = line.slice(separator + 1)

      if (key !== 'out_time_us' && key !== 'out_time_ms') continue
      const microseconds = Number.parseInt(value, 10)
      if (!Number.isFinite(microseconds) || microseconds < 0) continue
      onSeconds(Math.min(durationSeconds, microseconds / 1_000_000))
    }
  }
}

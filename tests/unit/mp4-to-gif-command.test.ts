import { describe, expect, it } from 'vitest'
import {
  buildGifArgs,
  buildPaletteArgs,
  createProgressParser,
} from '../../src/server/tools/mp4-to-gif/command'

const baseInput = {
  inputPath: '/tmp/input.mp4',
  startTime: 1.25,
  duration: 5,
  options: {
    fps: 12,
    width: 640 as const,
    startTime: 1.25,
    duration: 'full' as const,
    loop: true,
  },
}

describe('ffmpeg command builders', () => {
  it('builds a palette pass with trimmed input and lanczos scaling', () => {
    const args = buildPaletteArgs(baseInput, '/tmp/palette.png')
    const joined = args.join(' ')

    expect(joined).toContain('-ss 1.250 -t 5.000')
    expect(joined).toContain(
      'fps=12,scale=640:-1:flags=lanczos,palettegen=stats_mode=diff',
    )
    expect(args.at(-1)).toBe('/tmp/palette.png')
    expect(args).toContain('-frames:v')
  })

  it('omits scaling when the original width is requested', () => {
    const args = buildPaletteArgs(
      {
        ...baseInput,
        options: { ...baseInput.options, width: 'original' },
      },
      '/tmp/palette.png',
    )

    expect(args.join(' ')).not.toContain('scale=')
  })

  it('uses an infinite loop by default and no loop when disabled', () => {
    const looping = buildGifArgs(baseInput, '/tmp/palette.png', '/tmp/output.gif')
    const once = buildGifArgs(
      {
        ...baseInput,
        options: { ...baseInput.options, loop: false },
      },
      '/tmp/palette.png',
      '/tmp/output.gif',
    )

    expect(looping.join(' ')).toContain('-loop 0')
    expect(once.join(' ')).toContain('-loop -1')
    expect(looping.join(' ')).toContain('paletteuse=dither=sierra2_4a')
    expect(looping).toContain('-map')
  })
})

describe('createProgressParser', () => {
  it('parses ffmpeg progress output across chunks', () => {
    const values: number[] = []
    const parse = createProgressParser(10, (seconds) => values.push(seconds))

    parse('out_time_us=2000000\nprogress=continue\n')
    parse('out_time_us=5000000\nprogress=continue\n')
    parse('out_time_us=12000000\nprogress=end\n')

    expect(values).toEqual([2, 5, 10])
  })

  it('ignores malformed progress lines', () => {
    const values: number[] = []
    const parse = createProgressParser(10, (seconds) => values.push(seconds))

    parse('frame=12\nout_time_us=abc\n\nout_time_us=3000000\n')

    expect(values).toEqual([3])
  })
})

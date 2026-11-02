import { describe, expect, it } from 'vitest'
import {
  mp4ToGifDefaults,
  mp4ToGifOptionsSchema,
} from '../../src/shared/tools/mp4-to-gif'

describe('mp4ToGifOptionsSchema', () => {
  it('applies defaults', () => {
    expect(mp4ToGifDefaults).toEqual({
      fps: 12,
      width: 640,
      startTime: 0,
      duration: 'full',
      loop: true,
    })
  })

  it('coerces numeric strings from form data', () => {
    const parsed = mp4ToGifOptionsSchema.parse({
      fps: '15',
      width: '480',
      startTime: '1.5',
      duration: '4',
      loop: false,
    })

    expect(parsed).toEqual({
      fps: 15,
      width: 480,
      startTime: 1.5,
      duration: 4,
      loop: false,
    })
  })

  it('supports the original width option', () => {
    const parsed = mp4ToGifOptionsSchema.parse({ width: 'original' })
    expect(parsed.width).toBe('original')
  })

  it('rejects out-of-range frame rates', () => {
    expect(() => mp4ToGifOptionsSchema.parse({ fps: 2 })).toThrow()
    expect(() => mp4ToGifOptionsSchema.parse({ fps: 60 })).toThrow()
  })

  it('rejects overly long clips', () => {
    expect(() => mp4ToGifOptionsSchema.parse({ duration: 120 })).toThrow()
  })
})

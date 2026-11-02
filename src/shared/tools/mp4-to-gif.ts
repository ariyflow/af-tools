import { z } from 'zod'

export const MP4_TO_GIF_TOOL_ID = 'mp4-to-gif'

export const mp4ToGifOptionsSchema = z.object({
  fps: z.coerce.number().int().min(5).max(30).default(12),
  width: z
    .union([z.literal('original'), z.coerce.number().int().min(120).max(1280)])
    .default(640),
  startTime: z.coerce.number().min(0).max(3600).default(0),
  duration: z
    .union([z.literal('full'), z.coerce.number().min(0.1).max(60)])
    .default('full'),
  loop: z.boolean().default(true),
})

export type Mp4ToGifOptions = z.infer<typeof mp4ToGifOptionsSchema>

export const mp4ToGifDefaults: Mp4ToGifOptions = mp4ToGifOptionsSchema.parse({})

export const mp4ToGifWidthPresets = [320, 480, 640, 800, 1280] as const

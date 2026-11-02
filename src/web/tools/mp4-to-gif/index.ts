import type { WebToolModule } from '../types'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

const tool: WebToolModule = {
  meta: {
    id: 'mp4-to-gif',
    icon: 'film',
    category: 'video',
    tags: ['mp4', 'gif', 'video', 'ffmpeg', 'animation'],
    name: {
      'zh-CN': 'MP4 转 GIF',
      'en-US': 'MP4 to GIF',
    },
    description: {
      'zh-CN': '把视频片段转换为高质量、可循环播放的 GIF 动图。',
      'en-US': 'Turn video clips into high-quality, looping GIF animations.',
    },
    order: 10,
  },
  component: () => import('./Mp4ToGifTool.vue'),
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
}

export default tool

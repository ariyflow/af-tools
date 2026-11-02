import { createI18n } from 'vue-i18n'
import type { Locale } from '@/shared/tool'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'
import { toolMessages } from './tools/registry'

const STORAGE_KEY = 'af-tools-locale'

export function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh-CN' || stored === 'en-US') return stored
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': { ...zhCN, ...toolMessages['zh-CN'] },
    'en-US': { ...enUS, ...toolMessages['en-US'] },
  },
})

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

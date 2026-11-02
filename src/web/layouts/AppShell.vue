<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Home, Languages, Moon, Sparkles, Sun } from '@lucide/vue'
import type { Locale } from '@/shared/tool'
import { setLocale } from '@/web/i18n'
import { tools } from '@/web/tools/registry'
import { useTheme } from '@/web/composables/useTheme'
import ToolIcon from '@/web/components/ToolIcon.vue'

const route = useRoute()
const { t, locale } = useI18n()
const { theme, toggleTheme } = useTheme()

const homeActive = computed(() => route.name === 'home')

function toggleLocale(): void {
  setLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
}

function toolName(name: Record<Locale, string>): string {
  return name[locale.value as Locale] ?? name['en-US']
}
</script>

<template>
  <div class="relative min-h-screen">
    <div class="app-aurora" aria-hidden="true"></div>

    <div class="relative z-10 flex min-h-screen">
      <aside
        class="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-line bg-[var(--sidebar)] px-5 py-6 backdrop-blur-xl lg:flex"
      >
        <RouterLink to="/" class="flex items-center gap-3 rounded-2xl px-1">
          <span class="logo-mark">
            <Sparkles :size="20" />
          </span>
          <span class="min-w-0">
            <span
              class="block truncate text-[15px] font-semibold tracking-tight text-ink"
            >
              {{ t('app.name') }}
            </span>
            <span class="block truncate text-[11px] text-muted">
              {{ t('app.tagline') }}
            </span>
          </span>
        </RouterLink>

        <nav class="mt-8 flex-1 space-y-1.5">
          <p class="section-label">{{ t('nav.tools') }}</p>

          <RouterLink to="/" class="nav-item" :class="{ 'nav-item-active': homeActive }">
            <Home :size="18" />
            <span>{{ t('nav.home') }}</span>
          </RouterLink>

          <RouterLink
            v-for="tool in tools"
            :key="tool.meta.id"
            :to="`/tools/${tool.meta.id}`"
            class="nav-item"
            :class="{
              'nav-item-active': route.path === `/tools/${tool.meta.id}`,
            }"
          >
            <ToolIcon :name="tool.meta.icon" :size="18" />
            <span class="truncate">{{ toolName(tool.meta.name) }}</span>
          </RouterLink>
        </nav>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="control-button"
              :title="theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')"
              @click="toggleTheme"
            >
              <Sun v-if="theme === 'dark'" :size="17" />
              <Moon v-else :size="17" />
              <span class="truncate">{{
                theme === 'dark' ? t('theme.light') : t('theme.dark')
              }}</span>
            </button>
            <button
              type="button"
              class="control-button"
              :title="t('nav.switchLanguage')"
              @click="toggleLocale"
            >
              <Languages :size="17" />
              <span>{{ locale === 'zh-CN' ? 'EN' : '中文' }}</span>
            </button>
          </div>
          <p class="px-1 text-[11px] leading-5 text-muted">
            {{ t('footer.builtWith') }}
          </p>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[var(--header)] px-4 py-3 backdrop-blur-xl lg:hidden"
        >
          <RouterLink to="/" class="flex items-center gap-2.5">
            <span class="logo-mark size-9">
              <Sparkles :size="17" />
            </span>
            <span class="text-sm font-semibold tracking-tight text-ink">
              {{ t('app.name') }}
            </span>
          </RouterLink>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="icon-button"
              :title="theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')"
              @click="toggleTheme"
            >
              <Sun v-if="theme === 'dark'" :size="18" />
              <Moon v-else :size="18" />
            </button>
            <button
              type="button"
              class="icon-button"
              :title="t('nav.switchLanguage')"
              @click="toggleLocale"
            >
              <Languages :size="18" />
            </button>
          </div>
        </header>

        <main class="flex-1 px-4 pb-14 pt-7 sm:px-6 lg:px-10 lg:pt-10">
          <div class="mx-auto w-full max-w-6xl">
            <slot />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

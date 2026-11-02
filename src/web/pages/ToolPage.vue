<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from '@lucide/vue'
import type { Locale } from '@/shared/tool'
import { findTool } from '@/web/tools/registry'
import ToolIcon from '@/web/components/ToolIcon.vue'
import NotFoundPage from './NotFoundPage.vue'

const route = useRoute()
const { t, locale } = useI18n()

const tool = computed(() => findTool(String(route.params.toolId ?? '')))
const toolComponent = computed(() =>
  tool.value ? defineAsyncComponent(tool.value.component) : null,
)

function localized(value: Record<Locale, string>): string {
  return value[locale.value as Locale] ?? value['en-US']
}
</script>

<template>
  <div v-if="tool && toolComponent">
    <RouterLink
      to="/"
      class="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
    >
      <ArrowLeft :size="16" />
      {{ t('nav.home') }}
    </RouterLink>

    <header
      class="mt-5 flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="flex items-start gap-4">
        <span class="tool-page-icon">
          <ToolIcon :name="tool.meta.icon" :size="26" />
        </span>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {{ localized(tool.meta.name) }}
            </h1>
            <span class="category-pill">
              {{ t(`categories.${tool.meta.category}`) }}
            </span>
          </div>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-[15px]">
            {{ localized(tool.meta.description) }}
          </p>
        </div>
      </div>
    </header>

    <Suspense>
      <component :is="toolComponent" :key="tool.meta.id" />
      <template #fallback>
        <div class="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="skeleton-block h-[420px]"></div>
          <div class="skeleton-block h-[320px]"></div>
        </div>
      </template>
    </Suspense>
  </div>

  <NotFoundPage v-else />
</template>

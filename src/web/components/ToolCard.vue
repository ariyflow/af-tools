<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ArrowUpRight } from '@lucide/vue'
import type { Locale } from '@/shared/tool'
import type { WebToolModule } from '@/web/tools/types'
import ToolIcon from './ToolIcon.vue'

defineProps<{
  tool: WebToolModule
}>()

const { t, locale } = useI18n()

function localized(value: Record<Locale, string>): string {
  return value[locale.value as Locale] ?? value['en-US']
}
</script>

<template>
  <RouterLink
    :to="`/tools/${tool.meta.id}`"
    class="tool-card group"
    :aria-label="localized(tool.meta.name)"
  >
    <div class="flex items-start justify-between gap-4">
      <span class="tool-card-icon">
        <ToolIcon :name="tool.meta.icon" :size="24" />
      </span>
      <span
        class="inline-flex items-center rounded-full border border-line bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted"
      >
        {{ t(`categories.${tool.meta.category}`) }}
      </span>
    </div>

    <div class="mt-6">
      <h3 class="text-lg font-semibold tracking-tight text-ink">
        {{ localized(tool.meta.name) }}
      </h3>
      <p class="mt-2 text-sm leading-6 text-muted">
        {{ localized(tool.meta.description) }}
      </p>
    </div>

    <div class="mt-6 flex items-center justify-between">
      <span class="text-xs font-medium text-muted">
        {{ t('home.openTool') }}
      </span>
      <span
        class="grid size-9 place-items-center rounded-full border border-line bg-[var(--surface-muted)] text-muted transition-all duration-200 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-soft)] group-hover:text-accent"
      >
        <ArrowUpRight :size="17" />
      </span>
    </div>
  </RouterLink>
</template>

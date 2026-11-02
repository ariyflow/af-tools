<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, ShieldCheck, Sparkles } from '@lucide/vue'
import type { ToolCategory } from '@/shared/tool'
import { tools } from '@/web/tools/registry'
import ToolCard from '@/web/components/ToolCard.vue'

const { t } = useI18n()

const query = ref('')
const activeCategory = ref<'all' | ToolCategory>('all')
const searchInput = ref<HTMLInputElement | null>(null)

const categories = computed(() => {
  const seen = new Set<ToolCategory>()
  for (const tool of tools) seen.add(tool.meta.category)
  return [...seen]
})

const filteredTools = computed(() => {
  const search = query.value.trim().toLowerCase()
  return tools.filter((tool) => {
    if (activeCategory.value !== 'all' && tool.meta.category !== activeCategory.value) {
      return false
    }
    if (!search) return true
    const haystack = [
      tool.meta.name['zh-CN'],
      tool.meta.name['en-US'],
      tool.meta.description['zh-CN'],
      tool.meta.description['en-US'],
      ...tool.meta.tags,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(search)
  })
})

function handleShortcut(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
  }
}

function clearFilters(): void {
  query.value = ''
  activeCategory.value = 'all'
}

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>

<template>
  <div class="space-y-10">
    <section
      class="relative overflow-hidden rounded-[32px] border border-line bg-[var(--hero-surface)] px-6 py-10 shadow-[var(--shadow)] sm:px-10 sm:py-14"
    >
      <div class="hero-orb hero-orb-one" aria-hidden="true"></div>
      <div class="hero-orb hero-orb-two" aria-hidden="true"></div>

      <div class="relative max-w-3xl">
        <span class="eyebrow">
          <Sparkles :size="14" />
          {{ t('home.eyebrow') }}
        </span>

        <h1
          class="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-ink sm:text-5xl"
        >
          {{ t('home.title') }}
        </h1>
        <p
          class="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8"
        >
          {{ t('home.subtitle') }}
        </p>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label class="search-box flex-1">
            <Search :size="18" class="shrink-0 text-muted" />
            <input
              ref="searchInput"
              v-model="query"
              type="search"
              :placeholder="t('home.search')"
              class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            <span
              class="hidden items-center gap-1 rounded-md border border-line px-1.5 py-1 text-[10px] font-medium text-muted sm:flex"
            >
              <span class="text-[13px]">⌘</span>K
            </span>
          </label>

          <div
            class="flex items-center gap-2 rounded-xl border border-line bg-[var(--surface-muted)] px-3.5 py-3 text-xs text-muted"
          >
            <ShieldCheck :size="15" class="text-accent" />
            <span>{{ t('home.privacy') }}</span>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {{ t('nav.tools') }}
          </p>
          <h2 class="mt-2 text-2xl font-semibold tracking-tight text-ink">
            {{ t('home.resultCount', { count: filteredTools.length }) }}
          </h2>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip-active': activeCategory === 'all' }"
            @click="activeCategory = 'all'"
          >
            {{ t('home.all') }}
          </button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip-active': activeCategory === category }"
            @click="activeCategory = category"
          >
            {{ t(`categories.${category}`) }}
          </button>
        </div>
      </div>

      <div
        v-if="filteredTools.length"
        class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <ToolCard v-for="tool in filteredTools" :key="tool.meta.id" :tool="tool" />

        <div v-if="!query && activeCategory === 'all'" class="coming-soon-card">
          <span
            class="grid size-11 place-items-center rounded-2xl border border-dashed border-[var(--border-strong)] text-muted"
          >
            <Sparkles :size="20" />
          </span>
          <p class="mt-4 text-sm font-medium text-ink">
            {{ t('home.comingSoon') }}
          </p>
        </div>
      </div>

      <div v-else class="empty-state">
        <Search :size="24" class="text-muted" />
        <p class="mt-4 text-base font-medium text-ink">{{ t('home.empty') }}</p>
        <p class="mt-2 text-sm text-muted">{{ t('home.emptyHint') }}</p>
        <button type="button" class="btn-secondary mt-5" @click="clearFilters">
          {{ t('home.all') }}
        </button>
      </div>
    </section>

    <p class="text-center text-[11px] text-muted">
      {{ t('footer.builtWith') }}
    </p>
  </div>
</template>

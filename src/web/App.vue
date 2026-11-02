<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Locale } from '@/shared/tool'
import AppShell from '@/web/layouts/AppShell.vue'
import { findTool } from '@/web/tools/registry'

const route = useRoute()
const { t, locale } = useI18n()

watchEffect(() => {
  const toolId = typeof route.params.toolId === 'string' ? route.params.toolId : ''
  const tool = toolId ? findTool(toolId) : undefined
  const suffix = tool
    ? (tool.meta.name[locale.value as Locale] ?? tool.meta.name['en-US'])
    : t('app.tagline')
  document.title = `${t('app.name')} · ${suffix}`
})
</script>

<template>
  <AppShell>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
</template>

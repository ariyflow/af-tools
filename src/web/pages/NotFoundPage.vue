<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from '@lucide/vue'

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-[50vh] flex-col items-center justify-center text-center">
    <p class="text-[92px] font-semibold leading-none tracking-[-0.08em] text-gradient">
      404
    </p>
    <p class="mt-4 text-lg font-medium text-ink">{{ t('errors.NOT_FOUND') }}</p>
    <RouterLink to="/" class="btn-primary mt-7">
      <ArrowLeft :size="17" />
      {{ t('nav.home') }}
    </RouterLink>
  </div>
</template>

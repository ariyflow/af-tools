<script setup lang="ts">
import { computed } from 'vue'
import { Code2, Film, Image, Type, Wrench } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
  }>(),
  {
    size: 20,
    strokeWidth: 1.8,
  },
)

const icons = {
  film: Film,
  image: Image,
  text: Type,
  developer: Code2,
}

const icon = computed(() => icons[props.name as keyof typeof icons] ?? Wrench)
</script>

<template>
  <component :is="icon" :size="size" :stroke-width="strokeWidth" aria-hidden="true" />
</template>

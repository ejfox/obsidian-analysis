<template>
  <ClientOnly>
    <UMAPPlot v-bind="$attrs" @point-select="$emit('point-select', $event)" @point-hover="$emit('point-hover', $event)" />
  </ClientOnly>
</template>

<script setup>
import UMAPPlot from './UMAPPlot.vue'

defineEmits(['point-select', 'point-hover'])
</script>
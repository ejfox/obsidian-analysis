<template>
  <ClientOnly>
    <UMAPPlot v-bind="$attrs" />
  </ClientOnly>
</template>

<script setup>
import UMAPPlot from './UMAPPlot.vue'
</script>
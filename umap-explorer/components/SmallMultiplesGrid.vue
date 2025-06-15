<template>
  <div class="small-multiples-grid">
    <div 
      v-for="paramSet in parameterSets" 
      :key="paramSet.id"
      class="plot-container"
      @click="$emit('plot-click', paramSet)"
    >
      <div class="plot-header">
        <span class="param-label">n={{ paramSet.params.n_neighbors }}</span>
        <span class="param-label">d={{ paramSet.params.min_dist }}</span>
        <span class="param-label">{{ paramSet.params.metric }}</span>
      </div>
      
      <ClientOnlyPlot
        :plot-data="paramSet.data"
        :width="plotSize"
        :height="plotSize"
        :color-scheme="colorScheme"
        :interactive="false"
        :point-size="2"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ClientOnlyPlot from './ClientOnlyPlot.vue'

const props = defineProps({
  parameterSets: Array,
  colorScheme: String
})

const emit = defineEmits(['plot-click'])

const plotSize = computed(() => {
  const gridCols = Math.ceil(Math.sqrt(props.parameterSets.length))
  return Math.min(350, (window.innerWidth - 100) / gridCols)
})
</script>

<style scoped>
.small-multiples-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  padding: 32px;
  height: calc(100vh - 100px);
  overflow-y: auto;
  place-items: center;
  align-content: center;
}

.plot-container {
  background: rgba(0, 0, 0, 0.9);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  width: 100%;
  max-width: 400px;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
}

.plot-container::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(45deg, #00ff00, #00ffff);
  opacity: 0;
  filter: blur(10px);
  transition: opacity 0.3s ease;
  z-index: -1;
}

.plot-container:hover {
  border-color: #00ff00;
  transform: scale(1.02);
}

.plot-container:hover::before {
  opacity: 0.3;
}

.plot-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #00ff00;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.8);
  flex-shrink: 0;
}

.param-label {
  font-family: 'JetBrains Mono', monospace;
  opacity: 0.8;
}
</style>
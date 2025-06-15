<template>
  <div class="small-multiples-grid" :style="{ '--grid-cols': plotSize.cols }">
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
        :width="plotSize.size"
        :height="plotSize.size"
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
  const plotCount = props.parameterSets.length
  
  // Determine optimal grid layout
  let gridCols = 3
  if (plotCount > 36) gridCols = 8      // 8x8 = 64 plots
  else if (plotCount > 16) gridCols = 6  // 6x6 = 36 plots  
  else if (plotCount > 9) gridCols = 4   // 4x4 = 16 plots
  
  const containerWidth = window.innerWidth - 64
  const spacing = 12
  const plotSize = Math.max(80, Math.floor((containerWidth - (spacing * (gridCols + 1))) / gridCols))
  
  return { size: plotSize, cols: gridCols }
})
</script>

<style scoped>
.small-multiples-grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 3), 1fr);
  gap: 12px;
  padding: 24px;
  height: calc(100vh - 100px);
  overflow-y: auto;
  place-items: center;
  align-content: start;
}

.plot-container {
  background: rgba(0, 0, 0, 0.9);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  width: 100%;
  max-width: 200px;
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
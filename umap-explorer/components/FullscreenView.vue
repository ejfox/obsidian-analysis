<template>
  <div class="fullscreen-view">
    <div class="fullscreen-header">
      <h2>
        <span class="param">n_neighbors={{ plotData.params.n_neighbors }}</span>
        <span class="param">min_dist={{ plotData.params.min_dist }}</span>
        <span class="param">{{ plotData.params.metric }}</span>
      </h2>
      <button @click="$emit('close')" class="close-btn">
        <span class="shortcut">ESC</span> CLOSE
      </button>
    </div>
    
    <div class="fullscreen-content">
      <!-- Full-window scatterplot -->
      <div class="plot-area">
        <ClientOnlyPlot
          :plot-data="plotData.data"
          :width="plotDimensions.width"
          :height="plotDimensions.height"
          :color-scheme="colorScheme"
          :interactive="true"
          :point-size="5"
          :selected-points="selectedIndices"
          @point-select="handlePointSelection"
          @point-hover="handlePointHover"
        />
        
        <!-- Hover tooltip -->
        <div v-if="hoveredChunk" class="hover-tooltip" :style="tooltipStyle">
          <div class="tooltip-title">{{ hoveredChunk.title }}</div>
          <div class="tooltip-info">{{ hoveredChunk.wordCount }} words</div>
        </div>
      </div>
      
      <!-- Floating overlay sidebar -->
      <ChunkDetails 
        v-if="selectedChunks.length > 0"
        :chunks="selectedChunks"
        :related-chunks="relatedChunks"
        @close="clearSelection"
        class="floating-sidebar"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ClientOnlyPlot from './ClientOnlyPlot.vue'
import ChunkDetails from './ChunkDetails.vue'

const props = defineProps({
  plotData: Object,
  colorScheme: String
})

const emit = defineEmits(['close', 'point-select'])

const selectedChunks = ref([])
const selectedIndices = ref([])
const hoveredChunk = ref(null)
const mousePosition = ref({ x: 0, y: 0 })

const plotDimensions = computed(() => ({
  width: window.innerWidth,
  height: window.innerHeight - 80
}))

const tooltipStyle = computed(() => ({
  left: `${mousePosition.value.x + 10}px`,
  top: `${mousePosition.value.y - 30}px`
}))

const relatedChunks = computed(() => {
  if (selectedChunks.value.length === 0) return []
  
  const primaryChunk = selectedChunks.value[0]
  
  // Find chunks from same note, same community, or nearby in embedding space
  return props.plotData.data
    .map((chunk, idx) => ({ ...chunk, index: idx }))
    .filter(chunk => {
      // Skip if already selected
      if (selectedIndices.value.includes(chunk.index)) return false
      
      // Same note (highest priority)
      if (chunk.filePath === primaryChunk.filePath) return true
      
      // Same community (medium priority)
      if (chunk.community !== undefined && chunk.community === primaryChunk.community) return true
      
      // Calculate embedding distance (lowest priority)
      const dx = chunk.x - primaryChunk.x
      const dy = chunk.y - primaryChunk.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      return distance < 0.15 // Nearby in embedding space
    })
    .slice(0, 15) // Show more related chunks
})

const handlePointSelection = (points) => {
  if (points.length > 0) {
    const primaryChunk = points[0]
    selectedChunks.value = points
    
    // Find indices of chunks from the same note AND same community
    selectedIndices.value = props.plotData.data
      .map((chunk, idx) => {
        // Same note (always highlight)
        if (chunk.filePath === primaryChunk.filePath) return idx
        
        // Same community (also highlight if community data exists)
        if (chunk.community !== undefined && 
            primaryChunk.community !== undefined && 
            chunk.community === primaryChunk.community) {
          return idx
        }
        
        return -1
      })
      .filter(idx => idx >= 0)
    
    emit('point-select', primaryChunk)
  }
}

const handlePointHover = (point) => {
  hoveredChunk.value = point
}

const clearSelection = () => {
  selectedChunks.value = []
  selectedIndices.value = []
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

const handleMouseMove = (e) => {
  mousePosition.value = { x: e.clientX, y: e.clientY }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
.fullscreen-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0a0a0a;
  z-index: 1000;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #1a1a1a;
  background: rgba(0, 0, 0, 0.9);
}

.fullscreen-header h2 {
  margin: 0;
  font-size: 14px;
  color: #00ff00;
  font-family: 'JetBrains Mono', monospace;
  display: flex;
  gap: 20px;
}

.param {
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.param:hover {
  opacity: 1;
}

.close-btn {
  background: transparent;
  border: 1px solid #333;
  color: #666;
  padding: 8px 16px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  border-color: #00ff00;
  color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}

.shortcut {
  opacity: 0.5;
  font-size: 10px;
}

.fullscreen-content {
  position: relative;
  height: calc(100vh - 80px);
  overflow: hidden;
}

.plot-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.floating-sidebar {
  position: absolute !important;
  top: 24px;
  right: 24px;
  width: 420px !important;
  height: calc(100vh - 140px) !important;
  background: rgba(10, 10, 10, 0.85) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important;
}

.hover-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #00ff00;
  padding: 8px 12px;
  font-size: 12px;
  pointer-events: none;
  z-index: 100;
  max-width: 300px;
}

.tooltip-title {
  color: #00ff00;
  margin-bottom: 4px;
}

.tooltip-info {
  color: #666;
  font-size: 11px;
}
</style>
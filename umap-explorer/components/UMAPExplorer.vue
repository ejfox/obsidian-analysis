<template>
  <div class="umap-explorer">
    <!-- Grid view -->
    <SmallMultiplesGrid 
      v-if="!fullscreenPlot"
      :parameter-sets="parameterSets"
      :color-scheme="colorScheme"
      @plot-click="enterFullscreen"
    />
    
    <!-- Fullscreen view -->
    <FullscreenView 
      v-else
      :plot-data="fullscreenPlot"
      :color-scheme="colorScheme"
      @close="exitFullscreen"
      @point-select="handlePointSelection"
    />
    
    <!-- Control panel -->
    <ControlPanel 
      v-model:color-scheme="colorScheme"
      :available-schemes="colorSchemes"
      @refresh="loadData"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SmallMultiplesGrid from './SmallMultiplesGrid.vue'
import FullscreenView from './FullscreenView.vue'
import ControlPanel from './ControlPanel.vue'

const parameterSets = ref([])
const fullscreenPlot = ref(null)
const colorScheme = ref('modularity')

const colorSchemes = [
  { id: 'modularity', label: 'Topic Clusters', field: 'communityColor' },
  { id: 'temporal', label: 'Time-based', field: 'relativePosition' },
  { id: 'size', label: 'Note Size', field: 'wordCount' },
  { id: 'connections', label: 'Link Density', field: 'hasLinks' }
]

const loadData = async () => {
  try {
    const response = await fetch('/orcmanl_umap_64_combinations.json')
    const data = await response.json()
    
    console.log('Loaded UMAP data:', data.results?.length, 'combinations')
    
    // Show all available parameter combinations (up to 64)
    parameterSets.value = data.results.slice(0, 64).map(result => ({
      id: result.metadata.parameterString,
      params: result.parameters,
      data: result.data,
      metadata: result.metadata
    }))
  } catch (error) {
    console.error('Failed to load UMAP data:', error)
  }
}

const enterFullscreen = (plotData) => {
  fullscreenPlot.value = plotData
}

const exitFullscreen = () => {
  fullscreenPlot.value = null
}

const handlePointSelection = (point) => {
  console.log('Selected point:', point)
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.umap-explorer {
  width: 100%;
  height: 100vh;
  background: #0a0a0a;
  color: #00ff00;
  font-family: 'JetBrains Mono', monospace;
  position: relative;
}
</style>
<template>
  <div class="umap-container">
    <div class="controls">
      <h2>UMAP Parameter Explorer</h2>
      <div class="parameter-selector">
        <label>
          Parameter Set:
          <select v-model="selectedParameterIndex" @change="updateVisualization">
            <option v-for="(result, index) in umapData.results" :key="index" :value="index">
              n_neighbors: {{ result.parameters.n_neighbors }}, 
              min_dist: {{ result.parameters.min_dist }}, 
              metric: {{ result.parameters.metric }}
            </option>
          </select>
        </label>
      </div>
      <div class="stats">
        <p>Total samples: {{ umapData.totalSamples }}</p>
        <p v-if="currentData">Current view: {{ currentData.length }} points</p>
        <p v-if="!umapData.results.length" class="loading">Loading UMAP data...</p>
      </div>
    </div>
    <div class="scatterplot-container">
      <canvas ref="scatterplotCanvas" width="800" height="600"></canvas>
      <p v-if="!currentData || !currentData.length" class="no-data">
        No visualization data available
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'

const scatterplotCanvas = ref(null)
const selectedParameterIndex = ref(0)
const umapData = ref({ results: [], totalSamples: 0 })
let scatterplot = null

const currentData = computed(() => {
  if (!umapData.value.results.length) return null
  return umapData.value.results[selectedParameterIndex.value]?.data || []
})

const loadUmapData = async () => {
  try {
    const response = await fetch('/umap_parameter_surf_2025-06-13T14:19:30.json')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    umapData.value = data
    console.log('UMAP data loaded:', data.totalSamples, 'samples,', data.results.length, 'parameter sets')
  } catch (error) {
    console.error('Error loading UMAP data:', error)
    // Fallback empty data structure
    umapData.value = { results: [], totalSamples: 0 }
  }
}

const initializeScatterplot = async () => {
  if (!scatterplotCanvas.value || !currentData.value?.length) {
    console.log('Cannot initialize - missing canvas or data')
    return
  }
  
  try {
    const createScatterplot = (await import('regl-scatterplot')).default
    
    scatterplot = createScatterplot({
      canvas: scatterplotCanvas.value,
      width: 800,
      height: 600,
      pointSize: 5,
      background: [0.1, 0.1, 0.1, 1],
    })
    
    console.log('Scatterplot initialized successfully')
    updateVisualization()
  } catch (error) {
    console.error('Error initializing scatterplot:', error)
  }
}

const updateVisualization = () => {
  if (!scatterplot || !currentData.value || !currentData.value.length) {
    console.log('Cannot update visualization - missing scatterplot or data')
    return
  }
  
  // Normalize coordinates to [-1, 1] range
  const xValues = currentData.value.map(p => p.x)
  const yValues = currentData.value.map(p => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  const points = currentData.value.map(point => {
    const normalizedX = 2 * (point.x - xMin) / (xMax - xMin) - 1
    const normalizedY = 2 * (point.y - yMin) / (yMax - yMin) - 1
    const hue = (point.folderColor || 0) * 60
    const colorValue = hue / 360
    return [normalizedX, normalizedY, colorValue]
  })
  
  console.log('Drawing', points.length, 'points')
  scatterplot.draw(points)
}

watch(selectedParameterIndex, () => {
  updateVisualization()
})

onMounted(async () => {
  await loadUmapData()
  await nextTick()
  await initializeScatterplot()
})
</script>

<style scoped>
.umap-container {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  background: #1a1a1a;
  color: white;
}

.controls {
  margin-bottom: 20px;
}

.controls h2 {
  margin: 0 0 15px 0;
  color: #fff;
}

.parameter-selector {
  margin-bottom: 15px;
}

.parameter-selector label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.parameter-selector select {
  padding: 8px;
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
}

.stats p {
  margin: 5px 0;
  color: #ccc;
  font-size: 14px;
}

.scatterplot-container {
  width: 800px;
  height: 600px;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.scatterplot-container canvas {
  display: block;
  background: #1a1a1a;
}

.no-data {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #888;
  font-style: italic;
  pointer-events: none;
}

.loading {
  color: #888;
  font-style: italic;
}
</style>
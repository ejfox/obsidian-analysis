<template>
  <div class="app-container">
    <NuxtRouteAnnouncer />
    
    <div class="view-toggle">
      <button 
        @click="currentView = 'explorer'" 
        :class="{ active: currentView === 'explorer' }"
        class="toggle-btn"
      >
        SINGLE VIEW
      </button>
      <button 
        @click="currentView = 'grid'" 
        :class="{ active: currentView === 'grid' }"
        class="toggle-btn"
      >
        PARAMETER SURF
      </button>
    </div>
    
    <SingleView 
      v-if="currentView === 'explorer' && umapData.results?.length" 
      :umap-data="umapData" 
    />
    
    <UMAPExplorer 
      v-else-if="currentView === 'grid' && umapData.results?.length"
    />
    
    <div v-else class="loading-screen">
      <div class="loading-text">LOADING YOUR MIND...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SingleView from './components/SingleView.vue'
import UMAPExplorer from './components/UMAPExplorer.vue'

const umapData = ref({ results: [], totalSamples: 0 })
const currentView = ref('grid')

const loadUmapData = async () => {
  try {
    const response = await fetch('/umap_parameter_surf_with_communities.json')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    umapData.value = data
    console.log('Loaded', data.totalSamples, 'samples,', data.results.length, 'parameter sets')
  } catch (error) {
    console.error('Error loading UMAP data:', error)
  }
}

onMounted(() => {
  loadUmapData()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

body {
  margin: 0;
  padding: 0;
  background: #0a0a0a;
  color: #00ff00;
  font-family: 'JetBrains Mono', monospace;
}

.loading-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
}

.loading-text {
  margin-top: 20px;
  font-size: 12px;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.view-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.9);
  padding: 5px;
  border: 1px solid #1a1a1a;
}

.toggle-btn {
  background: transparent;
  border: 1px solid #333;
  color: #666;
  padding: 8px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  border-color: #00ff00;
  color: #00ff00;
}

.toggle-btn.active {
  background: rgba(0, 255, 0, 0.1);
  border-color: #00ff00;
  color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}
</style>

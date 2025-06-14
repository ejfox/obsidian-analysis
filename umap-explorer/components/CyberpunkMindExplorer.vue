<template>
  <div class="cyberpunk-explorer" @keydown="handleKeydown" tabindex="0">
    <!-- Terminal-style header -->
    <div class="terminal-header">
      <span class="prompt">root@mind:~$</span>
      <span class="cursor">█</span>
      <div class="system-info">
        <span>{{ thoughtData.length }} THOUGHTS</span>
        <span>{{ selectedThoughts.length }} SELECTED</span>
        <span>{{ currentMode.toUpperCase() }}</span>
      </div>
    </div>

    <!-- Search interface -->
    <div class="search-interface">
      <input 
        v-model="searchQuery" 
        placeholder="> query your mind..."
        @input="executeSearch"
        class="terminal-input"
        ref="searchInput"
      />
      <div class="search-results" v-if="searchResults.length">
        {{ searchResults.length }} matches found
      </div>
    </div>

    <!-- Main visualization -->
    <canvas 
      ref="canvas"
      :width="canvasSize.width" 
      :height="canvasSize.height"
      @click="handleCanvasClick"
      @mousemove="handleMouseMove"
      @wheel="handleWheel"
      class="mind-canvas"
    ></canvas>

    <!-- Mode selector -->
    <div class="mode-selector">
      <div 
        v-for="mode in modes" 
        :key="mode.id"
        :class="['mode-btn', { active: currentMode === mode.id }]"
        @click="switchMode(mode.id)"
      >
        {{ mode.label }}
      </div>
    </div>

    <!-- Thought details panel -->
    <div v-if="selectedThought" class="thought-panel">
      <div class="panel-header">
        <span class="thought-title">{{ selectedThought.title }}</span>
        <button @click="selectedThought = null" class="close-btn">[X]</button>
      </div>
      <div class="thought-metadata">
        <span>{{ selectedThought.wordCount }}w</span>
        <span>{{ getFolderName(selectedThought.folder) }}</span>
        <span v-if="selectedThought.hasCode" class="tag">CODE</span>
        <span v-if="selectedThought.chunkText?.includes('?')" class="tag">QUESTION</span>
      </div>
      <div class="thought-content">{{ selectedThought.chunkText }}</div>
      <div class="related-section">
        <div class="section-title">RELATED THOUGHTS</div>
        <div v-for="related in getRelatedThoughts(selectedThought)" :key="related.filePath" 
             class="related-item" @click="selectThought(related)">
          {{ related.title }}
        </div>
      </div>
    </div>

    <!-- Insights panel -->
    <div class="insights-panel">
      <div class="insight-btn" @click="showObsessions()">
        <span class="icon">🔥</span>
        <span>OBSESSIONS</span>
      </div>
      <div class="insight-btn" @click="showOrphans()">
        <span class="icon">🏝️</span>
        <span>ORPHANS</span>
      </div>
      <div class="insight-btn" @click="showQuestions()">
        <span class="icon">❓</span>
        <span>QUESTIONS</span>
      </div>
      <div class="insight-btn" @click="showEvolution()">
        <span class="icon">📈</span>
        <span>EVOLUTION</span>
      </div>
    </div>

    <!-- Connection visualization -->
    <svg class="connections-overlay" :width="canvasSize.width" :height="canvasSize.height" v-if="showConnections">
      <line 
        v-for="connection in visibleConnections" 
        :key="connection.id"
        :x1="connection.x1" :y1="connection.y1" 
        :x2="connection.x2" :y2="connection.y2"
        stroke="#00ff00" stroke-width="1" opacity="0.3"
      />
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  umapData: { type: Object, required: true }
})

const canvas = ref(null)
const searchInput = ref(null)
const searchQuery = ref('')
const selectedThought = ref(null)
const selectedThoughts = ref([])
const currentMode = ref('semantic')
const showConnections = ref(false)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })

let scatterplot = null
const canvasSize = { width: 1400, height: 800 }

const modes = [
  { id: 'semantic', label: 'SEMANTIC' },
  { id: 'temporal', label: 'TEMPORAL' },
  { id: 'size', label: 'SIZE' },
  { id: 'connections', label: 'LINKS' },
]

const thoughtData = computed(() => {
  return props.umapData.results?.[0]?.data || []
})

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  
  const query = searchQuery.value.toLowerCase()
  return thoughtData.value.filter(thought => 
    thought.chunkText.toLowerCase().includes(query) ||
    thought.title.toLowerCase().includes(query)
  )
})

const visibleConnections = computed(() => {
  if (!showConnections.value || !selectedThought.value) return []
  
  const related = getRelatedThoughts(selectedThought.value)
  return related.map((relatedThought, i) => ({
    id: i,
    x1: getScreenPosition(selectedThought.value).x,
    y1: getScreenPosition(selectedThought.value).y,
    x2: getScreenPosition(relatedThought).x,
    y2: getScreenPosition(relatedThought).y,
  }))
})

const getScreenPosition = (thought) => {
  const xValues = thoughtData.value.map(p => p.x)
  const yValues = thoughtData.value.map(p => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  const normalizedX = (thought.x - xMin) / (xMax - xMin)
  const normalizedY = 1 - (thought.y - yMin) / (yMax - yMin)
  
  return {
    x: normalizedX * canvasSize.width,
    y: normalizedY * canvasSize.height
  }
}

const getColorValue = (thought) => {
  switch(currentMode.value) {
    case 'temporal':
      // Extract date from filename
      const filename = thought.filePath?.split('/').pop() || ''
      const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (dateMatch) {
        const date = new Date(dateMatch[0])
        return (date.getTime() / (1000 * 60 * 60 * 24)) / 20000
      }
      return 0.5
    case 'size':
      return Math.min(thought.wordCount / 500, 1)
    case 'connections':
      const related = getRelatedThoughts(thought)
      return Math.min(related.length / 10, 1)
    default: // semantic
      return (thought.folderColor || 0) / 10
  }
}

const getFolderName = (path) => {
  return path?.split('/').slice(-2).join('/') || 'unknown'
}

const getRelatedThoughts = (thought) => {
  if (!thought) return []
  
  return thoughtData.value
    .filter(other => other !== thought)
    .filter(other => {
      // Same folder
      if (other.folder === thought.folder) return true
      
      // Shared significant words
      const thoughtWords = thought.chunkText.toLowerCase().split(/\W+/).filter(w => w.length > 4)
      const otherWords = other.chunkText.toLowerCase().split(/\W+/).filter(w => w.length > 4)
      const sharedWords = thoughtWords.filter(w => otherWords.includes(w))
      
      return sharedWords.length >= 2
    })
    .slice(0, 8)
}

const executeSearch = () => {
  updateVisualization()
}

const switchMode = (mode) => {
  currentMode.value = mode
  showConnections.value = mode === 'connections'
  updateVisualization()
}

const selectThought = (thought) => {
  selectedThought.value = thought
  showConnections.value = true
  updateVisualization()
}

const handleCanvasClick = (e) => {
  const rect = canvas.value.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width * 2 - 1) / zoom.value - pan.value.x
  const y = (1 - (e.clientY - rect.top) / rect.height * 2) / zoom.value - pan.value.y
  
  const nearest = findNearestThought(x, y)
  if (nearest) {
    selectThought(nearest)
  }
}

const handleMouseMove = (e) => {
  // Could add hover preview here
}

const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  zoom.value = Math.max(0.5, Math.min(3, zoom.value * delta))
  updateVisualization()
}

const handleKeydown = (e) => {
  switch(e.key) {
    case '/':
      e.preventDefault()
      searchInput.value?.focus()
      break
    case 'Escape':
      selectedThought.value = null
      searchQuery.value = ''
      showConnections.value = false
      updateVisualization()
      break
    case '1': switchMode('semantic'); break
    case '2': switchMode('temporal'); break
    case '3': switchMode('size'); break
    case '4': switchMode('connections'); break
  }
}

const findNearestThought = (x, y) => {
  let minDist = Infinity
  let nearest = null
  
  const xValues = thoughtData.value.map(p => p.x)
  const yValues = thoughtData.value.map(p => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  thoughtData.value.forEach(thought => {
    const normalizedX = 2 * (thought.x - xMin) / (xMax - xMin) - 1
    const normalizedY = 2 * (thought.y - yMin) / (yMax - yMin) - 1
    
    const dist = Math.sqrt(Math.pow(normalizedX - x, 2) + Math.pow(normalizedY - y, 2))
    if (dist < minDist && dist < 0.1) {
      minDist = dist
      nearest = thought
    }
  })
  
  return nearest
}

const showObsessions = () => {
  // Find clusters with most notes
  const folders = {}
  thoughtData.value.forEach(thought => {
    const folder = getFolderName(thought.folder)
    if (!folders[folder]) folders[folder] = []
    folders[folder].push(thought)
  })
  
  const topFolders = Object.entries(folders)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 3)
  
  console.log('Your obsessions:', topFolders.map(([name, thoughts]) => `${name}: ${thoughts.length} thoughts`))
  
  // Highlight these thoughts
  const obsessionThoughts = topFolders.flatMap(([,thoughts]) => thoughts)
  highlightThoughts(obsessionThoughts)
}

const showOrphans = () => {
  const orphans = thoughtData.value.filter(thought => {
    const related = getRelatedThoughts(thought)
    return related.length < 2
  })
  
  console.log('Found', orphans.length, 'orphaned thoughts')
  highlightThoughts(orphans)
}

const showQuestions = () => {
  const questions = thoughtData.value.filter(thought => 
    thought.chunkText.includes('?')
  )
  
  console.log('Found', questions.length, 'questions')
  highlightThoughts(questions)
}

const showEvolution = () => {
  // Show thoughts chronologically
  const dated = thoughtData.value
    .map(thought => {
      const filename = thought.filePath?.split('/').pop() || ''
      const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/)
      return {
        ...thought,
        date: dateMatch ? new Date(dateMatch[0]) : null
      }
    })
    .filter(t => t.date)
    .sort((a, b) => a.date - b.date)
  
  console.log('Evolution:', dated.length, 'dated thoughts')
  highlightThoughts(dated)
}

const highlightThoughts = (thoughts) => {
  selectedThoughts.value = thoughts
  updateVisualization()
}

const updateVisualization = async () => {
  if (!canvas.value || !thoughtData.value.length) return
  
  if (!scatterplot) {
    const createScatterplot = (await import('regl-scatterplot')).default
    scatterplot = createScatterplot({
      canvas: canvas.value,
      width: canvasSize.width,
      height: canvasSize.height,
      pointSize: 5,
      background: [0.02, 0.02, 0.02, 1],
    })
  }
  
  // Normalize coordinates
  const xValues = thoughtData.value.map(p => p.x)
  const yValues = thoughtData.value.map(p => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  const points = thoughtData.value.map(thought => {
    const normalizedX = ((2 * (thought.x - xMin) / (xMax - xMin) - 1) + pan.value.x) / zoom.value
    const normalizedY = ((2 * (thought.y - yMin) / (yMax - yMin) - 1) + pan.value.y) / zoom.value
    
    let opacity = 0.7
    
    // Highlight search results
    if (searchQuery.value && searchResults.value.includes(thought)) {
      opacity = 1
    } else if (searchQuery.value && !searchResults.value.includes(thought)) {
      opacity = 0.1
    }
    
    // Highlight selected thoughts
    if (selectedThoughts.value.includes(thought)) {
      opacity = 1
    } else if (selectedThoughts.value.length > 0) {
      opacity = 0.2
    }
    
    // Highlight selected thought
    if (selectedThought.value === thought) {
      opacity = 1
    }
    
    const colorValue = getColorValue(thought)
    return [normalizedX, normalizedY, colorValue, opacity]
  })
  
  scatterplot.draw(points)
}

watch(() => props.umapData, () => {
  updateVisualization()
})

onMounted(() => {
  updateVisualization()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

.cyberpunk-explorer {
  width: 100vw;
  height: 100vh;
  background: #0a0a0a;
  color: #00ff00;
  font-family: 'JetBrains Mono', monospace;
  position: relative;
  outline: none;
  overflow: hidden;
}

.terminal-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  border-bottom: 1px solid #00ff00;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 200;
  font-size: 12px;
}

.prompt {
  color: #00ff00;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.system-info {
  display: flex;
  gap: 20px;
  font-size: 10px;
  color: #666;
}

.search-interface {
  position: absolute;
  top: 50px;
  left: 20px;
  right: 20px;
  z-index: 150;
}

.terminal-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  color: #00ff00;
  padding: 12px;
  font-family: inherit;
  font-size: 14px;
}

.terminal-input:focus {
  outline: none;
  border-color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}

.search-results {
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #00ff00;
  padding: 5px 12px;
  font-size: 11px;
  margin-top: 2px;
}

.mind-canvas {
  position: absolute;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid #00ff00;
  cursor: crosshair;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
}

.mode-selector {
  position: absolute;
  top: 120px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 100;
}

.mode-btn {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  color: #666;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  border-color: #00ff00;
  color: #00ff00;
}

.mode-btn.active {
  background: #00ff00;
  color: #000;
  border-color: #00ff00;
}

.thought-panel {
  position: absolute;
  right: 20px;
  top: 120px;
  width: 400px;
  max-height: 60vh;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid #00ff00;
  z-index: 100;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
}

.panel-header {
  background: #00ff00;
  color: #000;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.thought-title {
  font-weight: bold;
  font-size: 12px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  background: transparent;
  border: none;
  color: #000;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}

.thought-metadata {
  padding: 10px;
  border-bottom: 1px solid #333;
  display: flex;
  gap: 10px;
  font-size: 10px;
  color: #666;
}

.tag {
  background: #333;
  color: #00ff00;
  padding: 2px 6px;
  border-radius: 2px;
}

.thought-content {
  padding: 15px;
  line-height: 1.5;
  font-size: 11px;
  max-height: 200px;
  overflow-y: auto;
}

.related-section {
  border-top: 1px solid #333;
  padding: 15px;
}

.section-title {
  font-size: 10px;
  color: #666;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.related-item {
  font-size: 10px;
  margin: 5px 0;
  color: #888;
  cursor: pointer;
  padding: 3px 0;
}

.related-item:hover {
  color: #00ff00;
}

.insights-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  gap: 10px;
  z-index: 100;
}

.insight-btn {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  color: #666;
  padding: 10px 15px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.insight-btn:hover {
  border-color: #00ff00;
  color: #00ff00;
  background: rgba(0, 255, 0, 0.1);
}

.icon {
  font-size: 16px;
}

.connections-overlay {
  position: absolute;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 50;
}
</style>
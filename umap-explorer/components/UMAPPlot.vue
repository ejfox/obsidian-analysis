<template>
  <div ref="plotContainer" class="umap-plot"></div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { scaleSequential } from 'd3-scale'
import { interpolateTurbo } from 'd3-scale-chromatic'

// Client-side only import to avoid SSR issues
let createScatterplot = null

const props = defineProps({
  plotData: Array,
  width: { type: Number, default: 600 },
  height: { type: Number, default: 600 },
  colorScheme: String,
  interactive: { type: Boolean, default: true },
  pointSize: { type: Number, default: 5 },
  selectedPoints: { type: Array, default: () => [] }
})

const emit = defineEmits(['point-hover', 'point-select'])

const plotContainer = ref(null)
let scatterplot = null
let canvas = null

const colorScale = scaleSequential(interpolateTurbo).domain([0, 1])

const initScatterplot = () => {
  if (!plotContainer.value || !createScatterplot || !props.plotData || props.plotData.length === 0) {
    console.log('UMAPPlot initScatterplot early return:', {
      hasContainer: !!plotContainer.value,
      hasCreateScatterplot: !!createScatterplot,
      hasPlotData: !!props.plotData,
      plotDataLength: props.plotData?.length
    })
    return
  }
  
  // Safely destroy existing scatterplot first
  if (scatterplot && typeof scatterplot.destroy === 'function') {
    try {
      scatterplot.destroy()
    } catch (e) {
      console.warn('Error destroying scatterplot:', e)
    }
    scatterplot = null
  }
  
  // Clear container
  if (plotContainer.value) {
    plotContainer.value.innerHTML = ''
  }
  
  // Create canvas
  canvas = document.createElement('canvas')
  canvas.width = props.width
  canvas.height = props.height
  plotContainer.value.appendChild(canvas)
  
  // Generate color palette exactly as regl-scatterplot expects
  const colorPalette = []
  for (let i = 0; i < 256; i++) {
    const value = i / 255
    const rgb = colorScale(value)
    const matches = rgb.match(/\d+/g)
    if (matches) {
      const hex = '#' + matches.slice(0, 3).map(v => 
        parseInt(v).toString(16).padStart(2, '0')
      ).join('')
      colorPalette.push(hex)
    }
  }

  // Clean minimal config that regl-scatterplot definitely supports
  scatterplot = createScatterplot({
    canvas: canvas,
    width: props.width,
    height: props.height,
    pointSize: props.pointSize || 5,
    backgroundColor: [0.04, 0.04, 0.04, 1],
    pointColor: colorPalette,
    colorBy: 'valueA'  // Tell it to use the 3rd value in [x, y, colorValue] for color
  })
  
  // Event handlers
  if (props.interactive) {
    scatterplot.subscribe('select', handleSelection)
    scatterplot.subscribe('hover', handleHover)
  } else {
    // Disable wheel events for non-interactive plots
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      e.stopPropagation()
    }, { passive: false })
  }
  
  updatePlot()
}

const updatePlot = () => {
  if (!scatterplot || !props.plotData || props.plotData.length === 0) {
    return
  }
  
  // Get coordinate bounds
  const xValues = props.plotData.map(p => p.x)
  const yValues = props.plotData.map(p => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  // Add padding
  const xPadding = (xMax - xMin) * 0.05
  const yPadding = (yMax - yMin) * 0.05
  
  // Prepare points exactly as regl-scatterplot expects: [x, y, colorValue]
  const points = props.plotData.map((point) => {
    // Normalize coordinates to [-1, 1] as required by regl-scatterplot
    const x = 2 * (point.x - xMin + xPadding) / (xMax - xMin + 2 * xPadding) - 1
    const y = 2 * (point.y - yMin + yPadding) / (yMax - yMin + 2 * yPadding) - 1
    
    // Calculate color value (0-1 range) based on scheme
    let colorValue = 0.5
    switch(props.colorScheme) {
      case 'modularity':
        colorValue = point.communityColor !== undefined ? point.communityColor : 
                    (point.folderColor || point.folderDepth || 0) / 10
        break
      case 'temporal':
        colorValue = point.relativePosition || 0.5
        break
      case 'size':
        colorValue = Math.min(point.wordCount / 1000, 1)
        break
      case 'connections':
        colorValue = point.hasLinks ? 0.8 : 0.2
        break
    }
    
    // Ensure colorValue is between 0 and 1
    colorValue = Math.max(0, Math.min(1, colorValue))
    
    return [x, y, colorValue]
  })
  
  // Draw the points - regl-scatterplot will handle color mapping automatically  
  scatterplot.draw(points)
}

const handleSelection = ({ points: selectedIndices }) => {
  if (selectedIndices && selectedIndices.length > 0) {
    const selectedData = selectedIndices.map(idx => ({
      ...props.plotData[idx],
      index: idx
    }))
    emit('point-select', selectedData)
  }
}

const handleHover = ({ point: hoveredIndex }) => {
  if (hoveredIndex >= 0 && hoveredIndex < props.plotData.length) {
    emit('point-hover', props.plotData[hoveredIndex])
  }
}

// Lifecycle
onMounted(async () => {
  // Import regl-scatterplot on client side only
  const module = await import('regl-scatterplot')
  createScatterplot = module.default
  initScatterplot()
})

onUnmounted(() => {
  if (scatterplot && typeof scatterplot.destroy === 'function') {
    try {
      scatterplot.destroy()
    } catch (e) {
      console.warn('Error destroying scatterplot on unmount:', e)
    }
  }
})

// Watch for data changes
watch(() => [props.plotData, props.colorScheme], () => {
  updatePlot()
}, { deep: true })

// Watch for size changes
watch(() => [props.width, props.height], () => {
  if (scatterplot && typeof scatterplot.destroy === 'function') {
    try {
      scatterplot.destroy()
      if (plotContainer.value) {
        plotContainer.value.innerHTML = ''
      }
      initScatterplot()
    } catch (e) {
      console.warn('Error handling size change:', e)
    }
  }
})
</script>

<style scoped>
.umap-plot {
  width: 100%;
  height: 100%;
  position: relative;
}

.umap-plot canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
</style>
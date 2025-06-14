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
  if (!plotContainer.value || !createScatterplot) return
  
  // Destroy existing scatterplot first
  if (scatterplot) {
    scatterplot.destroy()
    scatterplot = null
  }
  
  // Clear container
  plotContainer.value.innerHTML = ''
  
  // Create canvas
  canvas = document.createElement('canvas')
  canvas.width = props.width
  canvas.height = props.height
  plotContainer.value.appendChild(canvas)
  
  // Generate turbo color palette
  const numColors = 100
  const colorPalette = []
  for (let i = 0; i < numColors; i++) {
    const value = i / (numColors - 1)
    const rgb = colorScale(value)
    const matches = rgb.match(/\d+/g)
    if (matches) {
      const hex = '#' + matches.slice(0, 3).map(v => 
        parseInt(v).toString(16).padStart(2, '0')
      ).join('')
      colorPalette.push(hex)
    }
  }

  // Initialize regl-scatterplot
  scatterplot = createScatterplot({
    canvas,
    width: props.width,
    height: props.height,
    pointSize: props.pointSize,
    pointSizeSelected: props.pointSize * 1.5,
    pointOutlineWidth: 1,
    background: [0.04, 0.04, 0.04, 1],
    pointColor: colorPalette,
    colorBy: 'value',
    lassoColor: [0, 1, 0, 0.8],
    showRecticle: props.interactive,
    reticleColor: [0, 1, 0, 1]
  })
  
  // Event handlers
  if (props.interactive) {
    scatterplot.subscribe('select', handleSelection)
    scatterplot.subscribe('hover', handleHover)
  }
  
  updatePlot()
}

const updatePlot = () => {
  if (!scatterplot || !props.plotData || props.plotData.length === 0) {
    console.log('updatePlot early return:', { scatterplot: !!scatterplot, plotDataLength: props.plotData?.length })
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
  
  // Prepare points with normalized color values
  const points = props.plotData.map((point, idx) => {
    // Normalize coordinates to [-1, 1]
    const x = 2 * (point.x - xMin + xPadding) / (xMax - xMin + 2 * xPadding) - 1
    const y = 2 * (point.y - yMin + yPadding) / (yMax - yMin + 2 * yPadding) - 1
    
    // Calculate color value based on scheme (keep as 0-1 range)
    let colorValue = 0.5
    switch(props.colorScheme) {
      case 'modularity':
        // Use real community color from modularity detection
        colorValue = point.communityColor !== undefined ? point.communityColor : 
                    (point.folderColor || point.folderDepth || 0) / 10
        break
      case 'temporal':
        // Use relative position as proxy for time
        colorValue = point.relativePosition || 0.5
        break
      case 'size':
        // Normalize word count
        colorValue = Math.min(point.wordCount / 1000, 1)
        break
      case 'connections':
        // Use number of links as proxy
        colorValue = point.hasLinks ? 0.8 : 0.2
        break
    }
    
    // Debug log for first few points
    if (idx < 10) {
      console.log(`Point ${idx}: scheme=${props.colorScheme}, colorValue=${colorValue}, community=${point.community}, communityColor=${point.communityColor}`)
    }
    
    // Return [x, y, colorValue] - regl will map colorValue to color palette
    return [x, y, colorValue]
  })
  
  // Set up the color mapping
  scatterplot.set({
    colorBy: 'valueA' // Use the first data value (colorValue) for color
  })
  
  console.log('Drawing', points.length, 'points with color mapping')
  scatterplot.draw(points)
}

const handleSelection = ({ points: selectedIndices }) => {
  const selectedData = selectedIndices.map(idx => ({
    ...props.plotData[idx],
    index: idx
  }))
  emit('point-select', selectedData)
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
  if (scatterplot) {
    scatterplot.destroy()
  }
})

// Watch for data changes
watch(() => [props.plotData, props.colorScheme, props.selectedPoints], () => {
  updatePlot()
}, { deep: true })

// Watch for size changes
watch(() => [props.width, props.height], () => {
  if (scatterplot) {
    scatterplot.destroy()
    plotContainer.value.innerHTML = ''
    initScatterplot()
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
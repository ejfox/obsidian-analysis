<template>
  <canvas 
    ref="canvas" 
    :width="width" 
    :height="height"
    @click="handleClick"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { scaleSequential } from 'd3-scale'
import { interpolateTurbo } from 'd3-scale-chromatic'

const props = defineProps({
  plotData: Array,
  width: { type: Number, default: 150 },
  height: { type: Number, default: 150 },
  colorScheme: String,
  pointSize: { type: Number, default: 2 }
})

const emit = defineEmits(['click'])

const canvas = ref(null)
let ctx = null
let bounds = null

const colorScale = scaleSequential(interpolateTurbo).domain([0, 1])

const draw = () => {
  if (!ctx || !props.plotData || props.plotData.length === 0) return
  
  // Clear canvas
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, props.width, props.height)
  
  // Calculate bounds
  const xValues = props.plotData.map(p => p.x)
  const yValues = props.plotData.map(p => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  
  const xPadding = (xMax - xMin) * 0.05
  const yPadding = (yMax - yMin) * 0.05
  
  bounds = {
    xMin: xMin - xPadding,
    xMax: xMax + xPadding,
    yMin: yMin - yPadding,
    yMax: yMax + yPadding
  }
  
  // Draw points
  props.plotData.forEach(point => {
    const x = (point.x - bounds.xMin) / (bounds.xMax - bounds.xMin) * props.width
    const y = props.height - (point.y - bounds.yMin) / (bounds.yMax - bounds.yMin) * props.height
    
    // Calculate color
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
    
    colorValue = Math.max(0, Math.min(1, colorValue))
    
    // Draw point
    ctx.fillStyle = colorScale(colorValue)
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.5, props.pointSize), 0, 2 * Math.PI)
    ctx.fill()
  })
}

const handleClick = () => {
  emit('click')
}

const handleMouseMove = (e) => {
  // Optional: Add hover effects if needed
}

const handleMouseLeave = () => {
  // Optional: Clear hover effects
}

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d')
    draw()
  }
})

watch(() => [props.plotData, props.colorScheme, props.width, props.height], () => {
  draw()
}, { deep: true })
</script>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
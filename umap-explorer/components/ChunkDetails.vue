<template>
  <div class="chunk-details">
    <div class="details-header">
      <h3>SEMANTIC ANALYSIS</h3>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="details-content">
      <!-- Primary chunk info with data viz -->
      <div class="primary-chunk">
        <div class="chunk-title-bar">
          <h4>{{ chunks[0].title }}</h4>
          <div class="community-badge" :style="{ backgroundColor: getCommunityColor(chunks[0]) }">
            C{{ chunks[0].community }}
          </div>
        </div>
        
        <!-- Key metrics with sparklines -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">WORDS</span>
              <span class="metric-value">{{ chunks[0].wordCount }}</span>
            </div>
            <div class="word-count-bar">
              <div class="bar-fill" :style="{ width: getWordCountPercentage(chunks[0]) + '%' }"></div>
            </div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">POSITION</span>
              <span class="metric-value">{{ Math.round((chunks[0].relativePosition || 0) * 100) }}%</span>
            </div>
            <div class="position-indicator">
              <div class="position-dot" :style="{ left: (chunks[0].relativePosition || 0) * 100 + '%' }"></div>
            </div>
          </div>
          
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">CLUSTER</span>
              <span class="metric-value">{{ chunks[0].communitySize || 0 }}</span>
            </div>
            <div class="cluster-viz">
              <div 
                v-for="i in Math.min(10, chunks[0].communitySize || 0)" 
                :key="i"
                class="cluster-dot"
                :class="{ active: i === 1 }"
              ></div>
            </div>
          </div>
        </div>
        
        <!-- Content features -->
        <div class="feature-tags">
          <span v-if="chunks[0].hasCode" class="feature-tag code">
            <span class="tag-icon">⚡</span> CODE
          </span>
          <span v-if="chunks[0].hasLinks" class="feature-tag links">
            <span class="tag-icon">🔗</span> LINKS
          </span>
          <span v-if="chunks[0].hasTags" class="feature-tag tags">
            <span class="tag-icon">🏷️</span> TAGS
          </span>
          <span class="feature-tag depth">
            <span class="tag-icon">📁</span> D{{ chunks[0].folderDepth }}
          </span>
        </div>
        
        <!-- File path visualization -->
        <div class="path-breadcrumb">
          <div class="breadcrumb-label">PATH:</div>
          <div class="breadcrumb-path">
            <span 
              v-for="(segment, i) in getPathSegments(chunks[0].filePath)" 
              :key="i"
              class="path-segment"
              :class="{ 'path-file': i === getPathSegments(chunks[0].filePath).length - 1 }"
            >
              {{ segment }}
              <span v-if="i < getPathSegments(chunks[0].filePath).length - 1" class="path-separator">/</span>
            </span>
          </div>
        </div>
        
        <!-- Chunk content with syntax highlighting -->
        <div class="chunk-content-section">
          <div class="content-header">
            <span class="content-label">CHUNK {{ chunks[0].chunkIndex + 1 }}</span>
            <span class="content-chars">{{ chunks[0].chunkText.length }} chars</span>
          </div>
          <div class="chunk-text">
            {{ chunks[0].chunkText }}
          </div>
        </div>
      </div>
      
      <!-- Community analysis -->
      <div v-if="chunks[0].community !== undefined" class="community-analysis">
        <h4>COMMUNITY ANALYSIS</h4>
        <div class="community-stats">
          <div class="stat-item">
            <span class="stat-label">Community ID:</span>
            <span class="stat-value">{{ chunks[0].community }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cluster Size:</span>
            <span class="stat-value">{{ chunks[0].communitySize }} chunks</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Color Value:</span>
            <span class="stat-value">{{ (chunks[0].communityColor * 100).toFixed(1) }}%</span>
          </div>
        </div>
        
        <!-- Community color visualization -->
        <div class="community-color-bar">
          <div class="color-gradient"></div>
          <div 
            class="color-marker" 
            :style="{ 
              left: (chunks[0].communityColor * 100) + '%',
              backgroundColor: getCommunityColor(chunks[0])
            }"
          ></div>
        </div>
      </div>
      
      <!-- Related chunks with enhanced viz -->
      <div v-if="relatedChunks.length > 0" class="related-chunks">
        <h4>SEMANTIC NEIGHBORS</h4>
        <div class="neighbor-count">{{ relatedChunks.length }} related chunks found</div>
        
        <div class="related-list">
          <div 
            v-for="(chunk, i) in relatedChunks.slice(0, 8)" 
            :key="`${chunk.filePath}-${chunk.chunkIndex}`"
            class="related-chunk"
            :style="{ animationDelay: i * 0.1 + 's' }"
          >
            <div class="related-header">
              <div class="related-title">{{ chunk.title }}</div>
              <div class="related-badges">
                <span v-if="chunk.community === chunks[0].community" class="relation-badge same-community">
                  SAME CLUSTER
                </span>
                <span v-if="chunk.filePath === chunks[0].filePath" class="relation-badge same-file">
                  SAME FILE
                </span>
              </div>
            </div>
            <div class="related-preview">{{ chunk.chunkText.substring(0, 120) }}...</div>
            <div class="related-meta">
              <span class="meta-chip">{{ chunk.wordCount }}w</span>
              <span class="meta-chip">C{{ chunk.community }}</span>
              <span v-if="chunk.hasCode" class="meta-chip code">⚡</span>
              <span v-if="chunk.hasLinks" class="meta-chip links">🔗</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Enhanced multi-selection analytics -->
      <div v-if="chunks.length > 1" class="multi-selection-analysis">
        <h4 v-if="isMultipleNotes()">CROSS-NOTE ANALYSIS</h4>
        <h4 v-else-if="isMultipleCommunities()">CROSS-CLUSTER ANALYSIS</h4>
        <h4 v-else>NOTE OVERVIEW</h4>
        
        <!-- Comparative metrics grid -->
        <div class="comparative-metrics">
          <div class="metric-group">
            <div class="metric-header">
              <span class="metric-label">SELECTION</span>
              <span class="metric-value">{{ chunks.length }} chunks</span>
            </div>
            <div class="metric-breakdown">
              <span class="breakdown-item">{{ getUniqueNotes().length }} notes</span>
              <span class="breakdown-item">{{ getUniqueCommunities() }} clusters</span>
              <span class="breakdown-item">{{ getTotalWords() }} words</span>
            </div>
          </div>
          
          <div v-if="isMultipleCommunities()" class="metric-group">
            <div class="metric-header">
              <span class="metric-label">DIVERSITY</span>
              <span class="metric-value">{{ getClusterDiversity().toFixed(3) }}</span>
            </div>
            <div class="metric-breakdown">
              <span class="breakdown-item">{{ getLargestCluster().size }}x largest</span>
              <span class="breakdown-item">{{ getSmallestCluster().size }}x smallest</span>
            </div>
          </div>
          
          <div class="metric-group">
            <div class="metric-header">
              <span class="metric-label">SPREAD</span>
              <span class="metric-value">{{ getContentSpread().range.toFixed(0) }}w</span>
            </div>
            <div class="metric-breakdown">
              <span class="breakdown-item">{{ getContentSpread().median }}w median</span>
              <span class="breakdown-item">{{ getFeatureSpread() }} features</span>
            </div>
          </div>
        </div>
        
        <!-- Community comparison chart -->
        <div v-if="isMultipleCommunities()" class="community-comparison">
          <div class="comparison-header">
            <span class="comparison-label">CLUSTER COMPOSITION</span>
            <span class="comparison-count">{{ getUniqueCommunities() }} clusters represented</span>
          </div>
          
          <div class="community-breakdown">
            <div 
              v-for="community in getCommunityBreakdown()" 
              :key="community.id"
              class="community-item"
            >
              <div class="community-info">
                <div class="community-color-dot" :style="{ backgroundColor: community.color }"></div>
                <span class="community-id">C{{ community.id }}</span>
                <span class="community-count">{{ community.count }}</span>
              </div>
              <div class="community-bar">
                <div 
                  class="community-bar-fill" 
                  :style="{ 
                    width: (community.count / chunks.length * 100) + '%',
                    backgroundColor: community.color
                  }"
                ></div>
              </div>
              <div class="community-stats">
                <span class="stat-detail">{{ community.avgWords }}w avg</span>
                <span class="stat-detail">{{ community.features.join(', ') }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Content pattern analysis -->
        <div class="content-patterns">
          <div class="pattern-header">
            <span class="pattern-label">CONTENT PATTERNS</span>
          </div>
          
          <div class="pattern-grid">
            <div class="pattern-item">
              <span class="pattern-name">Code Density</span>
              <div class="pattern-visualization">
                <div class="pattern-bar">
                  <div 
                    class="pattern-fill" 
                    :style="{ width: getCodeDensity() + '%' }"
                  ></div>
                </div>
                <span class="pattern-value">{{ Math.round(getCodeDensity()) }}%</span>
              </div>
            </div>
            
            <div class="pattern-item">
              <span class="pattern-name">Link Density</span>
              <div class="pattern-visualization">
                <div class="pattern-bar">
                  <div 
                    class="pattern-fill" 
                    :style="{ width: getLinkDensity() + '%' }"
                  ></div>
                </div>
                <span class="pattern-value">{{ Math.round(getLinkDensity()) }}%</span>
              </div>
            </div>
            
            <div class="pattern-item">
              <span class="pattern-name">Tag Density</span>
              <div class="pattern-visualization">
                <div class="pattern-bar">
                  <div 
                    class="pattern-fill" 
                    :style="{ width: getTagDensity() + '%' }"
                  ></div>
                </div>
                <span class="pattern-value">{{ Math.round(getTagDensity()) }}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Temporal distribution -->
        <div v-if="hasTemporalData()" class="temporal-analysis">
          <div class="temporal-header">
            <span class="temporal-label">POSITION DISTRIBUTION</span>
          </div>
          
          <div class="temporal-histogram">
            <div 
              v-for="(bin, i) in getTemporalHistogram()" 
              :key="i"
              class="temporal-bin"
              :style="{ 
                height: (bin.count / Math.max(...getTemporalHistogram().map(b => b.count)) * 40) + 'px',
                backgroundColor: bin.avgCommunityColor
              }"
              :title="`Position ${bin.range}: ${bin.count} chunks`"
            ></div>
          </div>
          
          <div class="temporal-labels">
            <span class="temporal-start">Early</span>
            <span class="temporal-end">Late</span>
          </div>
        </div>
        
        <!-- File system distribution -->
        <div v-if="isMultipleNotes()" class="filesystem-analysis">
          <div class="filesystem-header">
            <span class="filesystem-label">SOURCE DISTRIBUTION</span>
            <span class="filesystem-count">{{ getUniqueNotes().length }} files</span>
          </div>
          
          <div class="filesystem-breakdown">
            <div 
              v-for="note in getTopNotes()" 
              :key="note.path"
              class="filesystem-item"
            >
              <div class="filesystem-info">
                <span class="note-name">{{ getNoteName(note.path) }}</span>
                <span class="note-count">{{ note.count }}</span>
              </div>
              <div class="note-details">
                <span class="note-path">{{ getShortPath(note.path) }}</span>
                <span class="note-communities">{{ note.communities.length }}c</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { scaleSequential } from 'd3-scale'
import { interpolateTurbo } from 'd3-scale-chromatic'

const props = defineProps({
  chunks: Array,
  relatedChunks: Array
})

const emit = defineEmits(['close'])

const colorScale = scaleSequential(interpolateTurbo).domain([0, 1])

const getCommunityColor = (chunk) => {
  if (chunk.communityColor !== undefined) {
    return colorScale(chunk.communityColor)
  }
  return '#666'
}

const getWordCountPercentage = (chunk) => {
  // Normalize word count to 0-100% (assuming max ~2000 words)
  return Math.min((chunk.wordCount / 2000) * 100, 100)
}

const getPathSegments = (filePath) => {
  if (!filePath) return []
  // Extract meaningful path segments, skip long paths
  const segments = filePath.split('/').filter(s => s.length > 0)
  // Take last 4 segments for display
  return segments.slice(-4)
}

const getTotalWords = () => {
  return props.chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0)
}

const getUniqueCommunities = () => {
  const communities = new Set(props.chunks.map(c => c.community))
  return communities.size
}

// Enhanced multi-selection analysis functions
const isMultipleNotes = () => {
  const notes = new Set(props.chunks.map(c => c.filePath))
  return notes.size > 1
}

const isMultipleCommunities = () => {
  return getUniqueCommunities() > 1
}

const getUniqueNotes = () => {
  const noteMap = new Map()
  props.chunks.forEach(chunk => {
    if (!noteMap.has(chunk.filePath)) {
      noteMap.set(chunk.filePath, {
        path: chunk.filePath,
        title: chunk.title,
        count: 0,
        communities: new Set()
      })
    }
    const note = noteMap.get(chunk.filePath)
    note.count++
    if (chunk.community !== undefined) {
      note.communities.add(chunk.community)
    }
  })
  
  return Array.from(noteMap.values()).map(note => ({
    ...note,
    communities: Array.from(note.communities)
  }))
}

const getClusterDiversity = () => {
  if (!isMultipleCommunities()) return 0
  
  const communityMap = new Map()
  props.chunks.forEach(chunk => {
    const comm = chunk.community || 0
    communityMap.set(comm, (communityMap.get(comm) || 0) + 1)
  })
  
  const counts = Array.from(communityMap.values())
  const total = counts.reduce((sum, count) => sum + count, 0)
  
  // Calculate Shannon diversity index
  let diversity = 0
  counts.forEach(count => {
    const p = count / total
    diversity -= p * Math.log(p)
  })
  
  return diversity
}

const getLargestCluster = () => {
  const communityMap = new Map()
  props.chunks.forEach(chunk => {
    const comm = chunk.community || 0
    communityMap.set(comm, (communityMap.get(comm) || 0) + 1)
  })
  
  let largest = { id: 0, size: 0 }
  communityMap.forEach((size, id) => {
    if (size > largest.size) {
      largest = { id, size }
    }
  })
  
  return largest
}

const getSmallestCluster = () => {
  const communityMap = new Map()
  props.chunks.forEach(chunk => {
    const comm = chunk.community || 0
    communityMap.set(comm, (communityMap.get(comm) || 0) + 1)
  })
  
  let smallest = { id: 0, size: Infinity }
  communityMap.forEach((size, id) => {
    if (size < smallest.size) {
      smallest = { id, size }
    }
  })
  
  return smallest
}

const getContentSpread = () => {
  const wordCounts = props.chunks.map(c => c.wordCount).sort((a, b) => a - b)
  const min = wordCounts[0] || 0
  const max = wordCounts[wordCounts.length - 1] || 0
  const median = wordCounts[Math.floor(wordCounts.length / 2)] || 0
  
  return {
    min,
    max,
    median,
    range: max - min
  }
}

const getFeatureSpread = () => {
  const features = new Set()
  props.chunks.forEach(chunk => {
    if (chunk.hasCode) features.add('code')
    if (chunk.hasLinks) features.add('links')
    if (chunk.hasTags) features.add('tags')
  })
  return features.size
}

const getCommunityBreakdown = () => {
  const communityMap = new Map()
  
  props.chunks.forEach(chunk => {
    const comm = chunk.community || 0
    if (!communityMap.has(comm)) {
      communityMap.set(comm, {
        id: comm,
        count: 0,
        totalWords: 0,
        features: new Set(),
        color: getCommunityColor(chunk)
      })
    }
    
    const community = communityMap.get(comm)
    community.count++
    community.totalWords += chunk.wordCount
    
    if (chunk.hasCode) community.features.add('code')
    if (chunk.hasLinks) community.features.add('links')
    if (chunk.hasTags) community.features.add('tags')
  })
  
  return Array.from(communityMap.values())
    .map(community => ({
      ...community,
      avgWords: Math.round(community.totalWords / community.count),
      features: Array.from(community.features)
    }))
    .sort((a, b) => b.count - a.count)
}

const getCodeDensity = () => {
  const codeChunks = props.chunks.filter(c => c.hasCode).length
  return (codeChunks / props.chunks.length) * 100
}

const getLinkDensity = () => {
  const linkChunks = props.chunks.filter(c => c.hasLinks).length
  return (linkChunks / props.chunks.length) * 100
}

const getTagDensity = () => {
  const tagChunks = props.chunks.filter(c => c.hasTags).length
  return (tagChunks / props.chunks.length) * 100
}

const hasTemporalData = () => {
  return props.chunks.some(c => c.relativePosition !== undefined)
}

const getTemporalHistogram = () => {
  if (!hasTemporalData()) return []
  
  const bins = Array(10).fill(null).map((_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}%`,
    count: 0,
    totalCommunityColor: 0
  }))
  
  props.chunks.forEach(chunk => {
    if (chunk.relativePosition !== undefined) {
      const binIndex = Math.min(9, Math.floor(chunk.relativePosition * 10))
      bins[binIndex].count++
      bins[binIndex].totalCommunityColor += (chunk.communityColor || 0.5)
    }
  })
  
  return bins.map(bin => ({
    ...bin,
    avgCommunityColor: bin.count > 0 ? 
      colorScale(bin.totalCommunityColor / bin.count) : '#333'
  }))
}

const getTopNotes = () => {
  return getUniqueNotes()
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

const getNoteName = (filePath) => {
  return filePath.split('/').pop()?.replace('.md', '') || 'Unknown'
}

const getShortPath = (filePath) => {
  const segments = filePath.split('/')
  return segments.length > 3 ? 
    `.../${segments.slice(-2).join('/')}` : 
    filePath
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600&family=IBM+Plex+Mono:wght@300;400;500&display=swap');

.chunk-details {
  width: 480px;
  height: 100vh;
  background: #0a0a0a;
  overflow-y: auto;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 300;
  color: #e8e8e8;
}

/* Tufte-inspired typography hierarchy */
.details-header {
  padding: 32px 24px 16px 24px;
  position: sticky;
  top: 0;
  background: #0a0a0a;
  z-index: 10;
}

.details-header h3 {
  margin: 0;
  font-size: 11px;
  font-weight: 400;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-family: 'IBM Plex Sans', sans-serif;
}

.close-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s ease;
  font-family: 'IBM Plex Mono', monospace;
}

.close-btn:hover {
  color: #00ff00;
}

.details-content {
  padding: 0 24px 24px 24px;
}

/* Data hierarchy - remove chartjunk, maximize data-ink ratio */
.primary-chunk {
  margin-bottom: 40px;
}

.chunk-title-bar {
  margin-bottom: 24px;
}

.chunk-title-bar h4 {
  margin: 0;
  color: #e8e8e8;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.3;
  font-family: 'IBM Plex Sans', sans-serif;
}

.community-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
  color: #000;
  background-color: currentColor;
  font-family: 'IBM Plex Mono', monospace;
}

/* Minimal data tables */
.metrics-grid {
  margin-bottom: 32px;
}

.metric-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  padding: 8px 0;
  transition: opacity 0.2s ease;
}

.metric-card:hover {
  opacity: 0.7;
}

.metric-label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 400;
}

.metric-value {
  font-size: 16px;
  color: #e8e8e8;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 400;
}

/* Tufte-style data graphics */
.word-count-bar {
  grid-column: 1 / -1;
  height: 2px;
  background: #1a1a1a;
  margin-top: 4px;
}

.bar-fill {
  height: 100%;
  background: #00ff00;
  transition: width 0.3s ease;
}

.position-indicator {
  grid-column: 1 / -1;
  height: 2px;
  background: #1a1a1a;
  margin-top: 4px;
  position: relative;
}

.position-dot {
  position: absolute;
  top: -1px;
  width: 4px;
  height: 4px;
  background: #00ff00;
  transition: left 0.3s ease;
}

.cluster-viz {
  grid-column: 1 / -1;
  display: flex;
  gap: 2px;
  margin-top: 4px;
}

.cluster-dot {
  width: 3px;
  height: 3px;
  background: #333;
}

.cluster-dot.active {
  background: #00ff00;
}

/* Minimal feature indicators - data, not decoration */
.feature-tags {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: #666;
}

.feature-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.feature-tag.code { color: #888; }
.feature-tag.links { color: #888; }
.feature-tag.tags { color: #888; }
.feature-tag.depth { color: #888; }

.tag-icon {
  font-size: 10px;
}

/* Path as data - typography hierarchy */
.path-breadcrumb {
  margin-bottom: 24px;
}

.breadcrumb-label {
  font-size: 10px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  font-family: 'IBM Plex Sans', sans-serif;
}

.breadcrumb-path {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.path-segment {
  color: #666;
}

.path-segment.path-file {
  color: #e8e8e8;
}

.path-separator {
  color: #333;
  margin: 0 2px;
}

/* Content presentation - focus on readability */
.chunk-content-section {
  margin-bottom: 32px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.content-label {
  font-size: 10px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'IBM Plex Sans', sans-serif;
}

.content-chars {
  font-size: 10px;
  color: #666;
  font-family: 'IBM Plex Mono', monospace;
}

.chunk-text {
  font-size: 13px;
  line-height: 1.5;
  color: #ccc;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 300;
  max-height: 240px;
  overflow-y: auto;
}

/* Community data table - remove visual noise */
.community-analysis {
  margin-bottom: 40px;
}

.community-analysis h4 {
  margin: 0 0 16px 0;
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 400;
}

.community-stats {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 0;
  margin-bottom: 16px;
}

.stat-item {
  display: contents;
  font-size: 11px;
}

.stat-label {
  color: #666;
  font-family: 'IBM Plex Sans', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  color: #e8e8e8;
  font-family: 'IBM Plex Mono', monospace;
  text-align: right;
}

/* Minimal color reference */
.community-color-bar {
  height: 3px;
  background: #1a1a1a;
  position: relative;
}

.color-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, 
    #1a0a2e 0%, #16537e 25%, #43cea2 50%, #185a9d 75%, #1a0a2e 100%);
}

.color-marker {
  position: absolute;
  top: -1px;
  width: 5px;
  height: 5px;
  background-color: currentColor;
  transform: translateX(-50%);
}

.related-chunks {
  margin-bottom: 25px;
}

.related-chunks h4 {
  margin: 0 0 10px 0;
  font-size: 12px;
  color: #00ff00;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.neighbor-count {
  font-size: 10px;
  color: #666;
  margin-bottom: 15px;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.related-chunk {
  padding: 12px;
  background: rgba(0, 255, 0, 0.03);
  border: 1px solid rgba(0, 255, 0, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: slideInUp 0.5s ease forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes slideInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.related-chunk:hover {
  background: rgba(0, 255, 0, 0.08);
  border-color: rgba(0, 255, 0, 0.4);
  box-shadow: 0 5px 20px rgba(0, 255, 0, 0.1);
  transform: translateY(-2px);
}

.related-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.related-title {
  font-size: 11px;
  color: #00ff00;
  font-weight: bold;
  flex: 1;
}

.related-badges {
  display: flex;
  gap: 4px;
}

.relation-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 8px;
  font-weight: bold;
}

.relation-badge.same-community {
  background: rgba(0, 255, 255, 0.2);
  color: #00ffff;
}

.relation-badge.same-file {
  background: rgba(255, 165, 0, 0.2);
  color: #ffa500;
}

.related-preview {
  font-size: 10px;
  color: #999;
  line-height: 1.4;
  margin-bottom: 8px;
}

.related-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-chip {
  padding: 2px 6px;
  background: rgba(0, 255, 0, 0.1);
  color: #00ff00;
  border-radius: 8px;
  font-size: 8px;
  border: 1px solid rgba(0, 255, 0, 0.2);
}

.meta-chip.code {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
  border-color: rgba(255, 165, 0, 0.2);
}

.meta-chip.links {
  background: rgba(0, 150, 255, 0.1);
  color: #0096ff;
  border-color: rgba(0, 150, 255, 0.2);
}

.multi-chunk-stats {
  padding: 15px;
  background: rgba(0, 255, 0, 0.03);
  border: 1px solid rgba(0, 255, 0, 0.15);
  border-radius: 6px;
}

.multi-chunk-stats h4 {
  margin: 0 0 15px 0;
  font-size: 12px;
  color: #00ff00;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.note-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.note-stat {
  text-align: center;
  padding: 10px;
  background: rgba(0, 255, 0, 0.05);
  border: 1px solid rgba(0, 255, 0, 0.2);
  border-radius: 6px;
}

.stat-number {
  font-size: 18px;
  color: #00ff00;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 9px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.chunk-distribution {
  margin-top: 15px;
}

.distribution-label {
  font-size: 10px;
  color: #00ff00;
  margin-bottom: 8px;
}

.distribution-bars {
  display: flex;
  align-items: end;
  gap: 2px;
  height: 40px;
  padding: 0 5px;
}

.distribution-bar {
  flex: 1;
  min-height: 4px;
  border-radius: 2px 2px 0 0;
  transition: all 0.3s ease;
  cursor: pointer;
}

.distribution-bar:hover {
  opacity: 0.8;
  transform: scaleY(1.1);
}
</style>
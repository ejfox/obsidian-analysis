<template>
  <div class="chunk-details">
    <div class="details-header">
      <h3>CHUNK ANALYSIS</h3>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="details-content">
      <!-- Primary chunk info -->
      <div class="primary-chunk">
        <h4>{{ chunks[0].title }}</h4>
        <div class="chunk-metadata">
          <span class="meta-item">
            <span class="label">PATH:</span> {{ chunks[0].filePath }}
          </span>
          <span class="meta-item">
            <span class="label">CHUNK:</span> {{ chunks[0].chunkIndex + 1 }}
          </span>
          <span class="meta-item">
            <span class="label">WORDS:</span> {{ chunks[0].wordCount }}
          </span>
          <span v-if="chunks[0].community !== undefined" class="meta-item">
            <span class="label">COMMUNITY:</span> {{ chunks[0].community }}
          </span>
          <span v-if="chunks[0].communitySize !== undefined" class="meta-item">
            <span class="label">CLUSTER SIZE:</span> {{ chunks[0].communitySize }}
          </span>
        </div>
        
        <div class="chunk-text">
          {{ chunks[0].chunkText }}
        </div>
        
        <div v-if="chunks.length > 1" class="chunk-stats">
          <span class="stat">{{ chunks.length }} chunks from this note</span>
        </div>
      </div>
      
      <!-- Related chunks -->
      <div v-if="relatedChunks.length > 0" class="related-chunks">
        <h4>RELATED CHUNKS</h4>
        <div 
          v-for="chunk in relatedChunks" 
          :key="`${chunk.filePath}-${chunk.chunkIndex}`"
          class="related-chunk"
        >
          <div class="related-title">{{ chunk.title }}</div>
          <div class="related-preview">{{ chunk.chunkText.substring(0, 100) }}...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  chunks: Array,
  relatedChunks: Array
})

const emit = defineEmits(['close'])
</script>

<style scoped>
.chunk-details {
  width: 400px;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  border-left: 1px solid #1a1a1a;
  overflow-y: auto;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #1a1a1a;
  position: sticky;
  top: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 10;
}

.details-header h3 {
  margin: 0;
  font-size: 12px;
  color: #00ff00;
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.close-btn {
  background: transparent;
  border: none;
  color: #666;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: #00ff00;
}

.details-content {
  padding: 20px;
}

.primary-chunk {
  margin-bottom: 30px;
}

.primary-chunk h4 {
  margin: 0 0 10px 0;
  color: #00ff00;
  font-size: 16px;
}

.chunk-metadata {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 15px;
}

.meta-item {
  font-size: 11px;
  color: #666;
  font-family: 'JetBrains Mono', monospace;
}

.label {
  color: #00ff00;
  opacity: 0.6;
}

.chunk-text {
  font-size: 13px;
  line-height: 1.6;
  color: #ccc;
  padding: 15px;
  background: rgba(0, 255, 0, 0.05);
  border: 1px solid rgba(0, 255, 0, 0.1);
  border-radius: 4px;
  margin-bottom: 15px;
}

.chunk-stats {
  font-size: 12px;
  color: #00ff00;
  opacity: 0.7;
}

.related-chunks h4 {
  margin: 0 0 15px 0;
  font-size: 12px;
  color: #00ff00;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.related-chunk {
  padding: 12px;
  background: rgba(0, 255, 0, 0.02);
  border: 1px solid rgba(0, 255, 0, 0.1);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.related-chunk:hover {
  background: rgba(0, 255, 0, 0.05);
  border-color: rgba(0, 255, 0, 0.3);
}

.related-title {
  font-size: 12px;
  color: #00ff00;
  margin-bottom: 5px;
}

.related-preview {
  font-size: 11px;
  color: #666;
  line-height: 1.4;
}
</style>
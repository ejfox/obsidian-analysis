<template>
  <div class="control-panel">
    <div class="controls">
      <div class="control-group">
        <label>COLOR SCHEME</label>
        <select 
          :value="colorScheme" 
          @change="$emit('update:color-scheme', $event.target.value)"
          class="control-select"
        >
          <option 
            v-for="scheme in availableSchemes" 
            :key="scheme.id" 
            :value="scheme.id"
          >
            {{ scheme.label }}
          </option>
        </select>
      </div>
      
      <button @click="$emit('refresh')" class="refresh-btn">
        REFRESH DATA
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  colorScheme: String,
  availableSchemes: Array
})

const emit = defineEmits(['update:color-scheme', 'refresh'])
</script>

<style scoped>
.control-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.95);
  border-top: 1px solid #1a1a1a;
  padding: 15px 20px;
  z-index: 100;
}

.controls {
  display: flex;
  align-items: center;
  gap: 30px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-group label {
  font-size: 11px;
  color: #00ff00;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.8;
}

.control-select {
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid rgba(0, 255, 0, 0.3);
  color: #00ff00;
  padding: 6px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-select:hover {
  background: rgba(0, 255, 0, 0.2);
  border-color: #00ff00;
}

.control-select:focus {
  outline: none;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}

.refresh-btn {
  background: transparent;
  border: 1px solid rgba(0, 255, 0, 0.3);
  color: #00ff00;
  padding: 6px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(0, 255, 0, 0.1);
  border-color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}
</style>
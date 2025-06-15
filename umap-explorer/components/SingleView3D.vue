<template>
  <div class="single-view-3d" @keydown="handleKeydown" tabindex="0">
    <!-- Terminal header -->
    <div class="terminal-header">
      <span class="prompt">root@mind:~$</span>
      <span class="cursor">█</span>
      <div class="system-info">
        <span>{{ currentData.length }} POINTS</span>
        <span>{{ currentParameterSet + 1 }}/64 SETS</span>
        <span>{{ isAnimating ? "MORPHING" : "STATIC" }}</span>
      </div>
    </div>

    <!-- 3D Canvas -->
    <canvas
      ref="canvas"
      :width="canvasSize.width"
      :height="canvasSize.height"
      class="mind-canvas-3d"
    ></canvas>

    <!-- Parameter controls -->
    <div class="parameter-controls">
      <div class="control-group">
        <button @click="toggleAnimation" class="control-btn">
          {{ isAnimating ? "PAUSE" : "ANIMATE" }}
        </button>
        <button @click="nextParameterSet" class="control-btn">NEXT SET</button>
        <button @click="resetView" class="control-btn">RESET VIEW</button>
      </div>

      <div class="parameter-info">
        <div class="param-line">
          ORC: k={{ currentParams.orcParameters?.kNeighbors }} c={{
            Math.abs(
              currentParams.orcParameters?.curvatureThreshold || 0,
            ).toFixed(1)
          }}
        </div>
        <div class="param-line">
          UMAP: n={{ currentParams.parameters?.n_neighbors }} d={{
            currentParams.parameters?.min_dist
          }}
        </div>
        <div class="param-line">
          REMOVED:
          {{ (currentParams.metadata?.orcStats?.removalRate || 0).toFixed(1) }}%
          edges
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions">
      <div>DRAG: Rotate</div>
      <div>WHEEL: Zoom</div>
      <div>SPACE: Animate</div>
      <div>ESC: Exit</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { Device, Buffer } from "@luma.gl/core";
import { Model } from "@luma.gl/engine";
import { easePoly } from "d3-ease";
import { interpolateRgb } from "d3-interpolate";
import { interpolateTurbo } from "d3-scale-chromatic";

const props = defineProps({
  umapData: { type: Object, required: true },
});

const emit = defineEmits(["close"]);

const quadInOut = easePoly.exponent(2);

const canvas = ref(null);
let device = null;
let model = null;
let pointsBuffer = null;
let colorsBuffer = null;
let animationId = null;
let startTime = 0;

const canvasSize = { width: 1400, height: 800 };
const isAnimating = ref(false);
const currentParameterSet = ref(0);
const transitionProgress = ref(0);

// Camera state
const camera = ref({
  rotation: { x: 0.3, y: 0.1 },
  distance: 5,
  target: { x: 0, y: 0, z: 0 },
});

const currentData = computed(() => {
  const results = props.umapData.results || [];
  if (results.length === 0) return [];

  const currentSet = results[currentParameterSet.value];
  const nextSet = results[(currentParameterSet.value + 1) % results.length];

  if (!isAnimating.value || !nextSet) {
    return currentSet?.data || [];
  }

  // Interpolate between current and next parameter set
  const t = quadInOut(transitionProgress.value);
  return interpolateDataSets(currentSet.data, nextSet.data, t);
});

const currentParams = computed(() => {
  const results = props.umapData.results || [];
  return results[currentParameterSet.value] || {};
});

function interpolateDataSets(dataA, dataB, t) {
  if (!dataA || !dataB || dataA.length !== dataB.length) return dataA || [];

  return dataA.map((pointA, i) => {
    const pointB = dataB[i];

    // Interpolate position (add Z dimension based on parameter set)
    const x = pointA.x + (pointB.x - pointA.x) * t;
    const y = pointA.y + (pointB.y - pointA.y) * t;
    const z =
      (pointA.orcPreprocessed ? 1 : 0) + (pointB.orcPreprocessed ? 1 : 0) * t;

    // Interpolate color using D3 turbo
    const colorA = interpolateTurbo(
      pointA.curvatureMean || pointA.communityColor || 0.5,
    );
    const colorB = interpolateTurbo(
      pointB.curvatureMean || pointB.communityColor || 0.5,
    );
    const color = interpolateRgb(colorA, colorB)(t);

    return {
      ...pointA,
      x,
      y,
      z,
      color,
      // Preserve metadata for consistency
      id: i,
    };
  });
}

async function initLumaGL() {
  if (!canvas.value) return;

  try {
    // Try WebGPU first, fallback to WebGL2
    device = await Device.create({
      canvas: canvas.value,
      debug: true,
    });

    console.log("🚀 Initialized luma.gl with:", device.type);

    // Setup basic 3D rendering pipeline
    setupRenderPipeline();
    render();
  } catch (error) {
    console.error("Failed to initialize luma.gl:", error);
  }
}

function setupRenderPipeline() {
  console.log(
    "📊 Setting up render pipeline for",
    currentData.value.length,
    "points",
  );

  // Point cloud vertex shader
  const vs = `\
    attribute vec3 positions;
    attribute vec3 colors;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    
    varying vec3 vColor;
    
    void main() {
      vColor = colors;
      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(positions, 1.0);
      gl_PointSize = 4.0;
    }
  `;

  // Point cloud fragment shader
  const fs = `\
    precision highp float;
    varying vec3 vColor;
    
    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      if (dist > 0.5) discard;
      
      float alpha = 1.0 - (dist * 2.0);
      gl_FragColor = vec4(vColor, alpha * 0.8);
    }
  `;

  // Create buffers for point data
  const data = currentData.value;
  const positions = new Float32Array(data.length * 3);
  const colors = new Float32Array(data.length * 3);

  // Normalize coordinates and create 3D positions
  const xValues = data.map((p) => p.x);
  const yValues = data.map((p) => p.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  data.forEach((point, i) => {
    // Normalize to [-2, 2] range for better 3D viewing
    const x = ((point.x - xMin) / (xMax - xMin) - 0.5) * 4;
    const y = ((point.y - yMin) / (yMax - yMin) - 0.5) * 4;
    const z = (point.z || 0) * 2; // Use Z from interpolation or 0

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Extract RGB from D3 turbo color
    const colorValue =
      point.curvatureMean ||
      point.communityColor ||
      point.folderColor / 10 ||
      0.5;
    const colorStr = point.color || interpolateTurbo(colorValue);
    const rgb = hexToRgb(colorStr);

    colors[i * 3] = rgb.r / 255;
    colors[i * 3 + 1] = rgb.g / 255;
    colors[i * 3 + 2] = rgb.b / 255;
  });

  // Create or update buffers
  if (!pointsBuffer) {
    pointsBuffer = device.createBuffer({
      id: "points-buffer",
      data: positions,
      usage: Buffer.VERTEX | Buffer.COPY_DST,
    });
  } else {
    device.queue.writeBuffer(pointsBuffer, 0, positions);
  }

  if (!colorsBuffer) {
    colorsBuffer = device.createBuffer({
      id: "colors-buffer",
      data: colors,
      usage: Buffer.VERTEX | Buffer.COPY_DST,
    });
  } else {
    device.queue.writeBuffer(colorsBuffer, 0, colors);
  }

  // Create model if it doesn't exist
  if (!model) {
    model = new Model(device, {
      id: "point-cloud",
      vs,
      fs,
      topology: "point-list",
      vertexCount: data.length,
      attributes: {
        positions: pointsBuffer,
        colors: colorsBuffer,
      },
      parameters: {
        blend: true,
        blendFunc: [device.gl.SRC_ALPHA, device.gl.ONE_MINUS_SRC_ALPHA],
        depthTest: true,
        depthFunc: device.gl.LEQUAL,
      },
    });
  }
}

function hexToRgb(hex) {
  // Handle both #rgb and rgb() formats
  if (hex.startsWith("rgb")) {
    const match = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return match
      ? {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
        }
      : { r: 127, g: 127, b: 127 };
  }

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 127, g: 127, b: 127 };
}

function render() {
  if (!device || !model) return;

  // Clear the canvas
  const renderPass = device.beginRenderPass({
    clearColor: [0.04, 0.04, 0.04, 1.0],
    clearDepth: 1.0,
  });

  // Create view matrices
  const viewMatrix = createViewMatrix();
  const projectionMatrix = createProjectionMatrix();
  const modelMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; // Identity matrix

  // Update uniforms and render
  model.setUniforms({
    uProjectionMatrix: projectionMatrix,
    uViewMatrix: viewMatrix,
    uModelMatrix: modelMatrix,
  });

  model.draw(renderPass);
  renderPass.end();

  // Continue animation if active
  if (isAnimating.value) {
    animationId = requestAnimationFrame(() => {
      updateAnimation();
      render();
    });
  }
}

function createViewMatrix() {
  const { rotation, distance, target } = camera.value;

  // Simple view matrix calculation
  const cos = Math.cos;
  const sin = Math.sin;

  const rx = rotation.x;
  const ry = rotation.y;

  // Camera position based on spherical coordinates
  const x = target.x + distance * cos(rx) * sin(ry);
  const y = target.y + distance * sin(rx);
  const z = target.z + distance * cos(rx) * cos(ry);

  // Look-at matrix (simplified)
  return [
    cos(ry),
    0,
    sin(ry),
    0,
    -sin(rx) * sin(ry),
    cos(rx),
    sin(rx) * cos(ry),
    0,
    -cos(rx) * sin(ry),
    -sin(rx),
    cos(rx) * cos(ry),
    0,
    -x,
    -y,
    -z,
    1,
  ];
}

function createProjectionMatrix() {
  const fov = Math.PI / 4; // 45 degrees
  const aspect = canvasSize.width / canvasSize.height;
  const near = 0.1;
  const far = 100;

  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);

  return [
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ];
}

function updateAnimation() {
  const elapsed = Date.now() - startTime;
  const duration = 2000; // 2 seconds per transition

  transitionProgress.value = (elapsed % duration) / duration;

  // Move to next parameter set when transition completes
  if (elapsed > 0 && elapsed % duration < 16) {
    // ~60fps
    currentParameterSet.value =
      (currentParameterSet.value + 1) % (props.umapData.results?.length || 1);
    startTime = Date.now();
  }
}

function toggleAnimation() {
  isAnimating.value = !isAnimating.value;

  if (isAnimating.value) {
    startTime = Date.now();
    render();
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
}

function nextParameterSet() {
  const maxSets = props.umapData.results?.length || 1;
  currentParameterSet.value = (currentParameterSet.value + 1) % maxSets;

  if (!isAnimating.value) {
    render();
  }
}

function resetView() {
  camera.value = {
    rotation: { x: 0.3, y: 0.1 },
    distance: 5,
    target: { x: 0, y: 0, z: 0 },
  };

  if (!isAnimating.value) {
    render();
  }
}

function handleKeydown(e) {
  switch (e.key) {
    case " ":
      e.preventDefault();
      toggleAnimation();
      break;
    case "Escape":
      emit("close");
      break;
    case "ArrowRight":
      nextParameterSet();
      break;
    case "r":
      resetView();
      break;
  }
}

// Mouse interaction for camera control
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

function handleMouseDown(e) {
  isDragging = true;
  lastMouse = { x: e.clientX, y: e.clientY };
}

function handleMouseMove(e) {
  if (!isDragging) return;

  const deltaX = e.clientX - lastMouse.x;
  const deltaY = e.clientY - lastMouse.y;

  camera.value.rotation.y += deltaX * 0.01;
  camera.value.rotation.x += deltaY * 0.01;

  // Constrain rotation
  camera.value.rotation.x = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, camera.value.rotation.x),
  );

  lastMouse = { x: e.clientX, y: e.clientY };

  if (!isAnimating.value) {
    render();
  }
}

function handleMouseUp() {
  isDragging = false;
}

function handleWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 1.1 : 0.9;
  camera.value.distance = Math.max(
    1,
    Math.min(20, camera.value.distance * delta),
  );

  if (!isAnimating.value) {
    render();
  }
}

onMounted(async () => {
  await nextTick();
  await initLumaGL();

  // Add mouse listeners
  canvas.value.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  canvas.value.addEventListener("wheel", handleWheel);
});

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  if (device) {
    device.destroy();
  }

  // Remove listeners
  if (canvas.value) {
    canvas.value.removeEventListener("mousedown", handleMouseDown);
    canvas.value.removeEventListener("wheel", handleWheel);
  }
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
});
</script>

<style scoped>
.single-view-3d {
  width: 100vw;
  height: 100vh;
  background: #0a0a0a;
  color: #00ff00;
  font-family: "JetBrains Mono", monospace;
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
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

.system-info {
  display: flex;
  gap: 20px;
  font-size: 10px;
  color: #666;
}

.mind-canvas-3d {
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid #00ff00;
  cursor: grab;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
}

.mind-canvas-3d:active {
  cursor: grabbing;
}

.parameter-controls {
  position: absolute;
  top: 70px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  padding: 15px;
  z-index: 100;
}

.control-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.control-btn {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  color: #666;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s ease;
  font-family: inherit;
}

.control-btn:hover {
  border-color: #00ff00;
  color: #00ff00;
}

.parameter-info {
  font-size: 9px;
  color: #888;
}

.param-line {
  margin: 2px 0;
}

.instructions {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #333;
  padding: 10px;
  font-size: 9px;
  color: #666;
  z-index: 100;
}

.instructions div {
  margin: 2px 0;
}
</style>


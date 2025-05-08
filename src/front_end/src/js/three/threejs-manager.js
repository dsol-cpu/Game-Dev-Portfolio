import {
  AmbientLight,
  DirectionalLight,
  Scene,
  Vector2,
  WebGLRenderer,
  Frustum,
  Matrix4,
} from "../extern/three/three.module.min.js";
import { isIdle } from "../user-interaction.js";
import { getFallbackCube } from "./model-manager.js";

// Core configuration
const CONFIG = {
  MAX_CAMERAS: 16,
  VISIBILITY_THRESHOLD: 0.01,
  BATCH_SIZE: 4,
  IDLE_FRAME_SKIP: 5,
  VEC_POOL_SIZE: 8, // Reduced from 16
  CLEANUP_INTERVAL: 60000,
  LOD_VERTEX_THRESHOLD: 32,
};

// Resource pools and caches
const vecPool = Array(CONFIG.VEC_POOL_SIZE)
  .fill()
  .map(() => new Vector2());
const shaderCache = new Map();
const geometryPool = new Map();
const materialPool = new Map();
let vecPoolIndex = 0;

// Rendering state
let renderer, scene;
let isActive = false;
let lastCleanup = 0;
let lastFrameTime = 0;
let frameBudget = 16.66; // ~60fps
let adaptiveSkipRate = 1;
let needsFullRender = false;
let hasActiveDrag = false;

// Camera tracking with TypedArrays for performance
let activeCams = new Uint8Array(CONFIG.MAX_CAMERAS);
let visibleCams = new Uint8Array(CONFIG.MAX_CAMERAS);
let dirtyCams = new Uint8Array(CONFIG.MAX_CAMERAS);
let lastRender = new Float32Array(CONFIG.MAX_CAMERAS);
let cameras = Array(CONFIG.MAX_CAMERAS).fill(null);
let controls = Array(CONFIG.MAX_CAMERAS).fill(null);
let contexts = Array(CONFIG.MAX_CAMERAS).fill(null);
let metadata = Array(CONFIG.MAX_CAMERAS).fill(null);
let count = 0;

// Observer tracking and metrics
let observers = [];
let metrics = {
  frames: 0,
  lastFpsTime: 0,
  fps: 0,
  skipped: 0,
  rendered: 0,
  total: 0,
};

/**
 * Get a vector from pool for temporary calculations
 */
function getVec2() {
  const vec = vecPool[vecPoolIndex];
  vecPoolIndex = (vecPoolIndex + 1) % CONFIG.VEC_POOL_SIZE;
  return vec.set(0, 0);
}

/**
 * Get or create geometry from pool
 */
export function getPooledGeometry(key, createFn) {
  if (!geometryPool.has(key)) {
    geometryPool.set(key, createFn());
  }
  return geometryPool.get(key);
}

/**
 * Get or create material from pool
 */
export function getPooledMaterial(key, createFn) {
  if (!materialPool.has(key)) {
    materialPool.set(key, createFn());
  }
  return materialPool.get(key);
}

/**
 * Initialize the ThreeJS manager
 */
export async function initThreeJSManager() {
  // Create optimized renderer
  renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    precision: "mediump",
    depth: true,
    stencil: false,
  });

  // Configure renderer settings
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;
  renderer.autoClear = false;

  // Setup context recovery handlers
  setupContextHandlers();

  // Create and configure scene
  setupScene();

  // Setup event listeners
  setupEventListeners();

  // Set manager as active
  isActive = true;

  return {
    getStats: () => ({
      fps: metrics.fps,
      rendered: metrics.rendered,
      skipped: metrics.skipped,
      total: metrics.total,
    }),
    render: renderFrame,
    isActive: () => isActive,
  };
}

/**
 * Setup WebGL context loss/restore handlers
 */
function setupContextHandlers() {
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      isActive = false;
    },
    false
  );

  renderer.domElement.addEventListener(
    "webglcontextrestored",
    () => {
      dirtyCams.fill(1, 0, count);
      needsFullRender = true;
      isActive = true;
    },
    false
  );
}

/**
 * Setup scene with lights
 */
function setupScene() {
  scene = new Scene();
  scene.matrixAutoUpdate = false;
  scene.autoUpdate = false;
  scene.add(getFallbackCube());

  // Add lights
  const ambient = new AmbientLight(0xffffff, 0.5);
  ambient.matrixAutoUpdate = false;

  const direct = new DirectionalLight(0xffffff, 0.8);
  direct.position.set(5, 5, 2);
  direct.castShadow = false;
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();

  scene.add(ambient);
  scene.add(direct);
}

/**
 * Set up document and window event listeners
 */
function setupEventListeners() {
  // Visibility change handler
  document.addEventListener(
    "visibilitychange",
    () => {
      const isHidden = document.visibilityState === "hidden";
      isHidden ? pauseManager() : resumeManager();
    },
    { passive: true }
  );

  // Debounced resize handler
  let resizeTimeout = null;
  window.addEventListener(
    "resize",
    () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        dirtyCams.fill(1, 0, count);
        needsFullRender = true;
        resizeTimeout = null;
      }, 200);
    },
    { passive: true }
  );

  // Focus handler
  window.addEventListener(
    "focus",
    () => {
      if (!isActive) resumeManager();
    },
    { passive: true }
  );

  // Cleanup on unload
  window.addEventListener("beforeunload", cleanupResources);
}

/**
 * Pause the rendering manager
 */
function pauseManager() {
  isActive = false;
  if (renderer) renderer.setPixelRatio(1.0);
}

/**
 * Resume the rendering manager
 */
function resumeManager() {
  dirtyCams.fill(1, 0, count);
  needsFullRender = true;
  isActive = true;

  metrics.lastFpsTime = performance.now();
  metrics.frames = 0;

  if (renderer)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

/**
 * Register a camera with the manager
 */
export function registerCamera(
  camera,
  cameraControls,
  context,
  cameraMetadata = {},
  active = true
) {
  if (count >= CONFIG.MAX_CAMERAS) {
    throw new Error(`Max cameras (${CONFIG.MAX_CAMERAS}) reached`);
  }

  const idx = count++;

  // Store camera data
  cameras[idx] = camera;
  controls[idx] = cameraControls;
  contexts[idx] = context;
  metadata[idx] = cameraMetadata;

  // Set flags
  activeCams[idx] = active ? 1 : 0;
  visibleCams[idx] = 1;
  dirtyCams[idx] = 1;

  // Camera optimizations
  if (camera?.isPerspectiveCamera) {
    camera.matrixAutoUpdate = true;
  }

  // Configure controls
  configureControls(cameraControls);

  // Setup observer for visibility
  setupCanvasObserver(context, idx, active);

  return idx;
}

/**
 * Configure camera controls with optimal settings
 */
function configureControls(ctrl) {
  if (!ctrl) return;

  // Enable damping if available
  if ("enableDamping" in ctrl) {
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.1;
  }

  // Apply common settings
  Object.assign(ctrl, {
    rotateSpeed: 0.65,
    zoomSpeed: 0.65,
    enableKeys: false,
  });
}

/**
 * Setup observer for canvas visibility
 */
function setupCanvasObserver(context, idx, active) {
  if (!context?.canvas) return;

  context.canvas.style.display = active ? "block" : "none";

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;

      const wasVisible = visibleCams[idx] === 1;
      const isVisible =
        entry.isIntersecting &&
        entry.intersectionRatio > CONFIG.VISIBILITY_THRESHOLD;

      visibleCams[idx] = isVisible ? 1 : 0;

      if (!wasVisible && isVisible) {
        dirtyCams[idx] = 1;
        if (!isActive) resumeManager();
      }
    },
    {
      threshold: [0, CONFIG.VISIBILITY_THRESHOLD, 0.5],
      rootMargin: "100px",
    }
  );

  observer.observe(context.canvas);
  observers.push({ idx, observer });
}

/**
 * Set camera visibility
 */
export function setCameraVisible(idx, visible) {
  if (idx < 0 || idx >= count) return;

  const wasVisible = activeCams[idx] === 1;
  const newVisible = visible ? 1 : 0;

  activeCams[idx] = newVisible;

  if (wasVisible !== (newVisible === 1)) {
    dirtyCams[idx] = 1;
  }

  const ctx = contexts[idx];
  if (ctx?.canvas) {
    ctx.canvas.style.display = visible ? "block" : "none";
  }

  if (visible && !isActive) {
    resumeManager();
  }
}

/**
 * Check if camera is active
 */
export function isCameraActive(idx) {
  return idx >= 0 && idx < count && activeCams[idx] === 1;
}

/**
 * Force redraw of a specific camera
 */
export function forceRedraw(idx) {
  if (idx < 0 || idx >= count) return;

  dirtyCams[idx] = 1;

  if (!isActive) resumeManager();
}

/**
 * Dispose a camera and its resources
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= count) return;

  // Dispose controls
  const ctrl = controls[idx];
  if (ctrl?.dispose) ctrl.dispose();

  // Dispose camera resources
  const cam = cameras[idx];
  if (cam?.userData?.disposables) {
    cam.userData.disposables.forEach((item) => {
      if (item?.dispose) item.dispose();
    });
    cam.userData.disposables = [];
  }

  // Clear references
  cameras[idx] = null;
  controls[idx] = null;
  contexts[idx] = null;
  metadata[idx] = null;

  // Reset flags
  activeCams[idx] = 0;
  visibleCams[idx] = 0;
  dirtyCams[idx] = 0;
  lastRender[idx] = 0;

  // Disconnect observer
  const obsIdx = observers.findIndex((o) => o.idx === idx);
  if (obsIdx >= 0) {
    observers[obsIdx].observer.disconnect();
    observers.splice(obsIdx, 1);
  }
}

/**
 * Get the scene instance
 */
export function getScene() {
  return scene;
}

/**
 * Get all registered cameras
 */
export function getAllCameras() {
  const result = [];

  for (let i = 0; i < count; i++) {
    if (cameras[i]) {
      result.push({
        index: i,
        camera: cameras[i],
        metadata: metadata[i],
        active: activeCams[i] === 1,
        visible: visibleCams[i] === 1,
      });
    }
  }

  return result;
}

/**
 * Clean up all WebGL and Three.js resources
 */
function cleanupResources() {
  isActive = false;

  // Disconnect observers
  observers.forEach(({ observer }) => observer.disconnect());
  observers = [];

  // Clean up cameras and controls
  for (let i = 0; i < count; i++) {
    disposeCamera(i);
  }

  // Clear object pools
  geometryPool.forEach((geo) => geo?.dispose?.());
  materialPool.forEach((mat) => mat?.dispose?.());
  geometryPool.clear();
  materialPool.clear();
  shaderCache.clear();

  // Clean up WebGL context
  if (renderer) {
    try {
      renderer.dispose();
      renderer.forceContextLoss();
    } catch (e) {
      // Ignore errors during cleanup
    }
    renderer = null;
  }

  // Clean up scene
  if (scene) {
    disposeSceneResources(scene);
    scene = null;
  }

  // Reset state
  count = 0;
}

/**
 * Dispose of all scene resources
 */
function disposeSceneResources(scene) {
  scene.traverse((obj) => {
    if (obj.geometry?.dispose) obj.geometry.dispose();

    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m?.dispose?.());
      } else {
        obj.material.dispose?.();
      }
    }

    if (obj.userData?.disposables) {
      obj.userData.disposables.forEach((item) => item?.dispose?.());
    }
  });

  scene.children.length = 0;
}

/**
 * Perform resource cleanup
 */
export function performCleanup(force = false) {
  const now = performance.now();
  if (!force && now - lastCleanup < CONFIG.CLEANUP_INTERVAL) return;

  lastCleanup = now;

  // Compact arrays
  let writeIdx = 0;
  for (let i = 0; i < count; i++) {
    if (cameras[i] === null) continue;

    if (i === writeIdx) {
      writeIdx++;
      continue;
    }

    // Move camera data to compact position
    cameras[writeIdx] = cameras[i];
    controls[writeIdx] = controls[i];
    contexts[writeIdx] = contexts[i];
    metadata[writeIdx] = metadata[i];
    activeCams[writeIdx] = activeCams[i];
    visibleCams[writeIdx] = visibleCams[i];
    dirtyCams[writeIdx] = dirtyCams[i];
    lastRender[writeIdx] = lastRender[i];

    // Update observer indices
    const obsIdx = observers.findIndex((o) => o.idx === i);
    if (obsIdx >= 0) observers[obsIdx].idx = writeIdx;

    // Clear old position
    cameras[i] = null;
    controls[i] = null;
    contexts[i] = null;
    metadata[i] = null;

    writeIdx++;
  }

  count = writeIdx;
}

/**
 * Render a frame with optimizations for single-camera use case
 */
export function renderFrame(deltaTime) {
  if (!isActive) return false;

  // Adaptive frame management
  const now = performance.now();
  const frameTimeMs = now - lastFrameTime;
  lastFrameTime = now;

  // Adjust skip rate based on performance
  if (
    frameTimeMs > frameBudget * 1.5 &&
    adaptiveSkipRate < CONFIG.IDLE_FRAME_SKIP
  ) {
    adaptiveSkipRate = Math.min(adaptiveSkipRate + 1, CONFIG.IDLE_FRAME_SKIP);
  } else if (frameTimeMs < frameBudget * 0.8 && adaptiveSkipRate > 1) {
    adaptiveSkipRate = Math.max(adaptiveSkipRate - 1, 1);
  }

  // Skip frames when appropriate
  if (
    isIdle() &&
    !hasActiveDrag &&
    !needsFullRender &&
    metrics.frames % adaptiveSkipRate !== 0
  ) {
    metrics.skipped++;
    return false;
  }

  // Update controls and check for drag operations
  updateControls(deltaTime);

  // Render cameras using optimized path when only one camera is active
  if (renderer) {
    // Check if we're in single camera mode
    if (isSingleCameraMode()) {
      return renderSingleCamera();
    } else {
      return renderCameras();
    }
  }

  return false;
}

/**
 * Check if we're in single camera mode (only one camera active and visible)
 */
function isSingleCameraMode() {
  let activeCount = 0;
  let lastActiveIdx = -1;

  for (let i = 0; i < count; i++) {
    if (activeCams[i] === 1 && visibleCams[i] === 1) {
      activeCount++;
      lastActiveIdx = i;
      if (activeCount > 1) break;
    }
  }

  return activeCount === 1 && lastActiveIdx >= 0;
}

let activeIdx = -1;

/**
 * Optimized rendering when only one camera is active
 */
function renderSingleCamera() {
  // Find the single active camera
  if (activeIdx === -1)
    for (let i = 0; i < count; i++) {
      if (activeCams[i] === 1 && visibleCams[i] === 1) {
        activeIdx = i;
        break;
      }
    }

  if (activeIdx === -1) return false;

  const cam = cameras[activeIdx];
  const ctx = contexts[activeIdx];
  const ctrl = controls[activeIdx];

  // Skip if no camera needs rendering
  if (dirtyCams[activeIdx] !== 1 && !ctrl?._dragging && !needsFullRender) {
    metrics.skipped++;
    return false;
  }

  if (!cam || !ctx?.canvas?.isConnected) return false;

  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;

  if (w <= 8 || h <= 8) return false;

  try {
    // Optimize renderer setup for single camera
    renderer.autoClear = true; // Enable autoClear for single camera
    renderer.scissorTest = false; // Disable scissor test
    renderer.setSize(w, h, false);
    renderer.setViewport(0, 0, w, h);

    // Update matrices - more efficiently for single camera
    cam.updateMatrixWorld(true);
    scene.updateMatrixWorld(false); // Don't force update for all objects

    // Only apply frustum culling if we have a complex scene
    if (scene.children.length > 10) {
      applyFrustumCulling(cam);
    }

    // Render scene
    renderer.render(scene, cam);

    // Copy to destination canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(
      renderer.domElement,
      0,
      0,
      renderer.domElement.width,
      renderer.domElement.height,
      0,
      0,
      w,
      h
    );

    // Update state
    lastRender[activeIdx] = performance.now();
    dirtyCams[activeIdx] = 0;
    metrics.rendered++;
    metrics.total++;

    needsFullRender = false;

    return true;
  } catch (e) {
    console.error("Error rendering single camera", e);
    return false;
  }
}

/**
 * Update camera controls and check for drag operations
 */
function updateControls(deltaTime) {
  hasActiveDrag = false;

  for (let i = 0; i < count; i++) {
    if (activeCams[i] !== 1 || visibleCams[i] !== 1) continue;

    const ctrl = controls[i];
    if (!ctrl) continue;

    if (ctrl._dragging) hasActiveDrag = true;

    if (ctrl.update) {
      ctrl.update(deltaTime);
      dirtyCams[i] = 1;
    }
  }
}

/**
 * Render all active cameras
 */
function renderCameras() {
  renderer.autoClear = false;
  renderer.scissorTest = true;

  metrics.rendered = 0;

  try {
    // Get priority-sorted camera indices
    const prioritizedCameras = prioritizeCameras();

    // Render cameras up to batch size
    for (
      let i = 0;
      i < Math.min(prioritizedCameras.length, CONFIG.BATCH_SIZE);
      i++
    ) {
      renderCamera(prioritizedCameras[i]);
    }

    renderer.scissorTest = false;
    needsFullRender = false;
  } catch (e) {
    console.error("Error rendering cameras", e);
  }

  // Update FPS metrics
  metrics.frames++;
  const now = performance.now();
  if (now - metrics.lastFpsTime >= 1000) {
    metrics.fps = metrics.frames;
    metrics.frames = 0;
    metrics.lastFpsTime = now;
  }

  return metrics.rendered > 0;
}

/**
 * Prioritize cameras for rendering
 */
function prioritizeCameras() {
  // Collect candidates
  const candidates = [];

  for (let i = 0; i < count; i++) {
    if (activeCams[i] !== 1 || visibleCams[i] !== 1 || dirtyCams[i] !== 1)
      continue;

    // Check if camera is in viewport
    const ctx = contexts[i];
    if (!ctx?.canvas) continue;

    const rect = ctx.canvas.getBoundingClientRect();
    const isInViewport =
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth;

    if (isInViewport) {
      candidates.push({
        idx: i,
        priority: controls[i]?._dragging ? 10 : 5,
      });
    } else {
      // Not in viewport, mark as processed
      dirtyCams[i] = 0;
      metrics.skipped++;
    }
  }

  // Sort by priority (higher first)
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.idx);
}

/**
 * Render a single camera
 */
function renderCamera(idx) {
  const cam = cameras[idx];
  const ctx = contexts[idx];

  if (!cam || !ctx?.canvas?.isConnected) return false;

  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;

  if (w <= 8 || h <= 8) return false;

  try {
    // Configure renderer for this camera
    renderer.setSize(w, h, false);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.clear(true, true, false);

    // Update matrices
    cam.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);

    // Apply frustum culling
    applyFrustumCulling(cam);

    // Render scene
    renderer.render(scene, cam);

    // Copy to destination canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(
      renderer.domElement,
      0,
      0,
      renderer.domElement.width,
      renderer.domElement.height,
      0,
      0,
      w,
      h
    );

    // Update state
    lastRender[idx] = performance.now();
    dirtyCams[idx] = 0;
    metrics.rendered++;
    metrics.total++;

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Apply frustum culling to optimize rendering
 */
function applyFrustumCulling(camera) {
  if (!camera) return;

  const frustum = new Frustum();
  frustum.setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
  );

  // Only render objects in view
  scene.traverse((object) => {
    if (object.isMesh && object.userData.skipFrustum !== true) {
      object.visible = frustum.intersectsObject(object);
    }
  });
}

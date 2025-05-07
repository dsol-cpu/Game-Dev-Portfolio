/**
 * Ultra-compact ThreeJS manager with zero overhead
 */
import {
  AmbientLight,
  DirectionalLight,
  Scene,
  Vector2,
  WebGLRenderer,
} from "../extern/three/three.module.min.js";
import { isIdle } from "../user-interaction.js";
import { getFallbackCube } from "./model-manager.js";

// Core constants
const MAX_CAMERAS = 32;
const VISIBILITY_THRESHOLD = 0.01;
const BATCH_SIZE = 4;
const TEMP_VEC2 = new Vector2();
const IDLE_FRAME_SKIP = 4; // ~15fps when idle

// Rendering state
let renderer, scene;
let isActive = false;
let lastCleanup = 0;

// Camera tracking arrays
let activeCams = new Uint8Array(MAX_CAMERAS);
let visibleCams = new Uint8Array(MAX_CAMERAS);
let dirtyCams = new Uint8Array(MAX_CAMERAS);
let lastRender = new Float32Array(MAX_CAMERAS);
let cameras = Array(MAX_CAMERAS).fill(null);
let controls = Array(MAX_CAMERAS).fill(null);
let contexts = Array(MAX_CAMERAS).fill(null);
let metadata = Array(MAX_CAMERAS).fill(null);
let count = 0;

// Observers and metrics
let observers = [];
let metrics = {
  frames: 0,
  lastFpsTime: 0,
  fps: 0,
  skipped: 0,
  rendered: 0,
  total: 0,
};

// Render flags
let needsFullRender = false;
let hasActiveDrag = false;

/**
 * Initialize the ThreeJS manager
 */
export function initThreeJSManager() {
  // Create optimized renderer
  renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    precision: "lowp",
    depth: true,
    stencil: false,
    logarithmicDepthBuffer: false,
    premultipliedAlpha: false,
  });

  // Configure renderer
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = false;
  renderer.physicallyCorrectLights = false;
  renderer.outputEncoding = 3000;
  renderer.info.autoReset = false;
  renderer.autoClear = false;

  // Create scene
  scene = new Scene();
  scene.matrixAutoUpdate = false;
  scene.autoUpdate = false;
  scene.background = null;
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

  // Reset state
  resetState();

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
 * Set up document and window event listeners
 */
function setupEventListeners() {
  // Document visibility handler
  document.addEventListener(
    "visibilitychange",
    () => {
      const isHidden = document.visibilityState === "hidden";

      if (isHidden && isActive) {
        pauseManager();
      } else if (!isHidden && !isActive) {
        resumeManager();
      }
    },
    { passive: true }
  );

  // Window resize handler
  let resizing = false;
  window.addEventListener(
    "resize",
    () => {
      if (resizing) return;
      resizing = true;
      requestAnimationFrame(() => {
        dirtyCams.fill(1, 0, count);
        needsFullRender = true;
        resizing = false;
      });
    },
    { passive: true }
  );

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanupResources);
}

/**
 * Pause the manager
 */
function pauseManager() {
  isActive = false;
}

/**
 * Resume the manager
 */
function resumeManager() {
  dirtyCams.fill(1, 0, count);
  isActive = true;
}

/**
 * Reset the manager state
 */
function resetState() {
  activeCams.fill(0);
  visibleCams.fill(0);
  dirtyCams.fill(0);
  lastRender.fill(0);
  count = 0;

  // Reset metrics
  Object.assign(metrics, {
    frames: 0,
    lastFpsTime: 0,
    fps: 0,
    skipped: 0,
    rendered: 0,
    total: 0,
  });
}

/**
 * Clean up all WebGL and Three.js resources
 */
function cleanupResources() {
  // Stop manager
  if (isActive) {
    pauseManager();
  }

  // Disconnect observers
  observers.forEach(({ observer }) => observer.disconnect());
  observers.length = 0;

  // Clean up cameras and controls
  for (let i = 0; i < count; i++) {
    const ctrl = controls[i];
    if (ctrl?.dispose) ctrl.dispose();

    // Clean up camera resources
    const cam = cameras[i];
    if (cam?.userData?.disposables) {
      cam.userData.disposables.forEach((item) => {
        if (item?.dispose) item.dispose();
      });
    }

    controls[i] = null;
    cameras[i] = null;
    contexts[i] = null;
    metadata[i] = null;
  }

  // Clean up WebGL context
  if (renderer) {
    const gl = renderer.getContext();
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();

    renderer.dispose();
    renderer.forceContextLoss();
    renderer = null;
  }

  // Clean up scene
  if (scene) {
    disposeSceneResources(scene);
    scene = null;
  }

  // Reset state
  resetState();
}

/**
 * Recursively dispose scene resources
 */
function disposeSceneResources(scene) {
  // Remove all children
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }

  scene.traverse((obj) => {
    // Dispose geometries
    if (obj.geometry?.dispose) obj.geometry.dispose();

    // Dispose materials
    if (obj.material) {
      disposeMaterial(obj.material);
    }

    // Dispose custom resources
    if (obj.userData?.disposables) {
      obj.userData.disposables.forEach((item) => {
        if (item?.dispose) item.dispose();
      });
    }
  });
}

/**
 * Dispose material and its textures
 */
function disposeMaterial(material) {
  if (!material) return;

  // Handle material arrays
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  // Dispose textures
  Object.keys(material).forEach((prop) => {
    const value = material[prop];
    if (value?.isTexture) value.dispose();
  });

  if (material.dispose) material.dispose();
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
  if (count >= MAX_CAMERAS) {
    throw new Error(`Max cameras (${MAX_CAMERAS}) reached`);
  }

  const idx = count++;

  // Store references
  cameras[idx] = camera;
  controls[idx] = cameraControls;
  contexts[idx] = context;
  metadata[idx] = cameraMetadata;

  // Set flags
  activeCams[idx] = active ? 1 : 0;
  visibleCams[idx] = 1;
  dirtyCams[idx] = 1;

  // Optimize camera
  if (camera?.isPerspectiveCamera) {
    camera.matrixAutoUpdate = true;
  }

  // Configure controls
  configureControls(cameraControls);

  // Setup canvas and visibility observer
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
  const settings = {
    rotateSpeed: 0.65,
    zoomSpeed: 0.65,
    enableKeys: false,
    keyPanSpeed: 0,
  };

  for (const [key, value] of Object.entries(settings)) {
    if (key in ctrl) ctrl[key] = value;
  }
}

/**
 * Setup intersection observer for canvas visibility
 */
function setupCanvasObserver(context, idx, active) {
  if (!context?.canvas) return;

  context.canvas.style.display = active ? "block" : "none";

  // Setup intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;

      const wasVisible = visibleCams[idx] === 1;
      const isVisible = entry.isIntersecting;

      visibleCams[idx] = isVisible ? 1 : 0;

      if (!wasVisible && isVisible) {
        dirtyCams[idx] = 1;
        if (!isActive) {
          resumeManager();
        }
      }
    },
    {
      threshold: VISIBILITY_THRESHOLD,
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
 * Dispose a camera
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
 * Force redraw of a specific camera
 */
export function forceRedraw(idx) {
  if (idx < 0 || idx >= count) return;

  dirtyCams[idx] = 1;

  if (!isActive) {
    resumeManager();
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
 * Compact arrays to reclaim space
 */
export function performCleanup(force = false) {
  const now = performance.now();
  if (!force && now - (lastCleanup || 0) < 30000) return;

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
    renderer.setSize(w, h, false);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.scissorTest = true;
    renderer.clear(true, true, false);

    cam.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);

    renderer.render(scene, cam);

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

    lastRender[idx] = performance.now();
    dirtyCams[idx] = 0;
    metrics.rendered++;
    metrics.total++;

    return true;
  } catch (e) {
    // Ignore rendering errors
    return false;
  }
}

/**
 * Process a frame with the given deltaTime
 * This function should be called from an external render loop
 */
export function renderFrame(deltaTime) {
  if (!isActive) return false;

  // Update controls and check for active drags
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

  // Render cameras
  if (renderer) {
    renderer.autoClear = false;
    renderer.scissorTest = true;

    metrics.rendered = 0;

    try {
      // Batch render cameras
      for (let start = 0; start < count; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE, count);

        for (let i = start; i < end; i++) {
          // Skip inactive or invisible cameras
          if (
            activeCams[i] !== 1 ||
            visibleCams[i] !== 1 ||
            dirtyCams[i] !== 1
          ) {
            continue;
          }

          renderCamera(i);
        }
      }

      renderer.scissorTest = false;
      needsFullRender = false;
      renderer.info.reset();
    } catch (e) {
      // Ignore batching errors
    }
  }

  // Update FPS counter
  metrics.frames++;
  if (deltaTime - metrics.lastFpsTime >= 1000) {
    metrics.fps = metrics.frames;
    metrics.frames = 0;
    metrics.lastFpsTime = deltaTime;
  }

  return metrics.rendered > 0;
}

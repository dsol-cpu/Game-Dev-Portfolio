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
import { TimeManager } from "./time-manager.js";

// CORE CONSTANTS
const MAX_CAMERAS = 32;
const VISIBILITY_THRESHOLD = 0.01;
const BATCH_SIZE = 4;
const MIN_DELTA_TIME = 1 / 120;
const MAX_DELTA_TIME = 1 / 30;
const TEMP_VEC2 = new Vector2();

// PRE-ALLOCATED SINGLETON
const manager = {
  renderer: null, // renderer
  scene: null, // scene
  rafId: 0,
  isRendering: false,
  lastTs: 0,
  dimCache: new Map(),
  // TypedArrays for memory efficiency
  activeCams: new Uint8Array(MAX_CAMERAS), // active
  visibleCams: new Uint8Array(MAX_CAMERAS), // visible
  dirtyCams: new Uint8Array(MAX_CAMERAS), // dirty
  lastRender: new Float32Array(MAX_CAMERAS), // lastRender
  count: 0, // count
  // Flat arrays for better iteration
  cameras: Array(MAX_CAMERAS).fill(null), // cameras
  controls: Array(MAX_CAMERAS).fill(null), // controls
  contexts: Array(MAX_CAMERAS).fill(null), // contexts
  metadata: Array(MAX_CAMERAS).fill(null), // metadata
  // Observers and metrics
  observers: [], // observers
  metrics: {
    frames: 0,
    lastFpsTime: 0,
    fps: 0,
    skipped: 0,
    rendered: 0,
    total: 0,
  },
  f: {
    // flags
    needsFullRender: false,
    hasActiveDrag: false,
  },
};

/**
 * Initialize the ThreeJS manager
 */
export function initThreeJSManager() {
  manager.renderer = new WebGLRenderer({
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

  const r = manager.renderer;
  r.setClearColor(0x000000, 0);
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  r.shadowMap.enabled = false;
  r.shadowMap.autoUpdate = false;
  r.physicallyCorrectLights = false;
  r.toneMappingExposure = 1.0;
  r.outputEncoding = 3000;
  r.info.autoReset = false;
  r.autoClear = false;

  // Create scene
  manager.scene = new Scene();
  manager.scene.matrixAutoUpdate = false;
  manager.scene.autoUpdate = false;
  manager.scene.background = null;
  manager.scene.add(getFallbackCube());

  // Add lights
  const ambient = new AmbientLight(0xffffff, 0.5);
  ambient.matrixAutoUpdate = false;
  const direct = new DirectionalLight(0xffffff, 0.8);
  direct.position.set(5, 5, 2);
  direct.castShadow = false;
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();
  manager.scene.add(ambient);
  manager.scene.add(direct);

  // Reset state
  manager.activeCams.fill(0);
  manager.visibleCams.fill(0);
  manager.dirtyCams.fill(0);
  manager.lastRender.fill(0);
  manager.count = 0;

  // Event handlers
  document.addEventListener(
    "visibilitychange",
    () => {
      document.visibilityState === "hidden"
        ? pauseRendering()
        : resumeRendering();
    },
    { passive: true }
  );

  let resizing = false;
  window.addEventListener(
    "resize",
    () => {
      if (resizing) return;
      resizing = true;
      requestAnimationFrame(() => {
        manager.dirtyCams.fill(1, 0, manager.count);
        manager.f.needsFullRender = true;
        resizing = false;
      });
    },
    { passive: true }
  );

  window.addEventListener("beforeunload", disposeThreeJSManager);

  // Start rendering
  startRendering();

  return {
    getStats: () => ({
      fps: manager.metrics.fps,
      rendered: manager.metrics.rendered,
      skipped: manager.metrics.skipped,
      total: manager.metrics.total,
    }),
  };
}

/**
 * Register camera
 */
export function registerCamera(
  camera,
  controls,
  context,
  metadata = {},
  active = true
) {
  if (manager.count >= MAX_CAMERAS)
    throw new Error(`Max cameras (${MAX_CAMERAS}) reached`);

  const idx = manager.count++;

  // Store refs
  manager.cameras[idx] = camera;
  manager.controls[idx] = controls;
  manager.contexts[idx] = context;
  manager.metadata[idx] = metadata;

  // Set flags
  manager.activeCams[idx] = active ? 1 : 0;
  manager.visibleCams[idx] = 1;
  manager.dirtyCams[idx] = 1;

  // Optimize components
  if (camera?.isPerspectiveCamera) camera.matrixAutoUpdate = true;

  if (controls) {
    if ("enableDamping" in controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
    }

    // Apply settings
    const settings = {
      rotateSpeed: 0.65,
      zoomSpeed: 0.65,
      enableKeys: false,
      keyPanSpeed: 0,
    };

    for (const [k, v] of Object.entries(settings)) {
      if (k in controls) controls[k] = v;
    }
  }

  // Setup canvas
  if (context?.canvas) {
    context.canvas.style.display = active ? "block" : "none";

    // Setup observer
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const wasVisible = manager.visibleCams[idx] === 1;
        const isVisible = entry.isIntersecting;

        manager.visibleCams[idx] = isVisible ? 1 : 0;

        if (!wasVisible && isVisible) {
          manager.dirtyCams[idx] = 1;
          if (!manager.isRendering) startRendering();
        }
      },
      {
        threshold: VISIBILITY_THRESHOLD,
        rootMargin: "100px",
      }
    );

    observer.observe(context.canvas);
    manager.observers.push({ idx, observer });
  }

  return idx;
}

/**
 * Set camera visibility
 */
export function setCameraVisible(idx, visible) {
  if (idx < 0 || idx >= manager.count) return;

  const prev = manager.activeCams[idx] === 1;
  manager.activeCams[idx] = visible ? 1 : 0;

  if (prev !== visible) manager.dirtyCams[idx] = 1;

  const ctx = manager.contexts[idx];
  if (ctx?.canvas) ctx.canvas.style.display = visible ? "block" : "none";

  if (visible && !manager.isRendering) startRendering();
}

/**
 * Get camera's active state
 */
export function isCameraActive(idx) {
  return idx >= 0 && idx < manager.count && manager.activeCams[idx] === 1;
}

/**
 * Update controls with consistent deltaTime
 */
function updateControls(dt) {
  manager.f.hasActiveDrag = false;
  let updated = false;

  for (let i = 0; i < manager.count; i++) {
    if (manager.activeCams[i] !== 1 || manager.visibleCams[i] !== 1) continue;

    const ctrl = manager.controls[i];
    if (!ctrl) continue;

    if (ctrl._dragging) manager.f.hasActiveDrag = true;

    if (ctrl.update) {
      ctrl.update(dt);
      manager.dirtyCams[i] = 1;
      updated = true;
    }
  }

  return updated;
}

/**
 * Render single camera
 */
function renderCamera(idx, dt) {
  if (
    manager.activeCams[idx] !== 1 ||
    manager.visibleCams[idx] !== 1 ||
    manager.dirtyCams[idx] !== 1
  )
    return false;

  const cam = manager.cameras[idx];
  const ctx = manager.contexts[idx];

  if (!cam || !ctx?.canvas?.isConnected) return false;

  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;

  if (w <= 8 || h <= 8) return false;

  try {
    const r = manager.renderer;
    if (!r) return false;

    r.setSize(w, h, false);
    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.scissorTest = true;
    r.clear(true, true, false);

    cam.updateMatrixWorld(true);
    manager.scene.updateMatrixWorld(true);

    r.render(manager.scene, cam);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(
      r.domElement,
      0,
      0,
      r.domElement.width,
      r.domElement.height,
      0,
      0,
      w,
      h
    );

    manager.lastRender[idx] = performance.now();
    manager.dirtyCams[idx] = 0;
    manager.metrics.rendered++;
    manager.metrics.total++;

    return true;
  } catch {
    return false;
  }
}

/**
 * Batch render all cameras
 */
function renderCameras(dt) {
  const r = manager.renderer;
  if (!r) return 0;

  manager.metrics.rendered = 0;

  try {
    r.autoClear = false;
    r.scissorTest = true;

    updateControls(dt);

    const count = manager.count;
    let rendered = 0;

    for (let start = 0; start < count; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, count);
      for (let i = start; i < end; i++) {
        if (renderCamera(i, dt)) rendered++;
      }
    }

    r.scissorTest = false;
    manager.f.needsFullRender = false;
    r.info.reset();

    return manager.metrics.rendered;
  } catch {
    return 0;
  }
}

/**
 * Update FPS counter
 */
function updateFPS(now) {
  const m = manager.metrics;
  m.frames++;

  if (now - m.lastFpsTime >= 1000) {
    m.fps = m.frames;
    m.frames = 0;
    m.lastFpsTime = now;
  }
}

/**
 * Main render loop
 */
function renderLoop(deltaTime) {
  if (!manager.isRendering) return;

  const timeInfo = TimeManager.update(deltaTime, "renderer");
  const now = performance.now();

  // Get consistent dt and clamp

  // Handle idle state
  const idle = isIdle();
  if (idle) {
    const idleFrameSkip = 4; // ~15fps when idle
    if (manager.metrics.frames % idleFrameSkip !== 0) {
      manager.rafId = requestAnimationFrame(renderLoop);
      return;
    }
  }

  // Render and update stats
  renderCameras(deltaTime);
  updateFPS(now);

  manager.lastTs = deltaTime;
  manager.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Start rendering
 */
function startRendering() {
  if (manager.isRendering) return;

  manager.isRendering = true;
  manager.lastTs = performance.now();
  manager.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Pause rendering
 */
function pauseRendering() {
  if (!manager.isRendering) return;

  manager.isRendering = false;

  if (manager.rafId) {
    cancelAnimationFrame(manager.rafId);
    manager.rafId = 0;
  }
}

/**
 * Resume rendering
 */
function resumeRendering() {
  if (manager.isRendering) return;

  manager.dirtyCams.fill(1, 0, manager.count);
  manager.isRendering = true;
  manager.lastTs = performance.now();
  manager.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Dispose a camera
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= manager.count) return;

  const ctrl = manager.controls[idx];
  if (ctrl?.dispose) ctrl.dispose();

  const cam = manager.cameras[idx];
  if (cam?.userData?.disposables) {
    cam.userData.disposables.forEach((item) => {
      if (item?.dispose) item.dispose();
    });
    cam.userData.disposables = [];
  }

  manager.cameras[idx] = null;
  manager.controls[idx] = null;
  manager.contexts[idx] = null;
  manager.metadata[idx] = null;

  manager.activeCams[idx] = 0;
  manager.visibleCams[idx] = 0;
  manager.dirtyCams[idx] = 0;
  manager.lastRender[idx] = 0;

  const obsIdx = manager.observers.findIndex((o) => o.idx === idx);
  if (obsIdx >= 0) {
    manager.observers[obsIdx].observer.disconnect();
    manager.observers.splice(obsIdx, 1);
  }
}

/**
 * Perform maintenance
 */
export function performCleanup(force = false) {
  const now = performance.now();
  if (!force && now - (manager._lastCleanup || 0) < 30000) return;

  // Compact arrays
  let writeIdx = 0;
  for (let i = 0; i < manager.count; i++) {
    if (manager.cameras[i] === null) continue;

    if (i === writeIdx) {
      writeIdx++;
      continue;
    }

    manager.cameras[writeIdx] = manager.cameras[i];
    manager.controls[writeIdx] = manager.controls[i];
    manager.contexts[writeIdx] = manager.contexts[i];
    manager.metadata[writeIdx] = manager.metadata[i];
    manager.activeCams[writeIdx] = manager.activeCams[i];
    manager.visibleCams[writeIdx] = manager.visibleCams[i];
    manager.dirtyCams[writeIdx] = manager.dirtyCams[i];
    manager.lastRender[writeIdx] = manager.lastRender[i];

    const obsIdx = manager.observers.findIndex((o) => o.idx === i);
    if (obsIdx >= 0) manager.observers[obsIdx].idx = writeIdx;

    manager.cameras[i] = null;
    manager.controls[i] = null;
    manager.contexts[i] = null;
    manager.metadata[i] = null;
  }

  manager.count = writeIdx;
}

/**
 * Complete ThreeJS cleanup
 */
export function disposeThreeJSManager() {
  pauseRendering();

  manager.observers.forEach(({ observer }) => observer.disconnect());
  manager.observers.length = 0;

  for (let i = 0; i < manager.count; i++) {
    const ctrl = manager.controls[i];
    if (ctrl?.dispose) ctrl.dispose();
    manager.controls[i] = null;
    manager.cameras[i] = null;
    manager.contexts[i] = null;
    manager.metadata[i] = null;
  }

  if (manager.renderer) {
    const gl = manager.renderer.getContext();
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();

    manager.renderer.dispose();
    manager.renderer.forceContextLoss();
    manager.renderer = null;
  }

  if (manager.scene) {
    while (manager.scene.children.length > 0) {
      manager.scene.remove(manager.scene.children[0]);
    }

    manager.scene.traverse((obj) => {
      if (obj.geometry?.dispose) obj.geometry.dispose();

      if (obj.material) {
        const disposeMaterial = (mat) => {
          if (!mat) return;

          if (Array.isArray(mat)) {
            mat.forEach(disposeMaterial);
            return;
          }

          Object.keys(mat).forEach((prop) => {
            const val = mat[prop];
            if (val?.isTexture) val.dispose();
          });

          if (mat.dispose) mat.dispose();
        };

        disposeMaterial(obj.material);
      }

      if (obj.userData?.disposables) {
        obj.userData.disposables.forEach((item) => {
          if (item?.dispose) item.dispose();
        });
      }
    });

    manager.scene = null;
  }

  manager.count = 0;
  manager.dimCache.clear();
  manager.activeCams.fill(0);
  manager.visibleCams.fill(0);
  manager.dirtyCams.fill(0);
  manager.lastRender.fill(0);

  Object.assign(manager.metrics, {
    frames: 0,
    lastFpsTime: 0,
    fps: 0,
    skipped: 0,
    rendered: 0,
    total: 0,
  });
}

/**
 * Get the scene instance
 */
export function getScene() {
  return manager.scene;
}

/**
 * Get all registered cameras
 */
export function getAllCameras() {
  const cameras = [];
  for (let i = 0; i < manager.count; i++) {
    if (manager.cameras[i]) {
      cameras.push({
        index: i,
        camera: manager.cameras[i],
        metadata: manager.metadata[i],
        active: manager.activeCams[i] === 1,
        visible: manager.visibleCams[i] === 1,
      });
    }
  }
  return cameras;
}

/**
 * Force redraw of a specific camera
 */
export function forceRedraw(idx) {
  if (idx < 0 || idx >= manager.count) return;
  manager.dirtyCams[idx] = 1;

  if (!manager.isRendering) startRendering();
}

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
const mgr = {
  r: null, // renderer
  s: null, // scene
  rafId: 0,
  rendering: false,
  lastTs: 0,
  dimCache: new Map(),
  // TypedArrays for memory efficiency
  a: new Uint8Array(MAX_CAMERAS), // active
  v: new Uint8Array(MAX_CAMERAS), // visible
  d: new Uint8Array(MAX_CAMERAS), // dirty
  lr: new Float32Array(MAX_CAMERAS), // lastRender
  n: 0, // count
  // Flat arrays for better iteration
  c: Array(MAX_CAMERAS).fill(null), // cameras
  t: Array(MAX_CAMERAS).fill(null), // controls
  x: Array(MAX_CAMERAS).fill(null), // contexts
  m: Array(MAX_CAMERAS).fill(null), // metadata
  // Observers and metrics
  o: [], // observers
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
  disposeThreeJSManager();

  mgr.r = new WebGLRenderer({
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

  const r = mgr.r;
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
  mgr.s = new Scene();
  mgr.s.matrixAutoUpdate = false;
  mgr.s.autoUpdate = false;
  mgr.s.background = null;
  mgr.s.add(getFallbackCube());

  // Add lights
  const ambient = new AmbientLight(0xffffff, 0.5);
  ambient.matrixAutoUpdate = false;
  const direct = new DirectionalLight(0xffffff, 0.8);
  direct.position.set(5, 5, 2);
  direct.castShadow = false;
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();
  mgr.s.add(ambient);
  mgr.s.add(direct);

  // Reset state
  mgr.a.fill(0);
  mgr.v.fill(0);
  mgr.d.fill(0);
  mgr.lr.fill(0);
  mgr.n = 0;

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
        mgr.d.fill(1, 0, mgr.n);
        mgr.f.needsFullRender = true;
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
      fps: mgr.metrics.fps,
      rendered: mgr.metrics.rendered,
      skipped: mgr.metrics.skipped,
      total: mgr.metrics.total,
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
  if (mgr.n >= MAX_CAMERAS)
    throw new Error(`Max cameras (${MAX_CAMERAS}) reached`);

  const idx = mgr.n++;

  // Store refs
  mgr.c[idx] = camera;
  mgr.t[idx] = controls;
  mgr.x[idx] = context;
  mgr.m[idx] = metadata;

  // Set flags
  mgr.a[idx] = active ? 1 : 0;
  mgr.v[idx] = 1;
  mgr.d[idx] = 1;

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

        const wasVisible = mgr.v[idx] === 1;
        const isVisible = entry.isIntersecting;

        mgr.v[idx] = isVisible ? 1 : 0;

        if (!wasVisible && isVisible) {
          mgr.d[idx] = 1;
          if (!mgr.rendering) startRendering();
        }
      },
      {
        threshold: VISIBILITY_THRESHOLD,
        rootMargin: "100px",
      }
    );

    observer.observe(context.canvas);
    mgr.o.push({ idx, observer });
  }

  return idx;
}

/**
 * Set camera visibility
 */
export function setCameraVisible(idx, visible) {
  if (idx < 0 || idx >= mgr.n) return;

  const prev = mgr.a[idx] === 1;
  mgr.a[idx] = visible ? 1 : 0;

  if (prev !== visible) mgr.d[idx] = 1;

  const ctx = mgr.x[idx];
  if (ctx?.canvas) ctx.canvas.style.display = visible ? "block" : "none";

  if (visible && !mgr.rendering) startRendering();
}

/**
 * Get camera's active state
 */
export function isCameraActive(idx) {
  return idx >= 0 && idx < mgr.n && mgr.a[idx] === 1;
}

/**
 * Update controls with consistent deltaTime
 */
function updateControls(dt) {
  mgr.f.hasActiveDrag = false;
  let updated = false;

  for (let i = 0; i < mgr.n; i++) {
    if (mgr.a[i] !== 1 || mgr.v[i] !== 1) continue;

    const ctrl = mgr.t[i];
    if (!ctrl) continue;

    if (ctrl._dragging) mgr.f.hasActiveDrag = true;

    if (ctrl.update) {
      ctrl.update(dt);
      mgr.d[i] = 1;
      updated = true;
    }
  }

  return updated;
}

/**
 * Render single camera
 */
function renderCamera(idx, dt) {
  if (mgr.a[idx] !== 1 || mgr.v[idx] !== 1 || mgr.d[idx] !== 1) return false;

  const cam = mgr.c[idx];
  const ctx = mgr.x[idx];

  if (!cam || !ctx?.canvas?.isConnected) return false;

  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;

  if (w <= 8 || h <= 8) return false;

  try {
    const r = mgr.r;
    if (!r) return false;

    r.setSize(w, h, false);
    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.scissorTest = true;
    r.clear(true, true, false);

    cam.updateMatrixWorld(true);
    mgr.s.updateMatrixWorld(true);

    r.render(mgr.s, cam);

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

    mgr.lr[idx] = performance.now();
    mgr.d[idx] = 0;
    mgr.metrics.rendered++;
    mgr.metrics.total++;

    return true;
  } catch {
    return false;
  }
}

/**
 * Batch render all cameras
 */
function renderCameras(dt) {
  const r = mgr.r;
  if (!r) return 0;

  mgr.metrics.rendered = 0;

  try {
    r.autoClear = false;
    r.scissorTest = true;

    updateControls(dt);

    const count = mgr.n;
    let rendered = 0;

    for (let start = 0; start < count; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, count);
      for (let i = start; i < end; i++) {
        if (renderCamera(i, dt)) rendered++;
      }
    }

    r.scissorTest = false;
    mgr.f.needsFullRender = false;
    r.info.reset();

    return mgr.metrics.rendered;
  } catch {
    return 0;
  }
}

/**
 * Update FPS counter
 */
function updateFPS(now) {
  const m = mgr.metrics;
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
function renderLoop(ts) {
  if (!mgr.rendering) return;

  const timeInfo = TimeManager.update(ts, "renderer");
  const now = performance.now();

  // Get consistent dt and clamp
  let dt = timeInfo.deltaTime;
  dt = Math.max(MIN_DELTA_TIME, Math.min(dt, MAX_DELTA_TIME));

  // Handle idle state
  const idle = isIdle();
  if (idle) {
    const idleFrameSkip = 4; // ~15fps when idle
    if (mgr.metrics.frames % idleFrameSkip !== 0) {
      mgr.rafId = requestAnimationFrame(renderLoop);
      return;
    }
  }

  // Render and update stats
  renderCameras(dt);
  updateFPS(now);

  // Garbage collection
  const gcInterval = 5000;
  if (now - (mgr._lastGC || 0) > gcInterval) {
    collectGarbage();
    mgr._lastGC = now;
  }

  mgr.lastTs = ts;
  mgr.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Start rendering
 */
function startRendering() {
  if (mgr.rendering) return;

  mgr.rendering = true;
  mgr.lastTs = performance.now();
  mgr.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Pause rendering
 */
function pauseRendering() {
  if (!mgr.rendering) return;

  mgr.rendering = false;

  if (mgr.rafId) {
    cancelAnimationFrame(mgr.rafId);
    mgr.rafId = 0;
  }
}

/**
 * Resume rendering
 */
function resumeRendering() {
  if (mgr.rendering) return;

  mgr.d.fill(1, 0, mgr.n);
  mgr.rendering = true;
  mgr.lastTs = performance.now();
  mgr.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Garbage collection
 */
function collectGarbage(full = false) {
  if (mgr.r) {
    mgr.r.info.reset();
    mgr.r.renderLists.dispose();

    if (full) {
      const gl = mgr.r.getContext();
      const ext = gl?.getExtension("WEBGL_lose_context");
      if (ext) gl.flush();
    }
  }

  if (full) mgr.dimCache.clear();
}

/**
 * Dispose a camera
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= mgr.n) return;

  const ctrl = mgr.t[idx];
  if (ctrl?.dispose) ctrl.dispose();

  const cam = mgr.c[idx];
  if (cam?.userData?.disposables) {
    cam.userData.disposables.forEach((item) => {
      if (item?.dispose) item.dispose();
    });
    cam.userData.disposables = [];
  }

  mgr.c[idx] = null;
  mgr.t[idx] = null;
  mgr.x[idx] = null;
  mgr.m[idx] = null;

  mgr.a[idx] = 0;
  mgr.v[idx] = 0;
  mgr.d[idx] = 0;
  mgr.lr[idx] = 0;

  const obsIdx = mgr.o.findIndex((o) => o.idx === idx);
  if (obsIdx >= 0) {
    mgr.o[obsIdx].observer.disconnect();
    mgr.o.splice(obsIdx, 1);
  }
}

/**
 * Perform maintenance
 */
export function performCleanup(force = false) {
  const now = performance.now();
  if (!force && now - (mgr._lastCleanup || 0) < 30000) return;

  // Compact arrays
  let writeIdx = 0;
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.c[i] !== null) {
      if (i !== writeIdx) {
        mgr.c[writeIdx] = mgr.c[i];
        mgr.t[writeIdx] = mgr.t[i];
        mgr.x[writeIdx] = mgr.x[i];
        mgr.m[writeIdx] = mgr.m[i];
        mgr.a[writeIdx] = mgr.a[i];
        mgr.v[writeIdx] = mgr.v[i];
        mgr.d[writeIdx] = mgr.d[i];
        mgr.lr[writeIdx] = mgr.lr[i];

        const obsIdx = mgr.o.findIndex((o) => o.idx === i);
        if (obsIdx >= 0) mgr.o[obsIdx].idx = writeIdx;

        mgr.c[i] = null;
        mgr.t[i] = null;
        mgr.x[i] = null;
        mgr.m[i] = null;
      }
      writeIdx++;
    }
  }

  mgr.n = writeIdx;
  collectGarbage(true);
  mgr._lastCleanup = now;
}

/**
 * Complete ThreeJS cleanup
 */
export function disposeThreeJSManager() {
  pauseRendering();

  mgr.o.forEach(({ observer }) => observer.disconnect());
  mgr.o.length = 0;

  for (let i = 0; i < mgr.n; i++) {
    const ctrl = mgr.t[i];
    if (ctrl?.dispose) ctrl.dispose();
    mgr.t[i] = null;
    mgr.c[i] = null;
    mgr.x[i] = null;
    mgr.m[i] = null;
  }

  if (mgr.r) {
    const gl = mgr.r.getContext();
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();

    mgr.r.dispose();
    mgr.r.forceContextLoss();
    mgr.r = null;
  }

  if (mgr.s) {
    while (mgr.s.children.length > 0) {
      mgr.s.remove(mgr.s.children[0]);
    }

    mgr.s.traverse((obj) => {
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

    mgr.s = null;
  }

  collectGarbage(true);

  mgr.n = 0;
  mgr.dimCache.clear();
  mgr.a.fill(0);
  mgr.v.fill(0);
  mgr.d.fill(0);
  mgr.lr.fill(0);

  Object.assign(mgr.metrics, {
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
  return mgr.s;
}

/**
 * Get all registered cameras
 */
export function getAllCameras() {
  const cameras = [];
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.c[i]) {
      cameras.push({
        index: i,
        camera: mgr.c[i],
        metadata: mgr.m[i],
        active: mgr.a[i] === 1,
        visible: mgr.v[i] === 1,
      });
    }
  }
  return cameras;
}

/**
 * Force redraw of a specific camera
 */
export function forceRedraw(idx) {
  if (idx < 0 || idx >= mgr.n) return;
  mgr.d[idx] = 1;

  if (!mgr.rendering) startRendering();
}

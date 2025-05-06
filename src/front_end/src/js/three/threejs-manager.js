/**
 * Ultra-compact ThreeJS manager with zero overhead - Optimized Version
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
const BATCH_SIZE = 8; // Increased batch size for better throughput
const MIN_DELTA_TIME = 1 / 120;
const MAX_DELTA_TIME = 1 / 30;
const TEMP_VEC2 = new Vector2();
const GC_INTERVAL = 10000; // 10 seconds
const MAINTENANCE_INTERVAL = 30000; // 30 seconds
const IDLE_FRAME_SKIP = 4; // ~15fps when idle

// PRE-ALLOCATED SINGLETON - Using Uint32Array where applicable for better alignment
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
    // flags - reduced to bitflags for memory efficiency
    flags: 0,
    // Flag constants
    NEEDS_FULL_RENDER: 1,
    HAS_ACTIVE_DRAG: 2,
  },
  // Timestamps
  _lastGC: 0,
  _lastCleanup: 0,
};

/**
 * Initialize the ThreeJS manager
 */
export function initThreeJSManager() {
  disposeThreeJSManager();

  // Create renderer with optimized settings
  mgr.r = new WebGLRenderer({
    alpha: true,
    antialias: false, // Disable antialiasing for performance
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    precision: "lowp", // Use low precision for better performance
    depth: true,
    stencil: false,
    logarithmicDepthBuffer: false,
    premultipliedAlpha: false,
    failIfMajorPerformanceCaveat: true, // Fail if performance would be poor
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

  // Explicitly disable WebGL features we don't need
  const gl = r.getContext();
  if (gl) {
    gl.disable(gl.DITHER);
    // Disable multisample antialiasing if available
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.disable(gl.SAMPLE_COVERAGE);
  }

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
  mgr.f.flags = 0;
  mgr._lastGC = 0;
  mgr._lastCleanup = 0;

  // Use passive event listeners for better performance
  const visibilityHandler = () => {
    document.visibilityState === "hidden"
      ? pauseRendering()
      : resumeRendering();
  };

  document.addEventListener("visibilitychange", visibilityHandler, {
    passive: true,
  });

  // Debounced resize handler
  let resizeTimeout;
  const resizeHandler = () => {
    if (resizeTimeout) return;
    resizeTimeout = setTimeout(() => {
      mgr.d.fill(1, 0, mgr.n);
      mgr.f.flags |= mgr.f.NEEDS_FULL_RENDER;
      resizeTimeout = null;
    }, 100); // 100ms debounce
  };

  window.addEventListener("resize", resizeHandler, { passive: true });
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
 * Register camera with optimized intersection observer
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
  if (camera?.isPerspectiveCamera) {
    camera.matrixAutoUpdate = true;
    // Disable frustum culling if not needed
    camera.frustumCulled = false;
  }

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

    for (const k in settings) {
      if (k in controls) controls[k] = settings[k];
    }
  }

  // Setup canvas
  if (context?.canvas) {
    context.canvas.style.display = active ? "block" : "none";

    // Use optimized IntersectionObserver with weak references
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
 * Set camera visibility with optimized updates
 */
export function setCameraVisible(idx, visible) {
  if (idx < 0 || idx >= mgr.n) return;

  const prev = mgr.a[idx] === 1;
  const newState = visible ? 1 : 0;

  if (prev === !!newState) return; // No change needed

  mgr.a[idx] = newState;
  mgr.d[idx] = 1;

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
 * Update controls with consistent deltaTime - optimized control updates
 */
function updateControls(dt) {
  mgr.f.flags &= ~mgr.f.HAS_ACTIVE_DRAG; // Clear flag
  let updated = false;

  // Fast path: if no controls need updating, skip loop
  let hasActiveControls = false;
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.a[i] === 1 && mgr.v[i] === 1 && mgr.t[i]) {
      hasActiveControls = true;
      break;
    }
  }

  if (!hasActiveControls) return false;

  // Main loop with early termination
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.a[i] !== 1 || mgr.v[i] !== 1) continue;

    const ctrl = mgr.t[i];
    if (!ctrl) continue;

    if (ctrl._dragging) mgr.f.flags |= mgr.f.HAS_ACTIVE_DRAG;

    if (ctrl.update) {
      ctrl.update(dt);
      mgr.d[i] = 1;
      updated = true;
    }
  }

  return updated;
}

/**
 * Render single camera with optimized path
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

    // Only resize if dimensions changed
    const key = `${w},${h}`;
    if (!mgr.dimCache.has(key)) {
      r.setSize(w, h, false);
      mgr.dimCache.set(key, true);
    }

    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.scissorTest = true;
    r.clear(true, true, false);

    // Only update matrices when needed
    cam.updateMatrixWorld(true);

    // Use faster render path
    r.render(mgr.s, cam);

    // Optimized image drawing
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(r.domElement, 0, 0, w, h);

    mgr.lr[idx] = performance.now();
    mgr.d[idx] = 0;
    mgr.metrics.rendered++;
    mgr.metrics.total++;

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Batch render all cameras - optimized batching
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

    // Quick check if any cameras need rendering
    let needsRendering = false;
    for (let i = 0; i < count; i++) {
      if (mgr.a[i] === 1 && mgr.v[i] === 1 && mgr.d[i] === 1) {
        needsRendering = true;
        break;
      }
    }

    if (!needsRendering) {
      mgr.metrics.skipped++;
      return 0;
    }

    // Optimized batching
    for (let start = 0; start < count; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, count);
      for (let i = start; i < end; i++) {
        if (renderCamera(i, dt)) rendered++;
      }
    }

    r.scissorTest = false;
    mgr.f.flags &= ~mgr.f.NEEDS_FULL_RENDER; // Clear flag
    r.info.reset();

    return mgr.metrics.rendered;
  } catch (e) {
    return 0;
  }
}

/**
 * Update FPS counter - optimized update
 */
function updateFPS(now) {
  const m = mgr.metrics;
  m.frames++;

  // Only update once per second
  if (now - m.lastFpsTime >= 1000) {
    m.fps = m.frames;
    m.frames = 0;
    m.lastFpsTime = now;
  }
}

/**
 * Main render loop - optimized with frame skipping and priorities
 */
function renderLoop(ts) {
  if (!mgr.rendering) return;

  const now = performance.now();
  const timeInfo = TimeManager.update(ts, "renderer");

  // Get consistent dt and clamp
  let dt = timeInfo.deltaTime;
  dt = Math.max(MIN_DELTA_TIME, Math.min(dt, MAX_DELTA_TIME));

  // Frame skipping for idle state
  const idle = isIdle();
  if (idle && mgr.metrics.frames % IDLE_FRAME_SKIP !== 0) {
    // Skip rendering but keep the loop running
    mgr.metrics.skipped++;
    mgr.rafId = requestAnimationFrame(renderLoop);
    return;
  }

  // Skip if no interaction for a while and nothing is dirty
  let hasDirty = false;
  if (!mgr.f.flags & mgr.f.HAS_ACTIVE_DRAG) {
    for (let i = 0; i < mgr.n; i++) {
      if (mgr.d[i] === 1) {
        hasDirty = true;
        break;
      }
    }

    if (!hasDirty && idle && now - mgr.lastTs > 500) {
      // Nothing changed, skip frame
      mgr.metrics.skipped++;
      mgr.rafId = requestAnimationFrame(renderLoop);
      return;
    }
  }

  // Render and update stats
  renderCameras(dt);
  updateFPS(now);

  // Garbage collection and maintenance
  if (now - mgr._lastGC > GC_INTERVAL) {
    collectGarbage();
    mgr._lastGC = now;
  }

  if (now - mgr._lastCleanup > MAINTENANCE_INTERVAL) {
    performCleanup();
    mgr._lastCleanup = now;
  }

  mgr.lastTs = ts;
  mgr.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Start rendering with optimized initialization
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
 * Resume rendering with optimized state reset
 */
function resumeRendering() {
  if (mgr.rendering) return;

  // Only mark active cameras as dirty
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.a[i] === 1 && mgr.v[i] === 1) {
      mgr.d[i] = 1;
    }
  }

  mgr.rendering = true;
  mgr.lastTs = performance.now();
  mgr.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Optimized garbage collection
 */
function collectGarbage(full = false) {
  if (mgr.r) {
    mgr.r.info.reset();
    mgr.r.renderLists.dispose();

    if (full) {
      const gl = mgr.r.getContext();
      // More aggressive GL context cleanup
      if (gl) {
        gl.flush();
        const ext = gl.getExtension("WEBGL_lose_context");
        if (ext && full) ext.loseContext();
      }
    }
  }

  if (full) {
    mgr.dimCache.clear();

    // Force JS garbage collection hint (not guaranteed but can help)
    if (window.gc) window.gc();
  }
}

/**
 * Dispose a camera with optimized cleanup
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= mgr.n) return;

  const ctrl = mgr.t[idx];
  if (ctrl?.dispose) ctrl.dispose();

  const cam = mgr.c[idx];
  if (cam?.userData?.disposables) {
    for (let i = 0; i < cam.userData.disposables.length; i++) {
      const item = cam.userData.disposables[i];
      if (item?.dispose) item.dispose();
    }
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
 * Perform maintenance with optimized compaction algorithm
 */
export function performCleanup(force = false) {
  const now = performance.now();
  if (!force && now - mgr._lastCleanup < MAINTENANCE_INTERVAL) return;

  // Fast path: check if compaction is needed
  let hasNull = false;
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.c[i] === null) {
      hasNull = true;
      break;
    }
  }

  if (!hasNull && !force) {
    mgr._lastCleanup = now;
    return;
  }

  // Compact arrays
  let writeIdx = 0;
  for (let i = 0; i < mgr.n; i++) {
    if (mgr.c[i] !== null) {
      if (i !== writeIdx) {
        // Move data
        mgr.c[writeIdx] = mgr.c[i];
        mgr.t[writeIdx] = mgr.t[i];
        mgr.x[writeIdx] = mgr.x[i];
        mgr.m[writeIdx] = mgr.m[i];
        mgr.a[writeIdx] = mgr.a[i];
        mgr.v[writeIdx] = mgr.v[i];
        mgr.d[writeIdx] = mgr.d[i];
        mgr.lr[writeIdx] = mgr.lr[i];

        // Update observer references
        const obsIdx = mgr.o.findIndex((o) => o.idx === i);
        if (obsIdx >= 0) mgr.o[obsIdx].idx = writeIdx;

        // Clear old slots
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
 * Complete ThreeJS cleanup with optimized resource disposal
 */
export function disposeThreeJSManager() {
  pauseRendering();

  // Disconnect observers
  for (let i = 0; i < mgr.o.length; i++) {
    mgr.o[i].observer.disconnect();
  }
  mgr.o.length = 0;

  // Dispose controls
  for (let i = 0; i < mgr.n; i++) {
    const ctrl = mgr.t[i];
    if (ctrl?.dispose) ctrl.dispose();
    mgr.t[i] = null;
    mgr.c[i] = null;
    mgr.x[i] = null;
    mgr.m[i] = null;
  }

  // Dispose renderer
  if (mgr.r) {
    const gl = mgr.r.getContext();
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();

    mgr.r.dispose();
    mgr.r.forceContextLoss();
    mgr.r = null;
  }

  // Dispose scene
  if (mgr.s) {
    const disposeQueue = [...mgr.s.children];

    // Remove all children first to prevent traversal overhead
    while (mgr.s.children.length > 0) {
      mgr.s.remove(mgr.s.children[0]);
    }

    // Process dispose queue efficiently
    while (disposeQueue.length > 0) {
      const obj = disposeQueue.pop();

      // Add children to queue
      if (obj.children && obj.children.length) {
        disposeQueue.push(...obj.children);
      }

      // Dispose geometry
      if (obj.geometry?.dispose) {
        obj.geometry.dispose();
        obj.geometry = null;
      }

      // Dispose material(s)
      if (obj.material) {
        const disposeMaterial = (mat) => {
          if (!mat) return;

          if (Array.isArray(mat)) {
            for (let i = 0; i < mat.length; i++) {
              disposeMaterial(mat[i]);
            }
            return;
          }

          // Dispose textures
          for (const prop in mat) {
            const val = mat[prop];
            if (val?.isTexture) {
              val.dispose();
              mat[prop] = null;
            }
          }

          if (mat.dispose) mat.dispose();
        };

        disposeMaterial(obj.material);
        obj.material = null;
      }

      // Dispose user data
      if (obj.userData?.disposables) {
        for (let i = 0; i < obj.userData.disposables.length; i++) {
          const item = obj.userData.disposables[i];
          if (item?.dispose) item.dispose();
        }
        obj.userData.disposables = [];
      }
    }

    mgr.s = null;
  }

  collectGarbage(true);

  // Reset everything
  mgr.n = 0;
  mgr.dimCache.clear();
  mgr.a.fill(0);
  mgr.v.fill(0);
  mgr.d.fill(0);
  mgr.lr.fill(0);
  mgr.f.flags = 0;

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
 * Get all registered cameras with optimized object creation
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

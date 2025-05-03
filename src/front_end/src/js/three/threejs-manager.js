/**
 * @fileoverview Ultra-optimized ThreeJS manager with zero overhead.
 * Extreme performance optimizations for high-efficiency 3D rendering.
 */

import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Scene,
  Vector2,
  WebGLRenderer,
  SphereGeometry,
  MeshStandardMaterial,
  Mesh,
} from "../extern/three/three.module.min.js";
import { isIdle } from "../user-interaction.js";
import { getFallbackCube } from "./model-manager.js";
import { C } from "../constants/constants.js";

// OPTIMIZED CONSTANTS - Critical path tuning
const MAX_CAMERAS = 32;
const RENDER_THROTTLE = 3; // ms between renders when active
const IDLE_THROTTLE = 67; // ~15fps max when idle
const VISIBILITY_THRESHOLD = 0.01; // minimal visibility to trigger render
const BATCH_SIZE = 4; // Process cameras in batches for better CPU cache usage

// PRE-ALLOCATED OBJECTS - Avoid allocations in render loop
const TEMP_VEC2 = new Vector2(); // Reused for calculations

// Private singleton with minimal memory footprint
const manager = {
  renderer: null,
  scene: null,
  clock: new Clock(),
  rafId: 0,
  rendering: false,
  lastTime: 0,
  dimCache: new Map(),
  // TypedArrays for maximum memory efficiency and cache locality
  active: new Uint8Array(MAX_CAMERAS),
  visible: new Uint8Array(MAX_CAMERAS),
  dirty: new Uint8Array(MAX_CAMERAS),
  lastRender: new Float32Array(MAX_CAMERAS),
  count: 0,
  // Objects stored in flat arrays for better iteration performance
  cameras: Array(MAX_CAMERAS).fill(null),
  controls: Array(MAX_CAMERAS).fill(null),
  contexts: Array(MAX_CAMERAS).fill(null),
  // Optimized observers
  observers: [],
  // Performance metrics
  metrics: {
    frames: 0,
    lastFpsTime: 0,
    fps: 0,
    skipped: 0,
    rendered: 0,
    total: 0,
  },
  // Flags for batched operations
  flags: {
    needsFullRender: false,
    hasActiveDrag: false,
  },
};

/**
 * Initialize the ThreeJS manager with extreme performance optimizations
 * @param {Object} config - Optional configuration overrides
 * @returns {Object} - Minimal stats API
 */
export function initThreeJSManager() {
  disposeThreeJSManager(); // Ensure clean state
  manager.renderer = new WebGLRenderer({
    alpha: true,
    antialias: false, // Disable for performance
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    precision: "lowp", // Use low precision for max performance
    depth: true,
    stencil: false, // Disable unused buffers
    logarithmicDepthBuffer: false, // Disable for performance
    premultipliedAlpha: false, // optional
  });

  manager.renderer.setClearColor(0x000000, 0);
  manager.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // Cap pixel ratio
  manager.renderer.shadowMap.enabled = false;
  manager.renderer.shadowMap.autoUpdate = false;
  manager.renderer.physicallyCorrectLights = false;
  manager.renderer.toneMappingExposure = 1.0;
  manager.renderer.outputEncoding = 3000; // sRGBEncoding
  manager.renderer.info.autoReset = false; // Manual control of stats reset
  manager.renderer.autoClear = false; // Manual clear control

  // Optimize scene
  manager.scene = new Scene();
  manager.scene.matrixAutoUpdate = false; // Objects must update matrices manually
  manager.scene.autoUpdate = false; // Prevent auto traversal for matrix updates
  manager.scene.background = null;

  manager.scene.add(getFallbackCube());
  console.log("Scene bg Color: ", manager.scene.background);

  setupOptimizedLights();

  // Zero out camera state
  manager.active.fill(0);
  manager.visible.fill(0);
  manager.dirty.fill(0);
  manager.lastRender.fill(0);
  manager.count = 0;

  // Event handlers with minimal overhead
  setupEventHandlers();

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
 * Add ultra-optimized lighting
 */
function setupOptimizedLights() {
  const scene = manager.scene;

  // Single ambient light
  const ambient = new AmbientLight(0xffffff, 0.5);
  ambient.matrixAutoUpdate = false;

  // Main directional light
  const directional = new DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 5, 2);
  directional.castShadow = false;
  directional.matrixAutoUpdate = false;
  directional.updateMatrix(); // Update once

  scene.add(ambient);
  scene.add(directional);
}

/**
 * Set up minimal event handlers with maximal efficiency
 */
function setupEventHandlers() {
  // Pause rendering when not visible
  const visChange = () => {
    document.hidden ? pauseRendering() : resumeRendering();
  };
  document.addEventListener("visibilitychange", visChange, { passive: true });

  // Efficient resize handling
  let resizing = false;
  const handleResize = () => {
    if (resizing) return;
    resizing = true;
    requestAnimationFrame(() => {
      manager.dirty.fill(1, 0, manager.count);
      manager.flags.needsFullRender = true;
      resizing = false;
    });
  };
  window.addEventListener("resize", handleResize, { passive: true });

  // Cleanup
  window.addEventListener("beforeunload", disposeThreeJSManager);
}

/**
 * Register camera with minimal overhead
 * @param {Camera} camera - Three.js camera
 * @param {Object} controls - Camera controls (optional)
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {boolean} active - Whether initially active
 * @returns {number} - Camera index
 */
export function registerCamera(camera, controls, context, active = true) {
  if (manager.count >= MAX_CAMERAS) {
    throw new Error(`Max cameras (${MAX_CAMERAS}) reached`);
  }

  const idx = manager.count++;

  // Store references
  manager.cameras[idx] = camera;
  manager.controls[idx] = controls;
  manager.contexts[idx] = context;

  // Set state flags (typed arrays for performance)
  manager.active[idx] = active ? 1 : 0;
  manager.visible[idx] = 1; // Assume visible initially
  manager.dirty[idx] = 1; // Needs initial render

  // Apply optimizations
  optimizeCamera(camera);
  optimizeControls(controls);
  setupCanvas(context, idx, active);

  // Start rendering if first camera
  if (manager.count === 1) {
    startRendering();
  }

  return idx;
}

/**
 * Apply camera-specific optimizations
 * @param {Camera} camera - Camera to optimize
 */
function optimizeCamera(camera) {
  if (camera?.isPerspectiveCamera) {
    camera.matrixAutoUpdate = true; // Usually required for controls
  }
}

/**
 * Apply control-specific optimizations
 * @param {Object} controls - Controls to optimize
 */
function optimizeControls(controls) {
  if (!controls) return;

  // Apply damping settings
  if ("enableDamping" in controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.1; // Optimized value
  }

  // Apply performance-oriented settings
  applyControlSettings(controls);
}

/**
 * Apply predefined settings to controls
 * @param {Object} controls - Controls object
 */
function applyControlSettings(controls) {
  const settings = {
    rotateSpeed: 0.65,
    zoomSpeed: 0.65,
    enableKeys: false,
    keyPanSpeed: 0,
  };

  // Apply each setting if property exists
  Object.entries(settings).forEach(([key, value]) => {
    if (key in controls) {
      controls[key] = value;
    }
  });
}

/**
 * Set up canvas and visibility observer
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {number} idx - Camera index
 * @param {boolean} active - Whether active
 */
function setupCanvas(context, idx, active) {
  if (!context?.canvas) return;

  context.canvas.style.display = active ? "block" : "none";
  setupObserver(idx, context.canvas);
}

/**
 * Ultra-efficient IntersectionObserver setup
 * @param {number} idx - Camera index
 * @param {HTMLCanvasElement} canvas - Canvas to observe
 */
function setupObserver(idx, canvas) {
  // Reuse a single observer callback function
  const observer = new IntersectionObserver(
    (entries) => {
      // Always just one entry for this observer
      const entry = entries[0];
      if (!entry) return;

      // Direct typed array access for maximum performance
      const wasVisible = manager.visible[idx] === 1;
      const isVisible = entry.isIntersecting;

      // Set visibility bit
      manager.visible[idx] = isVisible ? 1 : 0;

      // Mark dirty if becoming visible
      if (!wasVisible && isVisible) {
        manager.dirty[idx] = 1;
      }
    },
    {
      threshold: VISIBILITY_THRESHOLD,
      rootMargin: "100px", // Preload margin
    }
  );

  observer.observe(canvas);
  manager.observers.push({ idx, observer });
}

/**
 * Set camera visibility with minimal overhead
 * @param {number} idx - Camera index
 * @param {boolean} visible - Whether visible
 */
export function setCameraVisible(idx, visible) {
  if (idx < 0 || idx >= manager.count) return;

  // Get previous state and set new state with typed array access
  const prev = manager.active[idx] === 1;
  manager.active[idx] = visible ? 1 : 0;

  // Only mark dirty if changed
  if (prev !== visible) {
    manager.dirty[idx] = 1;
  }

  // Direct canvas style manipulation
  const ctx = manager.contexts[idx];
  if (ctx?.canvas) {
    ctx.canvas.style.display = visible ? "block" : "none";
  }
}

/**
 * Update controls with maximum efficiency
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {boolean} - Whether any updates occurred
 */
function updateControls(deltaTime) {
  const isUserActive = !isIdle();
  let updated = false;
  manager.flags.hasActiveDrag = false;

  // First pass: check for active drags (highest priority)
  for (let i = 0; i < manager.count; i++) {
    if (manager.active[i] !== 1 || manager.visible[i] !== 1) continue;

    const control = manager.controls[i];
    if (control?._dragging) {
      manager.flags.hasActiveDrag = true;
      break;
    }
  }

  // Fast path for idle state when no drags happening
  if (!isUserActive && !manager.flags.hasActiveDrag) {
    // Check if too soon for idle update
    const now = performance.now();
    if (now - manager.lastTime < IDLE_THROTTLE) {
      return false;
    }
  }

  // Main update loop
  for (let i = 0; i < manager.count; i++) {
    if (manager.active[i] !== 1 || manager.visible[i] !== 1) continue;

    const control = manager.controls[i];
    if (!control) continue;

    // Priority to dragging controls
    if (control._dragging || (!manager.flags.hasActiveDrag && control.update)) {
      control.update(deltaTime);
      manager.dirty[i] = 1;
      updated = true;
    }
  }

  return updated;
}

/**
 * Hyper-optimized camera rendering
 * @param {number} idx - Camera index
 * @param {number} now - Current timestamp
 * @returns {boolean} - Whether rendered
 */
function renderCamera(idx, now) {
  // Print detailed debug for this specific camera
  console.log(
    `Rendering camera ${idx}: active=${manager.active[idx]}, visible=${manager.visible[idx]}, dirty=${manager.dirty[idx]}`
  );

  // Early bail conditions using typed arrays
  if (
    manager.active[idx] !== 1 ||
    manager.visible[idx] !== 1 ||
    manager.dirty[idx] !== 1
  ) {
    console.log(`Skipping camera ${idx} - not active/visible/dirty`);
    return false;
  }

  // More detailed validation
  const camera = manager.cameras[idx];
  const ctx = manager.contexts[idx];

  if (!camera) {
    console.error(`Camera ${idx} is null`);
    return false;
  }

  if (!ctx?.canvas) {
    console.error(`Canvas context ${idx} is null`);
    return false;
  }

  if (!ctx.canvas.isConnected) {
    console.error(`Canvas ${idx} is not connected to DOM`);
    return false;
  }

  // Get dimensions and validate
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;

  console.log(`Canvas dimensions: ${width}x${height}`);

  if (width <= 8 || height <= 8) {
    console.error(`Canvas dimensions too small: ${width}x${height}`);
    return false;
  }

  // CRITICAL RENDER PATH WITH ENHANCED ERROR HANDLING
  try {
    const r = manager.renderer;
    if (!r) {
      console.error("Renderer is null");
      return false;
    }

    // Reset renderer state
    manager.renderer.setSize(width, height, false);
    manager.renderer.setViewport(0, 0, width, height);
    manager.renderer.setScissor(0, 0, width, height);
    manager.renderer.scissorTest = true;

    // Force clear the scene with bright color to verify renderer is working
    manager.renderer.clear(true, true, false);

    // Check scene
    // if (!manager.scene) {
    //   console.error("Scene is null");
    //   return false;
    // }

    // if (manager.scene.children.length === 0) {
    //   console.warn("Scene has no children");
    // } else {
    //   console.log(`Scene has ${manager.scene.children.length} children`);
    // }

    // Debug camera position
    console.log(
      `Camera position: ${camera.position.x}, ${camera.position.y}, ${camera.position.z}`
    );

    // Force update matrices
    camera.updateMatrixWorld(true);
    manager.scene.updateMatrixWorld(true);

    // Render
    manager.renderer.render(manager.scene, camera);
    console.log("Render call completed");

    // Draw to 2D canvas
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(
      manager.renderer.domElement,
      0,
      0,
      manager.renderer.domElement.width,
      manager.renderer.domElement.height,
      0,
      0,
      width,
      height
    );

    // Update state
    manager.lastRender[idx] = now;
    manager.dirty[idx] = 0;
    manager.metrics.rendered++;
    manager.metrics.total++;

    console.log(`Successfully rendered camera ${idx}`);
    return true;
  } catch (error) {
    console.error(`Render error for camera ${idx}:`, error);
    return false;
  }
}

/**
 * Ultra-efficient batch rendering of all cameras
 * @param {number} now - Current timestamp
 * @returns {number} - Cameras rendered
 */
function renderCameras(now) {
  const r = manager.renderer;
  if (!r) return 0;

  // Reset render count
  manager.metrics.rendered = 0;

  try {
    // Set up renderer once
    manager.renderer.autoClear = false;
    manager.renderer.scissorTest = true;

    // Get delta time for controls
    const delta = manager.clock.getDelta();

    // Update controls - optimized batch
    updateControls(delta);

    // Process cameras in batches for better CPU cache usage
    const count = manager.count;
    for (let start = 0; start < count; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, count);

      // Process batch
      for (let i = start; i < end; i++) {
        renderCamera(i, now);
      }
    }

    // Reset renderer state
    manager.renderer.scissorTest = false;

    // Reset flags
    manager.flags.needsFullRender = false;

    // Reset WebGL stats
    manager.renderer.info.reset();

    return manager.metrics.rendered;
  } catch (error) {
    console.error("Batch render error:", error);
    return 0;
  }
}

/**
 * Update FPS with minimal overhead
 * @param {number} now - Current timestamp
 */
function updateFPS(now) {
  const m = manager.metrics;
  m.frames++;

  // Update once per second
  if (now - m.lastFpsTime >= 1000) {
    m.fps = m.frames;
    m.frames = 0;
    m.lastFpsTime = now;
  }
}

/**
 * Ultra-optimized render loop
 * @param {number} now - Current timestamp
 */
function renderLoop(now) {
  // Break loop if stopped
  if (!manager.rendering) return;

  // Throttle when idle
  if (isIdle()) {
    const elapsed = now - manager.lastTime;
    if (elapsed < IDLE_THROTTLE) {
      manager.metrics.skipped++;
      manager.rafId = requestAnimationFrame(renderLoop);
      return;
    }
  }

  // Update timestamp
  manager.lastTime = now;

  // Render and update stats
  renderCameras(now);
  updateFPS(now);

  // Continue loop
  manager.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Start rendering
 */
function startRendering() {
  if (manager.rendering) return;

  manager.rendering = true;
  manager.clock.start();
  manager.lastTime = performance.now();
  manager.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Pause rendering
 */
function pauseRendering() {
  if (!manager.rendering) return;

  manager.rendering = false;
  manager.clock.stop();

  if (manager.rafId) {
    cancelAnimationFrame(manager.rafId);
    manager.rafId = 0;
  }
}

/**
 * Resume rendering
 */
function resumeRendering() {
  if (manager.rendering) return;

  // Mark all as dirty
  manager.dirty.fill(1, 0, manager.count);

  // Restart
  manager.rendering = true;
  manager.clock.start();
  manager.lastTime = performance.now();
  manager.rafId = requestAnimationFrame(renderLoop);
}

/**
 * Complete ThreeJS cleanup with zero memory leaks
 */
export function disposeThreeJSManager() {
  // Stop loop
  pauseRendering();

  // Disconnect observers
  for (const { observer } of manager.observers) {
    observer.disconnect();
  }
  manager.observers.length = 0;

  // Dispose controls
  for (let i = 0; i < manager.count; i++) {
    const control = manager.controls[i];
    if (control?.dispose) control.dispose();
    manager.controls[i] = null;
    manager.cameras[i] = null;
    manager.contexts[i] = null;
  }

  // Force WebGL context loss
  if (manager.renderer) {
    const gl = manager.renderer.getContext();
    if (gl) {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }

    manager.renderer.dispose();
    manager.renderer.forceContextLoss();
    manager.renderer = null;
  }

  // Clear scene
  if (manager.scene) {
    while (manager.scene.children.length > 0) {
      const object = manager.scene.children[0];
      manager.scene.remove(object);
    }
    manager.scene = null;
  }

  // Reset state
  manager.count = 0;
  manager.dimCache.clear();
  manager.active.fill(0);
  manager.visible.fill(0);
  manager.dirty.fill(0);
  manager.lastRender.fill(0);

  // Reset metrics
  Object.assign(manager.metrics, {
    frames: 0,
    lastFpsTime: 0,
    fps: 0,
    skipped: 0,
    rendered: 0,
    total: 0,
  });
}

export function getScene() {
  return manager.scene;
}

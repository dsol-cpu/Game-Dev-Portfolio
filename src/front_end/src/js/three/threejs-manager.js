import {
  AmbientLight,
  DirectionalLight,
  Scene,
  WebGLRenderer,
  Frustum,
  Matrix4,
  Vector3,
  Box3,
  SRGBColorSpace
} from "../extern/three/three.module.min.js";
import { getFallbackCube } from "./model-manager.js";

// Core configuration - use constants for better minification
const MAX_CAMERAS = 3;
const VISIBILITY_THRESHOLD = 0.01;
const FRUSTUM_OBJECT_THRESHOLD = 10;
const RENDER_INTERVAL_MS = 16; // ~60fps cap
const RESIZE_DEBOUNCE_MS = 100;
const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.5);
const RESET_INFO_INTERVAL = 100; // Reset renderer info every 100 frames

// Pre-allocate reusable objects to avoid garbage collection
const _frustum = new Frustum();
const _projScreenMatrix = new Matrix4();
const _box3 = new Box3();
const _v3 = new Vector3();
const _observerOptions = {
  threshold: [0, VISIBILITY_THRESHOLD, 0.5],
  rootMargin: "100px",
};

// Renderer options pre-defined to avoid object creation
const RENDERER_OPTIONS = {
  alpha: true,
  antialias: false,
  powerPreference: "high-performance",
  precision: "highp",
  stencil: false,
  depth: true,
  premultipliedAlpha: false,
  failIfMajorPerformanceCaveat: true,
  preserveDrawingBuffer: false,
};

// Using let for variables that change, const for true constants
let renderer, scene;
let isActive = false;
let cameras = new Array(MAX_CAMERAS).fill(null);
let contexts = new Array(MAX_CAMERAS).fill(null);
let observers = new Array(MAX_CAMERAS).fill(null);
let count = 0;
let active = {
  camera: null,
  canvas: null,
  ctx: null, // Pre-store context to avoid getContext calls
  width: -1,
  height: -1,
  index: -1,
};
let rendered = 0;
let rafId = null;
let lastRenderTime = 0;
let resizeTimeout;

/**
 * Initialize the ThreeJS manager
 */
export function initThreeJSManager() {
  // Try to create WebGL2 renderer first
  try {
    const canvas = document.createElement('canvas');
    const gl2Context = canvas.getContext('webgl2', {powerPreference: 'high-performance'});

    if (gl2Context) {
      // WebGL 2.0 is available
      renderer = new WebGLRenderer({
        ...RENDERER_OPTIONS,
        canvas: canvas,
        context: gl2Context
      });
      console.log("Using WebGL 2.0 renderer");
    } else {
      // Fall back to WebGL 1.0
      renderer = new WebGLRenderer(RENDERER_OPTIONS);
      console.log("Falling back to WebGL 1.0 renderer");
    }
  } catch (e) {
    // Fallback to standard renderer
    renderer = new WebGLRenderer(RENDERER_OPTIONS);
    console.warn("Error creating WebGL2 context, using fallback", e);
  }

  // Enable hardware acceleration features
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio || 1); // Use full device resolution
  renderer.shadowMap.enabled = false; // Enable if needed for shadows
  renderer.autoClear = true;
  renderer.info.autoReset = false;

  // Enable some optimizations
  renderer.sortObjects = true; // Sort objects by material for fewer state changes
  renderer.physicallyCorrectLights = false; // Disable for performance

  // Try to enable some hardware features if available
  if (renderer.capabilities.isWebGL2) {
    renderer.outputColorSpace = SRGBColorSpace; // Better color rendering
  }

  renderer.clear();

  // Rest of your initialization code...
  renderer.domElement.addEventListener(
    "webglcontextlost",
    handleContextLost,
    false
  );
  renderer.domElement.addEventListener(
    "webglcontextrestored",
    handleContextRestored,
    false
  );

  // Create scene with optimization flags
  scene = new Scene();
  scene.matrixAutoUpdate = false;
  scene.autoUpdate = false;
  scene.add(getFallbackCube());

  // Add minimal lighting setup
  const ambient = new AmbientLight(0xffffff, 0.6);
  ambient.matrixAutoUpdate = false;

  const direct = new DirectionalLight(0xffffff, 0.9);
  direct.position.set(5, 5, 2);
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();

  scene.add(ambient);
  scene.add(direct);

  // Batch event listeners
  setupEventListeners();

  isActive = true;
}

/**
 * Setup core event listeners
 */
function setupEventListeners() {
  // Visibility change detection
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    passive: true,
  });

  // Efficient resize handling
  window.addEventListener("resize", handleResize, { passive: true });

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanupResources, { passive: true });
}

/**
 * Handle context lost event
 */
function handleContextLost(event) {
  event.preventDefault();
  isActive = false;
  cancelAnimationFrame(rafId);
  rafId = null;
}

/**
 * Handle context restored event
 */
function handleContextRestored() {
  isActive = true;
  if (!rafId && active.camera) {
    startAutoRender();
  }
}

/**
 * Handle document visibility change
 */
function handleVisibilityChange() {
  isActive = document.visibilityState !== "hidden";
  if (!isActive) {
    cancelAnimationFrame(rafId);
    rafId = null;
  } else if (!rafId && active.camera) {
    startAutoRender();
  }
}

/**
 * Handle resize event with debounce
 */
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateRendererSize, RESIZE_DEBOUNCE_MS);
}

/**
 * Update renderer size based on active canvas
 */
function updateRendererSize() {
  if (!renderer || !active.canvas) return;

  const width = active.canvas.width;
  const height = active.canvas.height;

  // Skip if no change
  if (active.width === width && active.height === height) return;

  active.width = width;
  active.height = height;
  renderer.setSize(width, height, false);
}

/**
 * Register a camera with the manager
 * @returns {number} Camera index
 */
export function registerCamera(camera, context) {
  if (count >= MAX_CAMERAS) {
    throw new Error(`Max cameras (${MAX_CAMERAS}) reached`);
  }

  const idx = count++;

  // Store camera data
  cameras[idx] = camera;
  contexts[idx] = context;

  // Set first camera as default active
  if (count === 1 && context?.canvas) {
    active.index = idx;
    active.camera = camera;
    active.canvas = context.canvas;
    active.ctx = context.canvas.getContext("2d", { alpha: true });
    active.width = context.canvas.width;
    active.height = context.canvas.height;

    // Set initial renderer size
    if (renderer) {
      renderer.setSize(active.width, active.height, false);
    }
  }

  // Setup observer for visibility
  setupCanvasObserver(context, idx);

  return idx;
}

/**
 * Setup observer for canvas visibility
 */
function setupCanvasObserver(context, idx) {
  if (!context?.canvas) return;

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const isVisible =
      entry.isIntersecting && entry.intersectionRatio > VISIBILITY_THRESHOLD;

    // Skip unnecessary updates if state hasn't changed
    if (observers[idx]?.isVisible === isVisible) return;

    // Update visibility state
    if (!observers[idx]) observers[idx] = {};
    observers[idx].isVisible = isVisible;

    handleCameraVisibilityChange(idx, isVisible);
  }, _observerOptions);

  observer.observe(context.canvas);
  observers[idx] = { observer, isVisible: false };
}

/**
 * Handle camera visibility change
 */
function handleCameraVisibilityChange(idx, isVisible) {
  if (isVisible) {
    // Only update if actually changing cameras
    if (active.index !== idx) {
      switchActiveCamera(idx);
    }
  } else if (active.index === idx) {
    // Find another visible camera
    findNextVisibleCamera(idx);
  }
}

/**
 * Switch to a specific camera
 */
function switchActiveCamera(idx) {
  if (idx < 0 || idx >= count || !cameras[idx] || !contexts[idx]?.canvas)
    return;

  active.index = idx;
  active.camera = cameras[idx];
  active.canvas = contexts[idx].canvas;
  active.ctx = contexts[idx].canvas.getContext("2d", { alpha: true });
  active.width = active.canvas.width;
  active.height = active.canvas.height;

  // Update renderer size
  if (renderer) {
    renderer.setSize(active.width, active.height, false);
  }

  isActive = true;

  // Start rendering if not already
  if (!rafId) {
    startAutoRender();
  }
}

/**
 * Find next visible camera
 */
function findNextVisibleCamera(excludeIdx) {
  let foundVisible = false;

  for (let i = 0; i < count; i++) {
    if (i !== excludeIdx && cameras[i] && observers[i]?.isVisible) {
      switchActiveCamera(i);
      foundVisible = true;
      break;
    }
  }

  if (!foundVisible) {
    resetActiveCamera();
  }
}

/**
 * Reset active camera state
 */
function resetActiveCamera() {
  active.index = -1;
  active.camera = null;
  active.canvas = null;
  active.ctx = null;
  active.width = -1;
  active.height = -1;

  // Stop rendering if active
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Dispose a camera and its resources
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= count || !cameras[idx]) return;

  // Dispose camera resources
  const cam = cameras[idx];
  if (cam?.userData?.disposables) {
    const disposables = cam.userData.disposables;
    for (let i = 0, len = disposables.length; i < len; i++) {
      const item = disposables[i];
      item?.dispose?.();
    }
    cam.userData.disposables = null;
  }

  // Disconnect observer
  observers[idx]?.observer?.disconnect();

  // Clear references
  cameras[idx] = null;
  contexts[idx] = null;
  observers[idx] = null;

  // Update active camera if this was the active one
  if (active.index === idx) {
    resetActiveCamera();
    findNextVisibleCamera(idx);
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
        active: i === active.index,
        visible: observers[i]?.isVisible || false,
      });
    }
  }

  return result;
}

/**
 * Clean up all resources
 */
function cleanupResources() {
  isActive = false;

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Disconnect observers
  for (let i = 0; i < count; i++) {
    if (observers[i]?.observer) {
      observers[i].observer.disconnect();
      observers[i] = null;
    }
  }

  // Clean up WebGL context
  if (renderer) {
    renderer.info.reset();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer = null;
  }

  // Clean up scene efficiently
  disposeScene();

  // Reset state
  count = 0;
  resetActiveCamera();

  // Clear arrays
  for (let i = 0; i < MAX_CAMERAS; i++) {
    cameras[i] = null;
    contexts[i] = null;
    observers[i] = null;
  }
}

/**
 * Dispose scene resources
 */
function disposeScene() {
  if (!scene) return;

  const disposeQueue = [...scene.children];

  // Use an iterative approach instead of recursive for performance
  while (disposeQueue.length > 0) {
    const obj = disposeQueue.pop();

    // Add children to the queue
    if (obj.children && obj.children.length > 0) {
      disposeQueue.push(...obj.children);
    }

    // Dispose geometry
    if (obj.geometry) {
      obj.geometry.dispose();
      obj.geometry = null;
    }

    // Dispose material(s)
    if (obj.material) {
      disposeMaterial(obj.material);
      obj.material = null;
    }

    // Dispose user data disposables
    if (obj.userData?.disposables) {
      const disposables = obj.userData.disposables;
      for (let i = 0, len = disposables.length; i < len; i++) {
        const item = disposables[i];
        item?.dispose?.();
      }
      obj.userData.disposables = null;
    }
  }

  scene.children.length = 0;
  scene = null;
}

/**
 * Dispose material and its textures
 */
function disposeMaterial(material) {
  if (!material) return;

  if (Array.isArray(material)) {
    for (let i = 0, len = material.length; i < len; i++) {
      disposeMaterial(material[i]);
    }
    return;
  }

  // Dispose textures in material
  for (const key in material) {
    const value = material[key];
    if (
      value &&
      typeof value === "object" &&
      typeof value.dispose === "function"
    ) {
      value.dispose();
    }
  }

  material.dispose();
}

/**
 * Apply frustum culling to optimize rendering
 */
function applyFrustumCulling(camera) {
  if (!camera) return;

  // Use pre-allocated objects
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  const objects = scene.children;
  const len = objects.length;

  for (let i = 0; i < len; i++) {
    const object = objects[i];

    if (object.isMesh && object.userData.skipFrustum !== true) {
      // Use bounding box for faster frustum culling
      if (!object.geometry.boundingBox) {
        object.geometry.computeBoundingBox();
      }

      _box3.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      object.visible = _frustum.intersectsBox(_box3);
    }
  }
}

/**
 * Batch object visibility updates
 */
function updateObjectVisibility() {
  if (!scene || !active.camera) return;

  const objects = scene.children;
  const objectCount = objects.length;

  // Skip frustum culling for simple scenes
  if (objectCount <= FRUSTUM_OBJECT_THRESHOLD) return;

  applyFrustumCulling(active.camera);
}

/**
 * Throttled render frame with request animation frame
 */
function throttledRender() {
  if (!isActive) return;

  rafId = requestAnimationFrame(() => {
    const now = performance.now();

    // Limit to target fps
    if (now - lastRenderTime > RENDER_INTERVAL_MS) {
      lastRenderTime = now;
      renderFrame();
    }

    throttledRender();
  });
}

/**
 * Render a frame
 * @returns {boolean} Whether render was successful
 */
export function renderFrame() {
  if (!isActive || !active.camera || !active.canvas || !active.ctx)
    return false;

  // Skip if canvas is disconnected
  if (!active.canvas.isConnected) return false;

  // Get canvas dimensions once
  const canvasWidth = active.canvas.width;
  const canvasHeight = active.canvas.height;

  // Skip tiny canvases
  if (canvasWidth <= 8 || canvasHeight <= 8) return false;

  // Update dimensions if needed
  if (active.width !== canvasWidth || active.height !== canvasHeight) {
    active.width = canvasWidth;
    active.height = canvasHeight;
    renderer.setSize(canvasWidth, canvasHeight, false);
  }

  try {
    // Update only the active camera's matrix
    active.camera.updateMatrixWorld(true);

    // Batch visibility updates for better performance
    updateObjectVisibility();

    // Clear and render
    renderer.clear();
    renderer.render(scene, active.camera);

    // Use the stored context for drawing
    active.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    active.ctx.drawImage(renderer.domElement, 0, 0, canvasWidth, canvasHeight);

    // Reset renderer info periodically to prevent memory growth
    if (++rendered % RESET_INFO_INTERVAL === 0) {
      renderer.info.reset();
    }

    return true;
  } catch (e) {
    console.error("Error rendering", e);
    return false;
  }
}

/**
 * Start auto rendering
 */
export function startAutoRender() {
  if (rafId) return;
  isActive = true;

  // Make sure we have the context
  if (active.canvas && !active.ctx) {
    active.ctx = active.canvas.getContext("2d", { alpha: true });
  }

  lastRenderTime = performance.now();
  throttledRender();
}

/**
 * Stop auto rendering
 */
export function stopAutoRender() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Check if there is an active camera
 */
export function hasActiveCamera() {
  return active.camera !== null;
}

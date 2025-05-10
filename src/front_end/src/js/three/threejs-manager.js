import {
  AmbientLight,
  DirectionalLight,
  Scene,
  WebGLRenderer,
  Frustum,
  Matrix4,
  Vector3,
  Box3,
} from "../extern/three/three.module.min.js";
import { getFallbackCube } from "./model-manager.js";

// Core configuration - use constants for better minification
const MAX_CAMERAS = 3;
const VISIBILITY_THRESHOLD = 0.01;
const FRUSTUM_OBJECT_THRESHOLD = 10;

// Pre-allocate reusable objects to avoid garbage collection
const _frustum = new Frustum();
const _projScreenMatrix = new Matrix4();
const _box3 = new Box3();
const _v3 = new Vector3();

// Rendering state - using single objects instead of arrays where possible
const state = {
  renderer: null,
  scene: null,
  isActive: false,
  cameras: new Array(MAX_CAMERAS).fill(null),
  contexts: new Array(MAX_CAMERAS).fill(null),
  observers: new Array(MAX_CAMERAS).fill(null),
  count: 0,
  active: {
    camera: null,
    canvas: null,
    width: -1,
    height: -1,
    index: -1,
  },
  rendered: 0,
  rafId: null,
  lastRenderTime: 0,
};

/**
 * Initialize the ThreeJS manager
 */
export function initThreeJSManager() {
  state.renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
    precision: "mediump",
    stencil: false,
    depth: true,
    premultipliedAlpha: false,
    failIfMajorPerformanceCaveat: true,
    preserveDrawingBuffer: false,
  });

  state.renderer.setClearColor(0x000000, 0);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // Lower pixel ratio for better performance
  state.renderer.shadowMap.enabled = false;
  state.renderer.autoClear = true;
  state.renderer.info.autoReset = false;
  state.renderer.clear(); // Initial clear

  // Setup context recovery - use function references to reduce memory
  const handleContextLost = (event) => {
    event.preventDefault();
    state.isActive = false;
    cancelAnimationFrame(state.rafId);
  };

  const handleContextRestored = () => {
    state.isActive = true;
  };

  state.renderer.domElement.addEventListener(
    "webglcontextlost",
    handleContextLost,
    false
  );
  state.renderer.domElement.addEventListener(
    "webglcontextrestored",
    handleContextRestored,
    false
  );

  // Create scene with optimization flags
  state.scene = new Scene();
  state.scene.matrixAutoUpdate = false;
  state.scene.autoUpdate = false;
  state.scene.add(getFallbackCube());

  // Add lights - use fewer lights for better performance
  const ambient = new AmbientLight(0xffffff, 0.6); // Increased to compensate for fewer lights
  ambient.matrixAutoUpdate = false;

  const direct = new DirectionalLight(0xffffff, 0.9);
  direct.position.set(5, 5, 2);
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();

  state.scene.add(ambient);
  state.scene.add(direct);

  // Setup listeners - use passive for better scrolling performance
  document.addEventListener(
    "visibilitychange",
    () => {
      state.isActive = document.visibilityState !== "hidden";
      if (!state.isActive) cancelAnimationFrame(state.rafId);
    },
    { passive: true }
  );

  // Use debounced resize handler
  let resizeTimeout;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateRendererSize, 100);
    },
    { passive: true }
  );

  window.addEventListener("beforeunload", cleanupResources, { passive: true });

  state.isActive = true;

  return {
    render: renderFrame,
    getStats: () => ({ rendered: state.rendered }),
    isActive: () => state.isActive,
  };
}

/**
 * Update renderer size based on active canvas
 */
function updateRendererSize() {
  if (!state.renderer || !state.active.canvas) return;

  state.active.width = state.active.canvas.width;
  state.active.height = state.active.canvas.height;
  state.renderer.setSize(state.active.width, state.active.height, false);
}

/**
 * Register a camera with the manager
 */
export function registerCamera(camera, context) {
  if (state.count >= MAX_CAMERAS) {
    throw new Error(`Max cameras (${MAX_CAMERAS}) reached`);
  }

  const idx = state.count++;

  // Store camera data
  state.cameras[idx] = camera;
  state.contexts[idx] = context;

  // Set first camera as default active
  if (state.count === 1 && context?.canvas) {
    state.active.index = idx;
    state.active.camera = camera;
    state.active.canvas = context.canvas;
    state.active.width = context.canvas.width;
    state.active.height = context.canvas.height;

    // Set initial renderer size
    if (state.renderer) {
      state.renderer.setSize(state.active.width, state.active.height, false);
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

  // Reuse options object
  const observerOptions = {
    threshold: [0, VISIBILITY_THRESHOLD, 0.5],
    rootMargin: "100px",
  };

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const isVisible =
      entry.isIntersecting && entry.intersectionRatio > VISIBILITY_THRESHOLD;

    // Skip unnecessary updates if state hasn't changed
    if (state.observers[idx]?.isVisible === isVisible) return;

    // Update visibility state
    if (!state.observers[idx]) state.observers[idx] = {};
    state.observers[idx].isVisible = isVisible;

    if (isVisible) {
      // Only update if actually changing cameras
      if (state.active.index !== idx) {
        // Set this as the active camera
        state.active.index = idx;
        state.active.camera = state.cameras[idx];
        state.active.canvas = context.canvas;
        state.active.width = context.canvas.width;
        state.active.height = context.canvas.height;

        // Update renderer size
        if (state.renderer) {
          state.renderer.setSize(
            state.active.width,
            state.active.height,
            false
          );
        }

        state.isActive = true;
      }
    } else if (state.active.index === idx) {
      // Find another visible camera
      let foundVisible = false;

      for (let i = 0; i < state.count; i++) {
        if (i !== idx && state.cameras[i] && state.observers[i]?.isVisible) {
          state.active.index = i;
          state.active.camera = state.cameras[i];
          state.active.canvas = state.contexts[i].canvas;
          state.active.width = state.active.canvas.width;
          state.active.height = state.active.canvas.height;

          // Update renderer size
          if (state.renderer) {
            state.renderer.setSize(
              state.active.width,
              state.active.height,
              false
            );
          }

          foundVisible = true;
          break;
        }
      }

      if (!foundVisible) {
        state.active.index = -1;
        state.active.camera = null;
        state.active.canvas = null;
        state.active.width = -1;
        state.active.height = -1;
      }
    }
  }, observerOptions);

  observer.observe(context.canvas);
  state.observers[idx] = { observer, isVisible: false };
}

/**
 * Dispose a camera and its resources
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= state.count || !state.cameras[idx]) return;

  // Dispose camera resources
  const cam = state.cameras[idx];
  if (cam?.userData?.disposables) {
    for (let i = 0; i < cam.userData.disposables.length; i++) {
      const item = cam.userData.disposables[i];
      item?.dispose?.();
    }
  }

  // Disconnect observer
  state.observers[idx]?.observer?.disconnect();

  // Clear references
  state.cameras[idx] = null;
  state.contexts[idx] = null;
  state.observers[idx] = null;

  // Update active camera if this was the active one
  if (state.active.index === idx) {
    // Reset active state
    state.active.index = -1;
    state.active.camera = null;
    state.active.canvas = null;
    state.active.width = -1;
    state.active.height = -1;

    // Find another visible camera
    for (let i = 0; i < state.count; i++) {
      if (state.cameras[i] && state.observers[i]?.isVisible) {
        state.active.index = i;
        state.active.camera = state.cameras[i];
        state.active.canvas = state.contexts[i].canvas;
        state.active.width = state.active.canvas.width;
        state.active.height = state.active.canvas.height;
        break;
      }
    }
  }
}

/**
 * Get the scene instance
 */
export function getScene() {
  return state.scene;
}

/**
 * Get all registered cameras
 */
export function getAllCameras() {
  const result = [];

  for (let i = 0; i < state.count; i++) {
    if (state.cameras[i]) {
      result.push({
        index: i,
        camera: state.cameras[i],
        active: i === state.active.index,
        visible: state.observers[i]?.isVisible || false,
      });
    }
  }

  return result;
}

/**
 * Clean up all resources
 */
function cleanupResources() {
  state.isActive = false;
  cancelAnimationFrame(state.rafId);

  // Disconnect observers
  for (let i = 0; i < state.count; i++) {
    if (state.observers[i]?.observer) {
      state.observers[i].observer.disconnect();
      state.observers[i] = null;
    }
  }

  // Clean up WebGL context
  if (state.renderer) {
    state.renderer.info.reset();
    state.renderer.dispose();
    state.renderer.forceContextLoss();
    state.renderer = null;
  }

  // Clean up scene efficiently
  if (state.scene) {
    state.scene.traverse((obj) => {
      // Dispose geometry
      if (obj.geometry) {
        obj.geometry.dispose();
        obj.geometry = null;
      }

      // Dispose material(s)
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (let i = 0; i < obj.material.length; i++) {
            const material = obj.material[i];
            if (material) {
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
          }
        } else if (obj.material) {
          // Dispose textures in material
          for (const key in obj.material) {
            const value = obj.material[key];
            if (
              value &&
              typeof value === "object" &&
              typeof value.dispose === "function"
            ) {
              value.dispose();
            }
          }
          obj.material.dispose();
        }
        obj.material = null;
      }

      // Dispose user data disposables
      if (obj.userData?.disposables) {
        for (let i = 0; i < obj.userData.disposables.length; i++) {
          const item = obj.userData.disposables[i];
          if (item?.dispose) item.dispose();
        }
        obj.userData.disposables = null;
      }
    });

    state.scene.children.length = 0;
    state.scene = null;
  }

  // Reset state
  state.count = 0;
  state.active.camera = null;
  state.active.canvas = null;
  state.active.width = -1;
  state.active.height = -1;
  state.active.index = -1;

  // Clear arrays
  for (let i = 0; i < MAX_CAMERAS; i++) {
    state.cameras[i] = null;
    state.contexts[i] = null;
    state.observers[i] = null;
  }
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

  const objects = state.scene.children;
  for (let i = 0; i < objects.length; i++) {
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
  if (!state.scene || !state.active.camera) return;

  const objects = state.scene.children;
  const objectCount = objects.length;

  // Skip frustum culling for simple scenes
  if (objectCount <= FRUSTUM_OBJECT_THRESHOLD) return;

  applyFrustumCulling(state.active.camera);
}

/**
 * Throttled render frame with request animation frame
 */
function throttledRender() {
  if (!state.isActive) return;

  state.rafId = requestAnimationFrame(() => {
    const now = performance.now();
    // Limit to ~60fps
    if (now - state.lastRenderTime > 16) {
      renderFrame();
      state.lastRenderTime = now;
    }
    throttledRender();
  });
}

/**
 * Render a frame
 */
export function renderFrame() {
  if (!state.isActive || !state.active.camera || !state.active.canvas)
    return false;

  // Skip if canvas is disconnected
  if (!state.active.canvas.isConnected) return false;

  // Update canvas dimensions if necessary - only get these values once
  const canvasWidth = state.active.canvas.width;
  const canvasHeight = state.active.canvas.height;

  // Skip tiny canvases
  if (canvasWidth <= 8 || canvasHeight <= 8) return false;

  // Update dimensions if needed
  if (
    state.active.width !== canvasWidth ||
    state.active.height !== canvasHeight
  ) {
    state.active.width = canvasWidth;
    state.active.height = canvasHeight;
    state.renderer.setSize(canvasWidth, canvasHeight, false);
  }

  try {
    // Update matrices - only those that are needed
    state.active.camera.updateMatrixWorld(true);

    // Don't update scene matrix world if not needed
    // state.scene.updateMatrixWorld(false);

    // Batch visibility updates for better performance
    updateObjectVisibility();

    // Make sure to clear both buffers
    state.renderer.clear();

    // Render scene
    state.renderer.render(state.scene, state.active.camera);

    // Copy to destination canvas - get context once and properly clear it
    // Using alpha: true ensures proper clearing
    const ctx = state.active.canvas.getContext("2d", { alpha: true });
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(state.renderer.domElement, 0, 0, canvasWidth, canvasHeight);

    // Reset renderer info periodically to prevent memory growth
    if (state.rendered % 100 === 0) {
      state.renderer.info.reset();
    }

    state.rendered++;
    return true;
  } catch (e) {
    console.error("Error rendering", e);
    return false;
  }
}

// Initialize with throttled rendering
export function startAutoRender() {
  if (state.rafId) return;
  state.isActive = true;
  state.active.ctx = state.active.canvas.getContext("2d", { alpha: true });
  throttledRender();
}

// Stop auto rendering
export function stopAutoRender() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

export function hasActiveCamera() {
  return state.active.camera !== null;
}

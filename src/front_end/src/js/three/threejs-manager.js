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
let renderer, scene;

let isActive = false;
let cameras = new Array(MAX_CAMERAS).fill(null);
let contexts = new Array(MAX_CAMERAS).fill(null);
let observers = new Array(MAX_CAMERAS).fill(null);
let count = 0;
let active = {
  camera: null,
  canvas: null,
  width: -1,
  height: -1,
  index: -1,
};
let rendered = 0;
let rafId = null;
let lastRenderTime = 0;

/**
 * Initialize the ThreeJS manager
 */
export function initThreeJSManager() {
  renderer = new WebGLRenderer({
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

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // Lower pixel ratio for better performance
  renderer.shadowMap.enabled = false;
  renderer.autoClear = true;
  renderer.info.autoReset = false;
  renderer.clear(); // Initial clear

  // Setup context recovery - use function references to reduce memory
  const handleContextLost = (event) => {
    event.preventDefault();
    isActive = false;
    cancelAnimationFrame(rafId);
  };

  const handleContextRestored = () => {
    isActive = true;
  };

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

  // Add lights - use fewer lights for better performance
  const ambient = new AmbientLight(0xffffff, 0.6); // Increased to compensate for fewer lights
  ambient.matrixAutoUpdate = false;

  const direct = new DirectionalLight(0xffffff, 0.9);
  direct.position.set(5, 5, 2);
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();

  scene.add(ambient);
  scene.add(direct);

  // Setup listeners - use passive for better scrolling performance
  document.addEventListener(
    "visibilitychange",
    () => {
      isActive = document.visibilityState !== "hidden";
      if (!isActive) cancelAnimationFrame(rafId);
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

  isActive = true;
}

/**
 * Update renderer size based on active canvas
 */
function updateRendererSize() {
  if (!renderer || !active.canvas) return;

  active.width = active.canvas.width;
  active.height = active.canvas.height;
  renderer.setSize(active.width, active.height, false);
}

/**
 * Register a camera with the manager
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
    if (observers[idx]?.isVisible === isVisible) return;

    // Update visibility state
    if (!observers[idx]) observers[idx] = {};
    observers[idx].isVisible = isVisible;

    if (isVisible) {
      // Only update if actually changing cameras
      if (active.index !== idx) {
        // Set this as the active camera
        active.index = idx;
        active.camera = cameras[idx];
        active.canvas = context.canvas;
        active.width = context.canvas.width;
        active.height = context.canvas.height;

        // Update renderer size
        if (renderer) {
          renderer.setSize(active.width, active.height, false);
        }

        isActive = true;
      }
    } else if (active.index === idx) {
      // Find another visible camera
      let foundVisible = false;

      for (let i = 0; i < count; i++) {
        if (i !== idx && cameras[i] && observers[i]?.isVisible) {
          active.index = i;
          active.camera = cameras[i];
          active.canvas = contexts[i].canvas;
          active.width = active.canvas.width;
          active.height = active.canvas.height;

          // Update renderer size
          if (renderer) {
            renderer.setSize(active.width, active.height, false);
          }

          foundVisible = true;
          break;
        }
      }

      if (!foundVisible) {
        active.index = -1;
        active.camera = null;
        active.canvas = null;
        active.width = -1;
        active.height = -1;
      }
    }
  }, observerOptions);

  observer.observe(context.canvas);
  observers[idx] = { observer, isVisible: false };
}

/**
 * Dispose a camera and its resources
 */
export function disposeCamera(idx) {
  if (idx < 0 || idx >= count || !cameras[idx]) return;

  // Dispose camera resources
  const cam = cameras[idx];
  if (cam?.userData?.disposables) {
    for (let i = 0; i < cam.userData.disposables.length; i++) {
      const item = cam.userData.disposables[i];
      item?.dispose?.();
    }
  }

  // Disconnect observer
  observers[idx]?.observer?.disconnect();

  // Clear references
  cameras[idx] = null;
  contexts[idx] = null;
  observers[idx] = null;

  // Update active camera if this was the active one
  if (active.index === idx) {
    // Reset active state
    active.index = -1;
    active.camera = null;
    active.canvas = null;
    active.width = -1;
    active.height = -1;

    // Find another visible camera
    for (let i = 0; i < count; i++) {
      if (cameras[i] && observers[i]?.isVisible) {
        active.index = i;
        active.camera = cameras[i];
        active.canvas = contexts[i].canvas;
        active.width = active.canvas.width;
        active.height = active.canvas.height;
        break;
      }
    }
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
  cancelAnimationFrame(rafId);

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
  if (scene) {
    scene.traverse((obj) => {
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

    scene.children.length = 0;
    scene = null;
  }

  // Reset state
  count = 0;
  active.camera = null;
  active.canvas = null;
  active.width = -1;
  active.height = -1;
  active.index = -1;

  // Clear arrays
  for (let i = 0; i < MAX_CAMERAS; i++) {
    cameras[i] = null;
    contexts[i] = null;
    observers[i] = null;
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

  const objects = scene.children;
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
    // Limit to ~60fps
    if (now - lastRenderTime > 16) {
      lastRenderTime = now;
    }
    throttledRender();
  });
}

/**
 * Render a frame
 */
export function renderFrame() {
  if (!isActive || !active.camera || !active.canvas) return false;

  // Skip if canvas is disconnected
  if (!active.canvas.isConnected) return false;

  // Update canvas dimensions if necessary - only get these values once
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
    // Update matrices - only those that are needed
    active.camera.updateMatrixWorld(true);

    // Don't update scene matrix world if not needed
    // scene.updateMatrixWorld(false);

    // Batch visibility updates for better performance
    updateObjectVisibility();

    // Make sure to clear both buffers
    renderer.clear();

    // Render scene
    renderer.render(scene, active.camera);

    // Copy to destination canvas - get context once and properly clear it
    // Using alpha: true ensures proper clearing
    const ctx = active.canvas.getContext("2d", { alpha: true });
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(renderer.domElement, 0, 0, canvasWidth, canvasHeight);

    // Reset renderer info periodically to prevent memory growth
    if (rendered % 100 === 0) {
      renderer.info.reset();
    }

    rendered++;
    return true;
  } catch (e) {
    console.error("Error rendering", e);
    return false;
  }
}

// Initialize with throttled rendering
export function startAutoRender() {
  if (rafId) return;
  isActive = true;
  active.ctx = active.canvas.getContext("2d", { alpha: true });
  throttledRender();
}

// Stop auto rendering
export function stopAutoRender() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function hasActiveCamera() {
  return active.camera !== null;
}

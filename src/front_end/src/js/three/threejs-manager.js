import {
  AmbientLight,
  DirectionalLight,
  Scene,
  WebGLRenderer,
  Frustum,
  Matrix4,
  Vector3,
  Box3,
  SRGBColorSpace,
} from "../extern/three/three.module.min.js";
import { loadModel } from "./model.js";

// Constants
const MAX_CAMERAS = 3;
const VISIBILITY_THRESHOLD = 0.01;
const FRUSTUM_THRESHOLD = 10;
const FPS_INTERVAL = 16; // ~60fps
const RESIZE_DELAY = 100;
const INFO_RESET_COUNT = 100;
const PIXEL_RATIO = Math.min(devicePixelRatio || 1, 1.5);

// Reusable objects
const frustum = new Frustum();
const projMatrix = new Matrix4();
const box3 = new Box3();
const vec3 = new Vector3();

// State
let renderer, scene;
let isActive = false;
let cameras = [];
let contexts = [];
let observers = [];
let count = 0;
let activeIndex = -1;
let activeCamera = null;
let activeCanvas = null;
let activeCtx = null;
let activeWidth = -1;
let activeHeight = -1;
let rafId = null;
let lastRender = 0;
let rendered = 0;
let resizeTimer = null;

const observerConfig = {
  threshold: [0, VISIBILITY_THRESHOLD, 0.5],
  rootMargin: "100px",
};

const rendererConfig = {
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

export async function initThreeJSManager() {
  // Create renderer
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2", {
      powerPreference: "high-performance",
    });

    renderer = gl2
      ? new WebGLRenderer({ ...rendererConfig, canvas, context: gl2 })
      : new WebGLRenderer(rendererConfig);

    console.log(`Using WebGL ${gl2 ? "2.0" : "1.0"}`);
  } catch (e) {
    renderer = new WebGLRenderer(rendererConfig);
    console.warn("WebGL context error:", e);
  }

  // Configure renderer
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(PIXEL_RATIO);
  renderer.shadowMap.enabled = false;
  renderer.autoClear = true;
  renderer.sortObjects = true;
  renderer.physicallyCorrectLights = false;
  renderer.info.autoReset = false;

  if (renderer.capabilities.isWebGL2) {
    renderer.outputColorSpace = SRGBColorSpace;
  }

  // Setup scene
  scene = new Scene();
  scene.matrixAutoUpdate = false;
  scene.autoUpdate = false;

  const model = await loadModel();
  scene.add(model);

  // Add lighting
  const ambient = new AmbientLight(0xffffff, 0.6);
  ambient.matrixAutoUpdate = false;

  const direct = new DirectionalLight(0xffffff, 0.9);
  direct.position.set(5, 5, 2);
  direct.matrixAutoUpdate = false;
  direct.updateMatrix();

  scene.add(ambient, direct);

  // Setup events
  document.addEventListener("visibilitychange", handleVisibility, {
    passive: true,
  });
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("beforeunload", cleanup, { passive: true });
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

  isActive = true;
}

function handleVisibility() {
  const wasActive = isActive;
  isActive = document.visibilityState !== "hidden";

  if (!isActive && rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
    return;
  }

  if (isActive && !wasActive && !rafId && activeCamera) {
    startRender();
  }
}

function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateSize, RESIZE_DELAY);
}

function updateSize() {
  if (!renderer || !activeCanvas) return;

  const w = activeCanvas.width;
  const h = activeCanvas.height;

  if (activeWidth === w && activeHeight === h) return;

  activeWidth = w;
  activeHeight = h;
  renderer.setSize(w, h, false);
}

function handleContextLost(e) {
  e.preventDefault();
  isActive = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function handleContextRestored() {
  isActive = true;
  if (!rafId && activeCamera) {
    startRender();
  }
}

export function registerCamera(camera, context) {
  if (count >= MAX_CAMERAS) {
    throw new Error(`Max ${MAX_CAMERAS} cameras allowed`);
  }

  const idx = count++;
  cameras[idx] = camera;
  contexts[idx] = context;

  // Set first camera as active
  if (count === 1 && context?.canvas) {
    setActiveCamera(idx);
  }

  setupObserver(context, idx);
  return idx;
}

function setupObserver(context, idx) {
  if (!context?.canvas) return;

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const visible =
      entry.isIntersecting && entry.intersectionRatio > VISIBILITY_THRESHOLD;
    const prevVisible = observers[idx]?.visible;

    if (visible === prevVisible) return;

    observers[idx] = { observer, visible };
    handleVisibilityChange(idx, visible);
  }, observerConfig);

  observer.observe(context.canvas);
  observers[idx] = { observer, visible: false };
}

function handleVisibilityChange(idx, visible) {
  if (visible && activeIndex !== idx) {
    setActiveCamera(idx);
    return;
  }

  if (!visible && activeIndex === idx) {
    findVisibleCamera(idx);
  }
}

function setActiveCamera(idx) {
  const camera = cameras[idx];
  const context = contexts[idx];

  if (!camera || !context?.canvas) return;

  activeIndex = idx;
  activeCamera = camera;
  activeCanvas = context.canvas;
  activeCtx = context.canvas.getContext("2d", { alpha: true });
  activeWidth = activeCanvas.width;
  activeHeight = activeCanvas.height;

  if (renderer) {
    renderer.setSize(activeWidth, activeHeight, false);
  }

  isActive = true;

  if (!rafId) {
    startRender();
  }
}

function findVisibleCamera(excludeIdx) {
  for (let i = 0; i < count; i++) {
    if (i !== excludeIdx && cameras[i] && observers[i]?.visible) {
      setActiveCamera(i);
      return;
    }
  }

  resetActive();
}

function resetActive() {
  activeIndex = -1;
  activeCamera = null;
  activeCanvas = null;
  activeCtx = null;
  activeWidth = -1;
  activeHeight = -1;

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function disposeCamera(idx) {
  const camera = cameras[idx];
  if (!camera) return;

  // Dispose resources
  const disposables = camera.userData?.disposables;
  if (disposables) {
    for (const item of disposables) {
      item?.dispose?.();
    }
    camera.userData.disposables = null;
  }

  // Cleanup observer
  observers[idx]?.observer?.disconnect();

  // Clear references
  cameras[idx] = null;
  contexts[idx] = null;
  observers[idx] = null;

  // Handle active camera change
  if (activeIndex === idx) {
    resetActive();
    findVisibleCamera(idx);
  }
}

export function getScene() {
  return scene;
}

export function getAllCameras() {
  const result = [];
  for (let i = 0; i < count; i++) {
    if (cameras[i]) {
      result.push({
        index: i,
        camera: cameras[i],
        active: i === activeIndex,
        visible: observers[i]?.visible || false,
      });
    }
  }
  return result;
}

function cleanup() {
  isActive = false;

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Cleanup observers
  for (let i = 0; i < count; i++) {
    observers[i]?.observer?.disconnect();
  }

  // Cleanup renderer
  if (renderer) {
    renderer.info.reset();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer = null;
  }

  // Cleanup scene
  disposeScene();

  // Reset state
  count = 0;
  cameras.length = 0;
  contexts.length = 0;
  observers.length = 0;
  resetActive();
}

function disposeScene() {
  if (!scene) return;

  const queue = [...scene.children];

  while (queue.length) {
    const obj = queue.pop();

    if (obj.children?.length) {
      queue.push(...obj.children);
    }

    obj.geometry?.dispose();
    disposeMaterial(obj.material);

    const disposables = obj.userData?.disposables;
    if (disposables) {
      for (const item of disposables) {
        item?.dispose?.();
      }
    }
  }

  scene.children.length = 0;
  scene = null;
}

function disposeMaterial(material) {
  if (!material) return;

  if (Array.isArray(material)) {
    for (const mat of material) {
      disposeMaterial(mat);
    }
    return;
  }

  // Dispose textures
  for (const key in material) {
    const value = material[key];
    if (value?.dispose) {
      value.dispose();
    }
  }

  material.dispose();
}

function applyFrustumCulling() {
  if (!activeCamera) return;

  projMatrix.multiplyMatrices(
    activeCamera.projectionMatrix,
    activeCamera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(projMatrix);

  for (const obj of scene.children) {
    if (!obj.isMesh || obj.userData.skipFrustum) continue;

    if (!obj.geometry.boundingBox) {
      obj.geometry.computeBoundingBox();
    }

    box3.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
    obj.visible = frustum.intersectsBox(box3);
  }
}

function updateVisibility() {
  if (!scene || !activeCamera || scene.children.length <= FRUSTUM_THRESHOLD)
    return;
  applyFrustumCulling();
}

function renderLoop() {
  if (!isActive) return;

  rafId = requestAnimationFrame(() => {
    const now = performance.now();

    if (now - lastRender > FPS_INTERVAL) {
      lastRender = now;
      renderFrame();
    }

    renderLoop();
  });
}

export function renderFrame() {
  if (!isActive || !activeCamera || !activeCanvas || !activeCtx) return false;
  if (!activeCanvas.isConnected) return false;

  const w = activeCanvas.width;
  const h = activeCanvas.height;

  if (w <= 8 || h <= 8) return false;

  // Update size if needed
  if (activeWidth !== w || activeHeight !== h) {
    activeWidth = w;
    activeHeight = h;
    renderer.setSize(w, h, false);
  }

  try {
    activeCamera.updateMatrixWorld(true);
    updateVisibility();

    renderer.clear();
    renderer.render(scene, activeCamera);

    activeCtx.clearRect(0, 0, w, h);
    activeCtx.drawImage(renderer.domElement, 0, 0, w, h);

    if (++rendered % INFO_RESET_COUNT === 0) {
      renderer.info.reset();
    }

    return true;
  } catch (e) {
    console.error("Render error:", e);
    return false;
  }
}

export function startAutoRender() {
  if (rafId) return;

  isActive = true;

  if (activeCanvas && !activeCtx) {
    activeCtx = activeCanvas.getContext("2d", { alpha: true });
  }

  lastRender = performance.now();
  renderLoop();
}

export function stopAutoRender() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function hasActiveCamera() {
  return activeCamera !== null;
}

// Rename for consistency
export const startRender = startAutoRender;

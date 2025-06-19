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
const FPS_TARGET = 60;
const FRAME_TIME = 1000 / FPS_TARGET;
const RESIZE_DEBOUNCE = 100;
const INFO_RESET_INTERVAL = 100;
const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.5);

// Reusable objects (avoiding repeated allocations)
const frustum = new Frustum();
const projMatrix = new Matrix4();
const box3 = new Box3();
const vec3 = new Vector3();

// Core state
const state = {
  renderer: null,
  scene: null,
  cameras: new Array(MAX_CAMERAS),
  contexts: new Array(MAX_CAMERAS),
  observers: new Array(MAX_CAMERAS),
  active: {
    index: -1,
    camera: null,
    canvas: null,
    ctx: null,
    width: -1,
    height: -1,
  },
  animation: {
    id: null,
    lastFrame: 0,
    frameCount: 0,
  },
  flags: {
    isActive: false,
    needsResize: false,
  },
  timers: {
    resize: null,
  },
};

// Observer configuration
const observerConfig = {
  threshold: [0, VISIBILITY_THRESHOLD, 0.5],
  rootMargin: "50px", // Reduced margin for better performance
};

export async function initThreeJSManager() {
  // Create optimized renderer
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    powerPreference: "high-performance",
    alpha: true,
    antialias: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });

  state.renderer = new WebGLRenderer({
    canvas,
    context: gl,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
    premultipliedAlpha: false,
  });

  const { renderer } = state;

  // Configure renderer for performance
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(PIXEL_RATIO);
  renderer.shadowMap.enabled = false;
  renderer.autoClear = false; // Manual clearing for better control
  renderer.sortObjects = false; // Disable if not needed
  renderer.info.autoReset = false;

  if (renderer.capabilities.isWebGL2) {
    renderer.outputColorSpace = SRGBColorSpace;
  }

  // Setup scene with minimal updates
  state.scene = new Scene();
  state.scene.matrixAutoUpdate = false;
  state.scene.autoUpdate = false;

  // Load and add model
  const model = await loadModel();
  state.scene.add(model);

  // Add optimized lighting
  const lights = [
    new AmbientLight(0xffffff, 0.6),
    (() => {
      const light = new DirectionalLight(0xffffff, 0.9);
      light.position.set(5, 5, 2);
      light.matrixAutoUpdate = false;
      light.updateMatrix();
      return light;
    })(),
  ];

  lights.forEach((light) => {
    light.matrixAutoUpdate = false;
    state.scene.add(light);
  });

  // Setup event listeners with passive optimization
  const events = [
    ["visibilitychange", handleVisibility, document],
    ["resize", handleResize, window],
    ["beforeunload", cleanup, window],
    ["webglcontextlost", handleContextLost, renderer.domElement],
    ["webglcontextrestored", handleContextRestored, renderer.domElement],
  ];

  events.forEach(([event, handler, target]) => {
    target.addEventListener(event, handler, { passive: true });
  });

  state.flags.isActive = true;
}

// Optimized visibility handling
function handleVisibility() {
  const wasActive = state.flags.isActive;
  state.flags.isActive = document.visibilityState === "visible";

  if (!state.flags.isActive) {
    stopRender();
  } else if (!wasActive && state.active.camera) {
    startRender();
  }
}

// Debounced resize handling
function handleResize() {
  clearTimeout(state.timers.resize);
  state.timers.resize = setTimeout(() => {
    state.flags.needsResize = true;
  }, RESIZE_DEBOUNCE);
}

// Context loss handling
function handleContextLost(e) {
  e.preventDefault();
  state.flags.isActive = false;
  stopRender();
}

function handleContextRestored() {
  state.flags.isActive = true;
  if (state.active.camera) startRender();
}

// Streamlined camera registration
export function registerCamera(camera, context) {
  const index = state.cameras.findIndex((c) => !c);
  if (index === -1) {
    throw new Error(`Maximum ${MAX_CAMERAS} cameras exceeded`);
  }

  state.cameras[index] = camera;
  state.contexts[index] = context;

  if (context?.canvas) {
    setupObserver(context.canvas, index);
    if (state.active.index === -1) {
      setActiveCamera(index);
    }
  }

  return index;
}

// Optimized observer setup
function setupObserver(canvas, index) {
  const observer = new IntersectionObserver((entries) => {
    const { isIntersecting, intersectionRatio } = entries[0];
    const visible = isIntersecting && intersectionRatio > VISIBILITY_THRESHOLD;
    const wasVisible = state.observers[index]?.visible;

    if (visible === wasVisible) return;

    state.observers[index] = { observer, visible };

    if (visible && state.active.index !== index) {
      setActiveCamera(index);
    } else if (!visible && state.active.index === index) {
      findNextVisibleCamera();
    }
  }, observerConfig);

  observer.observe(canvas);
  state.observers[index] = { observer, visible: false };
}

// Simplified active camera management
function setActiveCamera(index) {
  const camera = state.cameras[index];
  const context = state.contexts[index];

  if (!camera || !context?.canvas) return;

  // Update active state in one go
  Object.assign(state.active, {
    index,
    camera,
    canvas: context.canvas,
    ctx: context.canvas.getContext("2d", { alpha: true }),
    width: context.canvas.width,
    height: context.canvas.height,
  });

  state.renderer?.setSize(state.active.width, state.active.height, false);

  if (!state.animation.id && state.flags.isActive) {
    startRender();
  }
}

function findNextVisibleCamera() {
  const nextIndex = state.cameras.findIndex(
    (camera, i) => camera && state.observers[i]?.visible
  );

  if (nextIndex !== -1) {
    setActiveCamera(nextIndex);
  } else {
    resetActiveCamera();
  }
}

function resetActiveCamera() {
  Object.assign(state.active, {
    index: -1,
    camera: null,
    canvas: null,
    ctx: null,
    width: -1,
    height: -1,
  });
  stopRender();
}

// Streamlined disposal
export function disposeCamera(index) {
  const camera = state.cameras[index];
  if (!camera) return;

  // Dispose resources
  camera.userData?.disposables?.forEach((item) => item?.dispose?.());

  // Cleanup observer
  state.observers[index]?.observer?.disconnect();

  // Clear references
  state.cameras[index] = null;
  state.contexts[index] = null;
  state.observers[index] = null;

  // Handle active camera change
  if (state.active.index === index) {
    findNextVisibleCamera();
  }
}

// Optimized frustum culling
function updateVisibility() {
  const { scene, active } = state;
  if (!scene || !active.camera || scene.children.length <= FRUSTUM_THRESHOLD) {
    return;
  }

  projMatrix.multiplyMatrices(
    active.camera.projectionMatrix,
    active.camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(projMatrix);

  // Batch visibility updates
  for (const obj of scene.children) {
    if (obj.isMesh && !obj.userData.skipFrustum) {
      if (!obj.geometry.boundingBox) {
        obj.geometry.computeBoundingBox();
      }
      box3.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
      obj.visible = frustum.intersectsBox(box3);
    }
  }
}

// High-performance render loop
function renderLoop(currentTime) {
  if (!state.flags.isActive) return;

  state.animation.id = requestAnimationFrame(renderLoop);

  // Frame rate limiting
  if (currentTime - state.animation.lastFrame < FRAME_TIME) return;

  state.animation.lastFrame = currentTime;

  if (renderFrame()) {
    state.animation.frameCount++;
  }
}

export function renderFrame() {
  const { renderer, scene, active, flags } = state;

  if (!flags.isActive || !active.camera || !active.canvas || !active.ctx) {
    return false;
  }

  const { width, height } = active.canvas;

  // Skip tiny canvases
  if (width < 8 || height < 8) return false;

  // Handle resize if needed
  if (flags.needsResize || active.width !== width || active.height !== height) {
    active.width = width;
    active.height = height;
    renderer.setSize(width, height, false);
    flags.needsResize = false;
  }

  try {
    // Update camera and visibility
    active.camera.updateMatrixWorld();
    updateVisibility();

    // Render
    renderer.clear();
    renderer.render(scene, active.camera);

    // Copy to canvas
    active.ctx.clearRect(0, 0, width, height);
    active.ctx.drawImage(renderer.domElement, 0, 0, width, height);

    // Periodic cleanup
    if (state.animation.frameCount % INFO_RESET_INTERVAL === 0) {
      renderer.info.reset();
    }

    return true;
  } catch (error) {
    console.error("Render error:", error);
    return false;
  }
}

// Simple render control
export function startRender() {
  if (state.animation.id) return;

  state.flags.isActive = true;
  state.animation.lastFrame = performance.now();
  renderLoop(state.animation.lastFrame);
}

export function stopRender() {
  if (state.animation.id) {
    cancelAnimationFrame(state.animation.id);
    state.animation.id = null;
  }
}

// Optimized cleanup
function cleanup() {
  state.flags.isActive = false;
  stopRender();

  // Cleanup observers
  state.observers.forEach((obs) => obs?.observer?.disconnect());

  // Dispose renderer
  if (state.renderer) {
    state.renderer.dispose();
    state.renderer.forceContextLoss();
  }

  // Dispose scene
  disposeSceneRecursive(state.scene);

  // Reset state
  Object.assign(state, {
    renderer: null,
    scene: null,
    cameras: new Array(MAX_CAMERAS),
    contexts: new Array(MAX_CAMERAS),
    observers: new Array(MAX_CAMERAS),
  });
  resetActiveCamera();
}

function disposeSceneRecursive(obj) {
  if (!obj) return;

  obj.children?.forEach((child) => disposeSceneRecursive(child));

  obj.geometry?.dispose();

  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => disposeMaterial(mat));
    } else {
      disposeMaterial(obj.material);
    }
  }

  obj.userData?.disposables?.forEach((item) => item?.dispose?.());
}

function disposeMaterial(material) {
  if (!material) return;

  // Dispose textures
  Object.values(material).forEach((value) => {
    if (value?.dispose) value.dispose();
  });

  material.dispose();
}

// Utility exports
export const getScene = () => state.scene;
export const hasActiveCamera = () => state.active.camera !== null;
export const getAllCameras = () =>
  state.cameras
    .map(
      (camera, index) =>
        camera && {
          index,
          camera,
          active: index === state.active.index,
          visible: state.observers[index]?.visible || false,
        }
    )
    .filter(Boolean);

// Legacy alias
export const startAutoRender = startRender;
export const stopAutoRender = stopRender;

/**
 * @fileoverview Core Three.js renderer setup and shared components
 */

import {
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  PCFSoftShadowMap,
} from "../extern/three/three.module.min.js";
import { isLowPoweredDevice } from "../utils/device.js";
import { getFPS, updateFPS } from "../utils/helper.js";
import {
  initCameraRegistry,
  countActiveCameras,
  getCameraRegistry,
  updateActiveControls,
  renderActiveCameras,
} from "./camera-registry.js";
import { initModelManager } from "./model-manager.js";
import { initUserInteraction, isIdle } from "../user-interaction.js";
import { getProjectCardScene } from "./project-cards.js";
import { C } from "../constants/constants.js";

// Shared state
let renderer = null;
let stats = null;
let isAnimating = false;
let lastRenderTime = 0;

// Shared components
export const sharedLights = {};
export const sharedCanvasContextOptions = {
  alpha: true,
  desynchronized: true,
  willReadFrequently: false,
};

const isLowEndDevice = isLowPoweredDevice();

/**
 * Initialize shared lights for all scenes
 */
function initSharedLights() {
  sharedLights.ambientLight = new AmbientLight(0xffffff, 0.7);

  sharedLights.directionalLight1 = new DirectionalLight(0xffffff, 0.8);
  sharedLights.directionalLight1.position.set(1, 1, 1);
  sharedLights.directionalLight1.castShadow = false;

  sharedLights.directionalLight2 = new DirectionalLight(0xffffff, 0.4);
  sharedLights.directionalLight2.position.set(-1, 0.5, -1);
}

/**
 * Clone a shared light with optional overrides
 */
export function getClonedLight(lightType, options = {}) {
  if (!sharedLights[lightType]) return null;
  const cloned = sharedLights[lightType].clone();
  if (options.intensity !== undefined) cloned.intensity = options.intensity;
  return cloned;
}

/**
 * Initialize Three.js renderer
 */
export function initRenderer() {
  if (renderer) return;

  try {
    // Create renderer with optimized options
    renderer = new WebGLRenderer({
      powerPreference: isLowEndDevice ? "low-power" : "high-performance",
      precision: isLowEndDevice ? "lowp" : "mediump",
      antialias: !isLowEndDevice,
      alpha: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
      stencil: false,
      depth: true,
    });

    // Test WebGL capability
    const gl = renderer.getContext();
    if (!gl) throw new Error("WebGL not available");

    // Add context event handlers
    renderer.domElement.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        isAnimating = false;
      },
      false
    );

    renderer.domElement.addEventListener(
      "webglcontextrestored",
      () => {
        isAnimating = true;
        requestAnimationFrame(animate);
      },
      false
    );

    // Configure renderer
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(
      isLowEndDevice ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT, false);
    renderer.shadowMap.enabled = !isLowEndDevice;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.info.autoReset = false;

    // Initialize subsystems
    initSharedLights();
    initUserInteraction();
    onUserInteraction(() => {
      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(animate);
      }
    });

    initCameraRegistry();
    initModelManager();

    if (process.env.NODE_ENV === "development") initPerformanceMonitoring();

    return renderer;
  } catch (error) {
    console.error("Three.js init error:", error);
    initFallbackRenderer();
  }
}

/**
 * Initialize a fallback renderer when main renderer fails
 */
export function initFallbackRenderer() {
  try {
    renderer = new WebGLRenderer({
      antialias: false,
      alpha: true,
      precision: "lowp",
      powerPreference: "low-power",
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT, false);

    initCameraRegistry();
    initModelManager();

    isAnimating = true;
    requestAnimationFrame(animate);

    return renderer;
  } catch (error) {
    console.error("Fallback renderer failed:", error);
    displayWebGLError();
    return null;
  }
}

/**
 * Display WebGL error message to user
 */
function displayWebGLError() {
  const errorMsg = document.createElement("div");
  errorMsg.style.color = "red";
  errorMsg.style.padding = "20px";
  errorMsg.textContent = "WebGL not supported. Please try a different browser.";
  document.body.prepend(errorMsg);
}

/**
 * Initialize performance monitoring in development
 */
function initPerformanceMonitoring() {
  stats = document.createElement("div");
  Object.assign(stats.style, {
    position: "fixed",
    top: "0",
    right: "0",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "white",
    padding: "5px",
    fontSize: "12px",
    fontFamily: "monospace",
    zIndex: "9999",
  });
  document.body.appendChild(stats);

  setInterval(() => {
    if (renderer) {
      stats.textContent = `FPS: ${getFPS().toFixed(0)} | Draw Calls: ${
        renderer.info.render.calls
      } | Geometries: ${renderer.info.memory.geometries} | Textures: ${
        renderer.info.memory.textures
      } | Cameras: ${countActiveCameras()}/${getCameraRegistry().count}`;
      renderer.info.reset();
    }
  }, 1000);
}

/**
 * User interaction handler
 */
export function onUserInteraction(callback) {
  document.addEventListener("mousemove", callback, { passive: true });
  document.addEventListener("mousedown", callback, { passive: true });
  document.addEventListener("touchstart", callback, { passive: true });
  document.addEventListener("keydown", callback, { passive: true });
}

/**
 * Main animation loop with performance optimizations
 */
export function animate(timestamp) {
  if (!isAnimating) return;

  const deltaTime = timestamp - lastRenderTime;
  const frameDelay = isIdle() ? C.IDLE_FRAME_INTERVAL : C.FRAME_INTERVAL;

  if (deltaTime < frameDelay) {
    requestNextFrame();
    return;
  }

  lastRenderTime = timestamp;

  try {
    // Update controls and render cameras
    if (renderer) {
      // These functions will be imported from other modules
      updateActiveControls(timestamp);

      // Check WebGL context
      const context = renderer?.getContext?.();
      if (!context || context.isContextLost()) {
        recoverRenderer();
      } else {
        renderActiveCameras(renderer, getProjectCardScene());
      }
    }

    // Update metrics in development
    if (process.env.NODE_ENV === "development") {
      updateFPS(timestamp);
      renderer?.info?.reset?.();
    }
  } catch (err) {
    console.error("Animation error:", err);
  }

  requestNextFrame();
}

/**
 * Schedule next animation frame with fallback
 */
function requestNextFrame() {
  try {
    requestAnimationFrame(animate);
  } catch {
    setTimeout(
      () => isAnimating && requestAnimationFrame(animate),
      C.FRAME_INTERVAL
    );
  }
}

/**
 * Recover renderer after context loss
 */
function recoverRenderer() {
  try {
    renderer = new WebGLRenderer({
      antialias: false,
      alpha: true,
      precision: "lowp",
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT, false);
  } catch (err) {
    console.error("Renderer recovery failed:", err);
  }
}

/**
 * Start animation loop
 */
export function startAnimation() {
  if (!isAnimating) {
    isAnimating = true;
    requestAnimationFrame(animate);
  }
}

/**
 * Stop animation loop
 */
export function stopAnimation() {
  isAnimating = false;
}

/**
 * Get renderer instance
 */
export function getRenderer() {
  return renderer;
}

/**
 * @fileoverview Three.js scene and object management system (optimized)
 */

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  PCFSoftShadowMap,
  Vector3,
} from "../extern/three/three.module.min.js";
import { OrbitControls } from "../extern/three/OrbitControls.js";
import {
  CAMERA_TYPES,
  initCameraRegistry,
  registerCamera,
  getCameraRegistry,
  getCamerasBySection,
  updateActiveControls,
  renderActiveCameras,
  createSimpleAutorotation,
  activateAllCameras,
  enableCamera,
  disableCamera,
  countActiveCameras,
} from "./camera-registry.js";
import {
  initUserInteraction,
  handleUserInteraction,
  isIdle,
} from "../user-interaction.js";
import { isLowPoweredDevice } from "../utils/device.js";
import {
  debounce,
  getFPS,
  isElementInViewport,
  updateFPS,
} from "../utils/helper.js";
import {
  initModelManager,
  getModel,
  preloadProjectModels,
  markModelUnused,
  calculateModelPositions,
  getModelPosition,
  getFallbackCube,
  FALLBACK_CUBE_NAME,
} from "./model-manager.js";

// Constants
const C = {
  FRAME_INTERVAL: 1000 / 60,
  IDLE_FRAME_INTERVAL: 1000 / 8,
  VISIBLE_PRIORITY_COUNT: 6,
  DEFAULT_FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
  CAMERA_DISTANCE: 10,
  MIN_DISTANCE: 1.5,
  MAX_DISTANCE: 8,
  DEFAULT_WIDTH: 300,
  DEFAULT_HEIGHT: 200,
  INTERSECTION_THRESHOLD: 0.1,
  INTERSECTION_MARGIN: "150px",
  AUTO_ROTATE_SPEED: 2.0,
};

// Shared state
let renderer = null,
  stats = null,
  gameScene = null,
  projectCardScene = null,
  thirdPersonCamera = null,
  mainGameCanvas = null,
  mainGameCanvasContext = null,
  gameAnimationFrameId = null,
  isAnimating = false,
  lastRenderTime = 0,
  isGameViewActive = false,
  resizeObserver = null,
  frameCounter = 0,
  lastFPSUpdate = 0,
  fpsValue = 0;

const isLowEndDevice = isLowPoweredDevice();
const sharedLights = {};
const sharedCanvasContextOptions = {
  alpha: true,
  desynchronized: true,
  willReadFrequently: false,
};
const orbitControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  autoRotate: true,
  autoRotateSpeed: C.AUTO_ROTATE_SPEED,
  enableZoom: true,
  minDistance: C.MIN_DISTANCE,
  maxDistance: C.MAX_DISTANCE,
};

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
function getClonedLight(lightType, options = {}) {
  if (!sharedLights[lightType]) return null;
  const cloned = sharedLights[lightType].clone();
  if (options.intensity !== undefined) cloned.intensity = options.intensity;
  return cloned;
}

/**
 * Initialize Three.js renderer and scenes
 */
export function initThreeJS() {
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
    initGameScene();
    initProjectCardScene();

    // Get visible projects and initialize
    const visibleProjects = getVisibleProjectModels();

    const initSequence = async () => {
      try {
        await preloadProjectModels(
          visibleProjects.slice(0, 3),
          visibleProjects
        );
        initAboutCanvas();
        initPortfolioCanvases();
        activateAllCameras();

        isAnimating = true;
        requestAnimationFrame(animate);

        // Load remaining models
        return preloadProjectModels(visibleProjects.slice(3), visibleProjects);
      } catch (error) {
        console.error("Init error:", error);
      }
    };

    initSequence();
    if (process.env.NODE_ENV === "development") initPerformanceMonitoring();
  } catch (error) {
    console.error("Three.js init error:", error);
    initFallbackRenderer();
  }
}

/**
 * Initialize a fallback renderer when main renderer fails
 */
function initFallbackRenderer() {
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
  } catch (error) {
    console.error("Fallback renderer failed:", error);
    displayWebGLError();
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
 * Initialize game scene
 */
function initGameScene() {
  gameScene = new Scene();
  gameScene.add(getClonedLight("ambientLight"));
  gameScene.add(getClonedLight("directionalLight1"));

  thirdPersonCamera = new PerspectiveCamera(
    C.DEFAULT_FOV,
    window.innerWidth / window.innerHeight,
    C.NEAR,
    C.FAR
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 0, 0);

  registerCamera(
    thirdPersonCamera,
    createSimpleAutorotation(thirdPersonCamera, new Vector3(0, 0, 0), 5, 0),
    null,
    { type: CAMERA_TYPES.GAME, elementId: "game-view", section: "game" },
    false
  );
}

/**
 * Initialize project card scene
 */
function initProjectCardScene() {
  projectCardScene = new Scene();

  // Add lights with custom intensities
  projectCardScene.add(getClonedLight("ambientLight", { intensity: 0.8 }));
  projectCardScene.add(getClonedLight("directionalLight1", { intensity: 0.6 }));
  projectCardScene.add(getClonedLight("directionalLight2"));
  projectCardScene.add(getFallbackCube());

  // Calculate model positions
  const modelNames = Array.from(document.querySelectorAll(".portfolio-item"))
    .map((item) => item.getAttribute("data-model"))
    .filter(Boolean);

  calculateModelPositions(modelNames);
}

/**
 * Get models from visible project cards
 */
function getVisibleProjectModels() {
  const visibleModels = [];
  const portfolioItems = document.querySelectorAll(".portfolio-item");

  // Add models visible in viewport
  portfolioItems.forEach((item) => {
    if (isElementInViewport(item)) {
      const modelName = item.getAttribute("data-model");
      if (modelName && !visibleModels.includes(modelName)) {
        visibleModels.push(modelName);
      }
    }
  });

  // Add priority models
  for (
    let i = 0;
    i < Math.min(C.VISIBLE_PRIORITY_COUNT, portfolioItems.length);
    i++
  ) {
    const modelName = portfolioItems[i]?.getAttribute("data-model");
    if (modelName && !visibleModels.includes(modelName)) {
      visibleModels.push(modelName);
    }
  }

  return visibleModels;
}

/**
 * Initialize about section canvas
 */
function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const canvas = aboutSection.querySelector(".about-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  // Set canvas dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;
  canvas.width = width;
  canvas.height = height;

  // Create and register camera
  const camera = new PerspectiveCamera(60, width / height, C.NEAR, C.FAR);
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);

  registerCamera(
    camera,
    createSimpleAutorotation(camera, new Vector3(0, 0, 0), 5, 0),
    ctx,
    {
      type: CAMERA_TYPES.ABOUT,
      elementId: aboutSection.id || "about",
      section: "about",
    },
    true
  );
}

/**
 * User interaction handler
 */
function onUserInteraction(callback) {
  document.addEventListener("mousemove", callback, { passive: true });
  document.addEventListener("mousedown", callback, { passive: true });
  document.addEventListener("touchstart", callback, { passive: true });
  document.addEventListener("keydown", callback, { passive: true });
}

/**
 * Initialize portfolio canvases
 */
function initPortfolioCanvases() {
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  if (portfolioItems.length) setupVisibleProjectCameras(portfolioItems);
}

/**
 * Setup visible project cameras with intersection observer
 */
function setupVisibleProjectCameras(portfolioItems) {
  if (!portfolioItems.length) return;

  // Schedule work when browser is idle
  const scheduleIdleWork = (callback) =>
    "requestIdleCallback" in window
      ? requestIdleCallback(callback)
      : setTimeout(callback, 1);

  // Create intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = entry.target;
        const cameraIndex = parseInt(item.dataset.cameraIndex);
        const index = Array.from(portfolioItems).indexOf(item);
        const sectionId = item.closest("section")?.id || "portfolio";

        if (entry.isIntersecting) {
          // Item is visible
          if (!isNaN(cameraIndex)) {
            // Camera exists, enable it
            enableCamera(cameraIndex);
            handleUserInteraction();
          } else {
            // Check for existing cameras in section
            const existingCameras = getCamerasBySection(sectionId);
            const hasExistingCamera = existingCameras.some((camIndex) => {
              const registry = getCameraRegistry();
              return registry.cameraData[camIndex]?.index === index;
            });

            if (!hasExistingCamera) {
              // Create new camera when idle
              scheduleIdleWork(() => {
                setupProjectCamera(item, index).then((newCameraIndex) => {
                  if (newCameraIndex !== null) {
                    item.dataset.cameraIndex = newCameraIndex;
                    enableCamera(newCameraIndex);
                    handleUserInteraction();
                  }
                });
              });
            }
          }
        } else {
          // Item not visible, disable camera
          if (!isNaN(cameraIndex)) {
            disableCamera(cameraIndex);
          }

          // Mark model as unused
          const modelName = item.getAttribute("data-model");
          if (modelName) {
            markModelUnused(modelName);
          }
        }
      });
    },
    {
      threshold: C.INTERSECTION_THRESHOLD,
      rootMargin: C.INTERSECTION_MARGIN,
    }
  );

  // Setup priority items first
  let visibleCount = 0;
  const setupPromises = [];
  const maxVisible = C.VISIBLE_PRIORITY_COUNT;

  portfolioItems.forEach((item, index) => {
    if (isElementInViewport(item) && visibleCount < maxVisible) {
      setupPromises.push(
        setupProjectCamera(item, index).then((cameraIndex) => {
          if (cameraIndex !== null) {
            item.dataset.cameraIndex = cameraIndex;
            enableCamera(cameraIndex);
          }
          return cameraIndex;
        })
      );
      visibleCount++;
    }
    observer.observe(item);
  });

  Promise.all(setupPromises).catch((err) =>
    console.warn("Priority camera setup error:", err)
  );
}

/**
 * Ensure model is loaded and added to scene
 */
async function ensureModelInScene(modelName, scene) {
  if (!modelName || !scene) return getFallbackCube();

  try {
    const model = await getModel(modelName);

    if (!model.parent) scene.add(model);

    const position = getModelPosition(modelName);
    model.position.set(position.x, position.y + 0.1, position.z);
    model.visible = true;

    if (model.scale.x < 0.5 || model.scale.x > 2) {
      model.scale.set(1, 1, 1);
    }

    model.updateMatrix();
    model.updateMatrixWorld(true);

    return model;
  } catch (error) {
    console.error(`Failed to add model ${modelName}`, error);
    const fallback = getFallbackCube();
    if (!fallback.parent) scene.add(fallback);
    return fallback;
  }
}

/**
 * Set up camera and controls for a project card
 */
async function setupProjectCamera(item, index) {
  if (!item) return null;

  // Get canvas element
  const canvas = item.querySelector(".threejs-canvas");
  if (!canvas || canvas._processed) return null;

  // Mark as processed
  canvas._processed = true;

  // Get context (attempt offscreen if available)
  let ctx,
    offscreenCanvas = null;

  try {
    if ("transferControlToOffscreen" in canvas) {
      try {
        offscreenCanvas = canvas.transferControlToOffscreen();
        ctx = offscreenCanvas.getContext("2d", sharedCanvasContextOptions);
        canvas._offscreenTransferred = true;
        canvas._offscreen = offscreenCanvas;
      } catch {
        ctx = canvas.getContext("2d", sharedCanvasContextOptions);
      }
    } else {
      ctx = canvas.getContext("2d", sharedCanvasContextOptions);
    }
  } catch {
    // Fallback
    try {
      ctx = canvas.getContext("2d", { alpha: true });
    } catch (error) {
      console.error("Canvas context error:", error);
      return null;
    }
  }

  if (!ctx) return null;

  // Set GPU acceleration hint
  canvas.style.transform = "translateZ(0)";

  // Set dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;

  if (offscreenCanvas) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  } else if (!canvas._offscreenTransferred) {
    canvas.width = width;
    canvas.height = height;
  }

  // Get model
  const modelName = item.getAttribute("data-model") || FALLBACK_CUBE_NAME;
  const model = await ensureModelInScene(modelName, projectCardScene);
  const target = model.position.clone();

  // Create camera
  const camera = new PerspectiveCamera(
    C.DEFAULT_FOV,
    width / height,
    C.NEAR,
    C.FAR
  );
  const angle = (index % 8) * (Math.PI / 4);
  const cameraDistance = C.CAMERA_DISTANCE;

  camera.position.set(
    target.x + Math.sin(angle) * cameraDistance,
    target.y + 1.0,
    target.z + Math.cos(angle) * cameraDistance
  );
  camera.lookAt(target);

  // Create controls
  let controls = null;

  try {
    patchOrbitControls();
    controls = new OrbitControls(camera, canvas);
    Object.assign(controls, orbitControlsConfig);
    controls.target.copy(target);

    const usePassive = { passive: true };
    const safeAddEvent = (type, handler) => {
      controls.addEventListener(type, handler, usePassive);
    };

    safeAddEvent("start", () => {
      canvas.style.cursor = "grabbing";
      handleUserInteraction();
    });

    safeAddEvent("end", () => {
      canvas.style.cursor = "grab";
    });

    controls.update();
  } catch (e) {
    controls = createSimpleAutorotation(camera, target, cameraDistance, index);
  }

  // Get section details
  const sectionId = item.closest("section")?.id || "portfolio";
  const elementId = item.id || `portfolio-item-${index}`;
  const isVisible = isElementInViewport(item);

  // Register camera
  try {
    const cameraIndex = registerCamera(
      camera,
      controls,
      ctx,
      {
        type: CAMERA_TYPES.PROJECT,
        section: sectionId,
        modelName,
        elementId,
        index,
        visible: isVisible,
      },
      isVisible
    );

    // Initial render if visible
    if (renderer && isVisible) {
      renderer.setSize(width, height, false);
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.scissorTest = true;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.clear();
      renderer.render(projectCardScene, camera);

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        renderer.domElement,
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
        0,
        0,
        width,
        height
      );
    }

    return cameraIndex;
  } catch (e) {
    console.error("Camera registration error:", e);
    return null;
  }
}

/**
 * Main animation loop with performance optimizations
 */
function animate(timestamp) {
  if (!isAnimating) return;

  const deltaTime = timestamp - lastRenderTime;
  const frameDelay = isIdle() ? C.IDLE_FRAME_INTERVAL : C.FRAME_INTERVAL;

  if (deltaTime < frameDelay) {
    requestNextFrame();
    return;
  }

  lastRenderTime = timestamp;

  try {
    updateActiveControls(timestamp);

    // Check WebGL context
    const context = renderer?.getContext?.();
    if (!context || context.isContextLost()) {
      recoverRenderer();
    } else {
      renderActiveCameras(renderer, projectCardScene);
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
 * Patch OrbitControls with enhanced functionality
 */
function patchOrbitControls() {
  if (OrbitControls.prototype._patched) return OrbitControls;

  OrbitControls.prototype._patched = true;

  // Add _initListeners helper method
  OrbitControls.prototype._initListeners = function () {
    this._listeners = {
      start: new Set(),
      end: new Set(),
      change: new Set(),
      control: new Set(),
    };
  };

  // Patch methods with safety wrappers
  const methods = {
    onMouseDown(event) {
      if (!this._listeners) this._initListeners();
      this._dragging = true;
      this._lastDragTime = performance.now();
      handleUserInteraction();
    },
    onMouseUp() {
      this._dragging = false;
    },
    onMouseMove(event) {
      const now = performance.now();
      if (this._lastMoveTime && now - this._lastMoveTime <= 16)
        event.preventDefault();
      this._lastMoveTime = now;
      if (this._dragging) this._lastDragTime = now;
    },
    onTouchStart(event) {
      if (!this._listeners) this._initListeners();
      this._dragging = true;
      this._lastDragTime = performance.now();
      handleUserInteraction();
    },
    onTouchEnd() {
      this._dragging = false;
    },
    onTouchMove(event) {
      const now = performance.now();
      if (!this._lastMoveTime || now - this._lastMoveTime > 16) {
        this._lastMoveTime = now;
        this._lastDragTime = now;
      } else {
        event.preventDefault();
      }
    },
  };

  // Apply patches
  Object.entries(methods).forEach(([key, fn]) => {
    const original = OrbitControls.prototype[key];
    OrbitControls.prototype[key] = function (event) {
      fn.call(this, event);
      if (original) original.call(this, event);
    };
  });

  // Safer event handling
  OrbitControls.prototype.addEventListener = function (type, listener) {
    if (!this._listeners) this._initListeners();
    this._listeners[type]?.add(listener);
  };

  OrbitControls.prototype.removeEventListener = function (type, listener) {
    this._listeners?.[type]?.delete(listener);
  };

  OrbitControls.prototype.dispatchEvent = function (e) {
    if (!e?.type || !this._listeners?.[e.type]) return false;

    e.target = this;
    Array.from(this._listeners[e.type]).forEach((fn) => {
      if (typeof fn === "function") {
        try {
          fn.call(this, e);
        } catch {}
      }
    });

    return true;
  };

  const originalDispose = OrbitControls.prototype.dispose || function () {};
  OrbitControls.prototype.dispose = function () {
    originalDispose.call(this);
    if (this._listeners) {
      Object.keys(this._listeners).forEach((type) => {
        this._listeners[type].clear();
      });
      this._listeners = null;
    }
  };

  return OrbitControls;
}

/**
 * Game view rendering and management
 */
export function startGameRendering() {
  if (!renderer || !gameScene || !thirdPersonCamera) return;

  mainGameCanvasContext = mainGameCanvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
  });

  if (!mainGameCanvasContext) return;

  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0) {
    const container = document.getElementById("game-view-container");
    mainGameCanvas.width = container.clientWidth || 1;
    mainGameCanvas.height = container.clientHeight || 1;
  }

  renderer.setSize(mainGameCanvas.width, mainGameCanvas.height, false);
  handleUserInteraction();
  isGameViewActive = true;
  renderGameView();
}

export function stopGameRendering() {
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }
}

export function renderGameView() {
  if (!isGameViewActive) return;

  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0) {
    const container = document.getElementById("game-view-container");
    mainGameCanvas.width = container.clientWidth || 1;
    mainGameCanvas.height = container.clientHeight || 1;
    renderer.setSize(mainGameCanvas.width, mainGameCanvas.height, false);
  }

  renderer.render(gameScene, thirdPersonCamera);

  const w = mainGameCanvas.width;
  const h = mainGameCanvas.height;
  mainGameCanvasContext.clearRect(0, 0, w, h);
  mainGameCanvasContext.drawImage(renderer.domElement, 0, 0);

  const frameDelay = isIdle() ? C.IDLE_FRAME_INTERVAL : C.FRAME_INTERVAL;

  gameAnimationFrameId = setTimeout(() => {
    gameAnimationFrameId = requestAnimationFrame(renderGameView);
  }, frameDelay);
}

export function setupGameCanvasResize() {
  if (!mainGameCanvas) return;

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  const container = document.getElementById("game-view-container");
  resizeObserver = new ResizeObserver(
    debounce(() => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;

      if (mainGameCanvas.width !== width || mainGameCanvas.height !== height) {
        mainGameCanvas.width = width;
        mainGameCanvas.height = height;

        if (thirdPersonCamera) {
          thirdPersonCamera.aspect = width / height;
          thirdPersonCamera.updateProjectionMatrix();
        }

        if (renderer) {
          renderer.setSize(width, height, false);
        }

        if (isGameViewActive) {
          renderGameView();
        }
      }
    }, 100)
  );

  resizeObserver.observe(container);
}

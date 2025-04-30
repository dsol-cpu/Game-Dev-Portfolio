/**
 * @fileoverview Three.js scene and object management system
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

import {
  CAMERA_TYPES,
  initCameraRegistry,
  registerCamera,
  getCameraRegistry,
  updateActiveControls,
  renderActiveCameras,
  createSimpleAutorotation,
  activateAllCameras,
} from "./camera-registry.js";

import {
  initUserInteraction,
  handleUserInteraction,
  isIdle,
  onUserInteraction,
} from "../user-interaction.js";

import { detectLowEndDevice } from "../utils/device.js";
import { debounce } from "../utils/helper.js";
import { isBitSet } from "../utils/bit-array.js";

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

// Centralize all constants
const CONSTANTS = {
  MS_IN_SECOND: 1000,
  TARGET_FRAMERATE: 60,
  IDLE_FRAMERATE: 8,
  VISIBLE_PRIORITY_COUNT: 6,
  DEFAULT_CAMERA_FOV: 75,
  DEFAULT_CAMERA_NEAR: 0.1,
  DEFAULT_CAMERA_FAR: 1000,
  CAMERA_DISTANCE: 10,
  MIN_CAMERA_DISTANCE: 1.5,
  MAX_CAMERA_DISTANCE: 8,
  DEFAULT_CANVAS_WIDTH: 300,
  DEFAULT_CANVAS_HEIGHT: 200,
  INTERSECTION_THRESHOLD: 0.1,
  INTERSECTION_MARGIN: "150px",
  AUTO_ROTATE_SPEED: 2.0,
};

// Pre-calculate derived constants
CONSTANTS.FRAME_INTERVAL = CONSTANTS.MS_IN_SECOND / CONSTANTS.TARGET_FRAMERATE;
CONSTANTS.IDLE_FRAME_INTERVAL =
  CONSTANTS.MS_IN_SECOND / CONSTANTS.IDLE_FRAMERATE;

// Global state
let isAnimating = false,
  lastRenderTime = 0,
  isGameViewActive = false,
  resizeObserver = null;
const isLowEndDevice = detectLowEndDevice();

// Three.js variables
let renderer = null,
  stats = null,
  gameScene = null,
  projectCardScene = null,
  thirdPersonCamera = null;
let OrbitControls = null,
  mainGameCanvas = null,
  mainGameCanvasContext = null,
  gameAnimationFrameId = null;

// Performance monitoring
let frameCounter = 0,
  lastFPSUpdate = 0,
  fpsValue = 0;

// Shared objects
let sharedLights = {
  ambientLight: null,
  directionalLight1: null,
  directionalLight2: null,
};

// Shared ControlsConfig for OrbitControls
const orbitControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  autoRotate: true,
  autoRotateSpeed: CONSTANTS.AUTO_ROTATE_SPEED,
  enableZoom: true,
  minDistance: CONSTANTS.MIN_CAMERA_DISTANCE,
  maxDistance: CONSTANTS.MAX_CAMERA_DISTANCE,
};

/**
 * Create shared lights that can be cloned for different scenes
 */
function initSharedLights() {
  // Create lights once
  sharedLights.ambientLight = new AmbientLight(0xffffff, 0.7);

  sharedLights.directionalLight1 = new DirectionalLight(0xffffff, 0.8);
  sharedLights.directionalLight1.position.set(1, 1, 1);
  sharedLights.directionalLight1.castShadow = false;

  sharedLights.directionalLight2 = new DirectionalLight(0xffffff, 0.4);
  sharedLights.directionalLight2.position.set(-1, 0.5, -1);
}

/**
 * Clone a shared light for use in a new scene
 * @param {string} lightType - The type of light to clone
 * @param {Object} options - Optional intensity override
 * @returns {Object} - Cloned light
 */
function getClonedLight(lightType, options = {}) {
  if (!sharedLights[lightType]) return null;

  const original = sharedLights[lightType];
  const cloned = original.clone();

  // Apply overrides if provided
  if (options.intensity !== undefined) {
    cloned.intensity = options.intensity;
  }

  return cloned;
}

/**
 * Initialize Three.js renderer and scenes with optimizations
 */
export function initThreeJS() {
  if (renderer) {
    console.warn("Three.js is already initialized");
    return;
  }

  console.log("Initializing Three.js");

  renderer = new WebGLRenderer({
    powerPreference: isLowEndDevice ? "low-power" : "high-performance",
    precision: isLowEndDevice ? "lowp" : "mediump",
    antialias: !isLowEndDevice,
    alpha: true,
    preserveDrawingBuffer: true,
    premultipliedAlpha: true,
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: false,
  });

  // Set up WebGL context event listeners
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      isAnimating = false;
      console.warn("WebGL context lost. Attempting to restore...");
    },
    false
  );

  renderer.domElement.addEventListener(
    "webglcontextrestored",
    () => {
      console.log("WebGL context restored.");
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
  renderer.setSize(
    CONSTANTS.DEFAULT_CANVAS_WIDTH,
    CONSTANTS.DEFAULT_CANVAS_HEIGHT,
    false
  );
  renderer.shadowMap.enabled = !isLowEndDevice;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.info.autoReset = false;

  // Initialize shared resources
  initSharedLights();

  // Initialize systems
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

  // Get visible project models
  const visibleProjects = getVisibleProjectModels();

  // Create a loading sequence
  const initSequence = async () => {
    try {
      await preloadProjectModels(visibleProjects.slice(0, 3), visibleProjects);
      initAboutCanvas();
      initPortfolioCanvases();
      activateAllCameras();
      isAnimating = true;
      requestAnimationFrame(animate);
      return preloadProjectModels(visibleProjects.slice(3), visibleProjects);
    } catch (error) {
      console.error("Error in initialization sequence:", error);
    }
  };

  initSequence();
  if (process.env.NODE_ENV === "development") initPerformanceMonitoring();
}

/**
 * Initialize performance monitoring
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
      const activeCamerasCount = countActiveCameras();
      stats.textContent = `
        FPS: ${fpsValue.toFixed(0)}
        Draw calls: ${renderer.info.render.calls}
        Geometries: ${renderer.info.memory.geometries}
        Textures: ${renderer.info.memory.textures}
        Active cameras: ${activeCamerasCount}/${getCameraRegistry().count}
      `;
      renderer.info.reset();
    }
  }, CONSTANTS.MS_IN_SECOND);
}

/**
 * Count active cameras based on bitmask
 */
function countActiveCameras() {
  const registry = getCameraRegistry();
  if (!registry.activeCamBitmask) return 0;

  let count = 0;
  for (let i = 0; i < registry.count; i++) {
    if (isBitSet(registry.activeCamBitmask, i)) count++;
  }
  return count;
}

/**
 * Update FPS counter
 */
function updateFPS(timestamp) {
  frameCounter++;
  const elapsedTime = timestamp - lastFPSUpdate;
  if (elapsedTime >= CONSTANTS.MS_IN_SECOND) {
    fpsValue = frameCounter / (elapsedTime / CONSTANTS.MS_IN_SECOND);
    frameCounter = 0;
    lastFPSUpdate = timestamp;
  }
}

/**
 * Initialize game scene
 */
function initGameScene() {
  gameScene = new Scene();
  gameScene.background = null;

  // Add lighting using shared lights
  gameScene.add(getClonedLight("ambientLight"));
  gameScene.add(getClonedLight("directionalLight1"));

  // Set up camera
  thirdPersonCamera = new PerspectiveCamera(
    CONSTANTS.DEFAULT_CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CONSTANTS.DEFAULT_CAMERA_NEAR,
    CONSTANTS.DEFAULT_CAMERA_FAR
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
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  projectCardScene = new Scene();
  projectCardScene.background = null;

  // Add lighting using shared lights
  projectCardScene.add(getClonedLight("ambientLight", { intensity: 0.8 }));
  projectCardScene.add(getClonedLight("directionalLight1", { intensity: 0.6 }));
  projectCardScene.add(getClonedLight("directionalLight2"));

  // Add fallback cube
  projectCardScene.add(getFallbackCube());

  // Get model names and calculate positions
  const modelNames = Array.from(portfolioItems)
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

  // Add models from visible items
  portfolioItems.forEach((item) => {
    if (isElementInViewport(item)) {
      const modelName = item.getAttribute("data-model");
      if (modelName && !visibleModels.includes(modelName)) {
        visibleModels.push(modelName);
      }
    }
  });

  // Include models for first few items regardless of visibility
  for (
    let i = 0;
    i < Math.min(CONSTANTS.VISIBLE_PRIORITY_COUNT, portfolioItems.length);
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
 * Initialize about me section canvas
 */
function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const canvas = aboutSection.querySelector(".about-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  // Set canvas dimensions
  const width = canvas.clientWidth || CONSTANTS.DEFAULT_CANVAS_WIDTH;
  const height = canvas.clientHeight || CONSTANTS.DEFAULT_CANVAS_HEIGHT;
  canvas.width = width;
  canvas.height = height;

  // Create camera
  const camera = new PerspectiveCamera(
    60,
    width / height,
    CONSTANTS.DEFAULT_CAMERA_NEAR,
    CONSTANTS.DEFAULT_CAMERA_FAR
  );
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
 * Initialize portfolio canvases
 */
function initPortfolioCanvases() {
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  if (!portfolioItems.length) return;
  setupVisibleProjectCameras(portfolioItems);
}

/**
 * Setup visible project cameras with intersection observer
 */
function setupVisibleProjectCameras(portfolioItems) {
  if (!portfolioItems.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = entry.target;
        const index = Array.from(portfolioItems).indexOf(item);
        const portfolioSection = item.closest("section");
        const sectionId = portfolioSection?.id || "portfolio";

        if (entry.isIntersecting) {
          const existingCameras = getCamerasBySection(sectionId);
          const existingCamera = existingCameras.some((cameraIndex) => {
            const registry = getCameraRegistry();
            return registry.cameraData[cameraIndex]?.index === index;
          });

          if (!existingCamera) {
            requestIdleCallback(() => setupProjectCamera(item, index));
          }
        } else {
          const modelName = item.getAttribute("data-model");
          if (modelName) markModelUnused(modelName);
        }
      });
    },
    {
      threshold: CONSTANTS.INTERSECTION_THRESHOLD,
      rootMargin: CONSTANTS.INTERSECTION_MARGIN,
    }
  );

  // Process items - immediately setup visible ones, observe others
  let visibleCount = 0;
  const setupPromises = [];

  portfolioItems.forEach((item, index) => {
    if (
      isElementInViewport(item) &&
      visibleCount < CONSTANTS.VISIBLE_PRIORITY_COUNT
    ) {
      setupPromises.push(setupProjectCamera(item, index));
      visibleCount++;
    }
    observer.observe(item);
  });

  Promise.all(setupPromises).catch((err) =>
    console.warn("Error setting up priority cameras:", err)
  );
}

/**
 * Get cameras by section ID
 */
function getCamerasBySection(sectionId) {
  if (!sectionId) return [];

  const registry = getCameraRegistry();
  const indices = [];

  for (let i = 0; i < registry.count; i++) {
    const data = registry.cameraData[i];
    if (data && data.section === sectionId) indices.push(i);
  }

  return indices;
}

/**
 * Ensure model is loaded and added to scene
 */
async function ensureModelInScene(modelName, scene) {
  if (!modelName || !scene) return getFallbackCube();

  try {
    const model = await getModel(modelName);

    if (!model.parent) {
      scene.add(model);
    }

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
    console.error(`Failed to add model ${modelName} to scene`, error);
    const fallback = getFallbackCube();
    if (!fallback.parent) scene.add(fallback);
    return fallback;
  }
}

// Shared 2D context options for performance
const sharedCanvasContextOptions = {
  alpha: true,
  desynchronized: true,
  willReadFrequently: false,
};

/**
 * Set up camera and controls for a project card
 */
async function setupProjectCamera(item, index) {
  if (!item) return;

  const canvas = item.querySelector(".threejs-canvas");
  if (canvas?._offscreenTransferred) return;

  let ctx;
  let offscreenCanvas = null;

  try {
    if (!("transferControlToOffscreen" in canvas)) {
      ctx = canvas.getContext("2d", sharedCanvasContextOptions);
    } else {
      offscreenCanvas = canvas.transferControlToOffscreen();
      ctx = offscreenCanvas.getContext("2d", sharedCanvasContextOptions);
      canvas._offscreenTransferred = true;
      canvas._offscreen = offscreenCanvas;
    }
  } catch (e) {
    console.log(e);
    ctx = canvas.getContext("2d", sharedCanvasContextOptions);
  }

  if (!ctx) return;

  canvas.style.transform = "translateZ(0)";

  const width = canvas.clientWidth || CONSTANTS.DEFAULT_CANVAS_WIDTH;
  const height = canvas.clientHeight || CONSTANTS.DEFAULT_CANVAS_HEIGHT;

  if (offscreenCanvas) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  } else if (!canvas._offscreenTransferred) {
    canvas.width = width;
    canvas.height = height;
  }

  const modelName = item.getAttribute("data-model") || FALLBACK_CUBE_NAME;
  const model = await ensureModelInScene(modelName, projectCardScene);
  const target = model.position.clone();

  const camera = new PerspectiveCamera(
    CONSTANTS.DEFAULT_CAMERA_FOV,
    width / height,
    CONSTANTS.DEFAULT_CAMERA_NEAR,
    CONSTANTS.DEFAULT_CAMERA_FAR
  );

  const angle = (index % 8) * (Math.PI / 4);
  const cameraDistance = CONSTANTS.CAMERA_DISTANCE;

  camera.position.set(
    target.x + Math.sin(angle) * cameraDistance,
    target.y + 1.0,
    target.z + Math.cos(angle) * cameraDistance
  );
  camera.lookAt(target);

  // Load OrbitControls only once
  if (!OrbitControls) {
    try {
      OrbitControls = await loadAndPatchOrbitControls();
    } catch (e) {
      console.error("Failed to load OrbitControls:", e);
    }
  }

  let controls;
  try {
    if (OrbitControls) {
      controls = new OrbitControls(camera, canvas);

      // Apply shared configuration
      Object.assign(controls, orbitControlsConfig);
      controls.target.copy(target);

      const usePassive = { passive: true };
      controls.addEventListener(
        "start",
        () => {
          canvas.style.cursor = "grabbing";
          handleUserInteraction();
        },
        usePassive
      );

      controls.addEventListener(
        "end",
        () => {
          canvas.style.cursor = "grab";
        },
        usePassive
      );

      controls.update();
    } else {
      controls = createSimpleAutorotation(
        camera,
        target,
        cameraDistance,
        index
      );
    }
  } catch (e) {
    console.log(e);
    controls = createSimpleAutorotation(camera, target, cameraDistance, index);
  }

  const portfolioSection = item.closest("section");
  const sectionId = portfolioSection?.id || "portfolio";

  const cameraIndex = registerCamera(
    camera,
    controls,
    ctx,
    {
      type: CAMERA_TYPES.PROJECT,
      section: sectionId,
      modelName,
      elementId: item.id || `portfolio-item-${index}`,
      index,
      visible: isElementInViewport(item),
    },
    true
  );

  if (renderer) {
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
}

/**
 * Animation loop
 */
function animate(timestamp) {
  if (!isAnimating) return;

  const deltaTime = timestamp - lastRenderTime;
  const frameDelay = isIdle()
    ? CONSTANTS.IDLE_FRAME_INTERVAL
    : CONSTANTS.FRAME_INTERVAL;

  if (deltaTime >= frameDelay) {
    lastRenderTime = timestamp;
    updateActiveControls(timestamp);
    renderActiveCameras(renderer, projectCardScene);

    if (process.env.NODE_ENV === "development") {
      updateFPS(timestamp);
      renderer?.info?.reset();
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Load and patch OrbitControls with memory management
 */
let orbitControlsPromise = null;

async function loadAndPatchOrbitControls() {
  if (OrbitControls) return OrbitControls;

  if (!orbitControlsPromise) {
    orbitControlsPromise = import("../extern/three/OrbitControls.js").then(
      ({ OrbitControls: OC }) => {
        if (!OC.prototype._patched) {
          OC.prototype._patched = true;
          OC.prototype._listeners = OC.prototype._listeners || {};

          const originalOnMouseDown = OC.prototype.onMouseDown;
          OC.prototype.onMouseDown = function (event) {
            this._dragging = true;
            this._lastDragTime = performance.now();
            handleUserInteraction();
            if (originalOnMouseDown) originalOnMouseDown.call(this, event);
          };

          const originalOnMouseUp = OC.prototype.onMouseUp;
          OC.prototype.onMouseUp = function (event) {
            this._dragging = false;
            if (originalOnMouseUp) originalOnMouseUp.call(this, event);
          };

          const originalOnMouseMove = OC.prototype.onMouseMove;
          OC.prototype.onMouseMove = function (event) {
            const now = performance.now();
            if (this._lastMoveTime && now - this._lastMoveTime <= 16)
              event.preventDefault();
            this._lastMoveTime = now;
            if (this._dragging) this._lastDragTime = now;
            if (originalOnMouseMove) originalOnMouseMove.call(this, event);
          };

          const originalOnTouchStart = OC.prototype.onTouchStart;
          OC.prototype.onTouchStart = function (event) {
            this._dragging = true;
            this._lastDragTime = performance.now();
            handleUserInteraction();
            if (originalOnTouchStart) originalOnTouchStart.call(this, event);
          };

          const originalOnTouchEnd = OC.prototype.onTouchEnd;
          OC.prototype.onTouchEnd = function (event) {
            this._dragging = false;
            if (originalOnTouchEnd) originalOnTouchEnd.call(this, event);
          };

          const originalOnTouchMove = OC.prototype.onTouchMove;
          OC.prototype.onTouchMove = function (event) {
            const now = performance.now();
            if (!this._lastMoveTime || now - this._lastMoveTime > 16) {
              this._lastMoveTime = now;
              this._lastDragTime = now;
              if (originalOnTouchMove) originalOnTouchMove.call(this, event);
            } else {
              event.preventDefault();
            }
          };

          OC.prototype.addEventListener = function (type, listener) {
            if (!this._listeners[type]) this._listeners[type] = new Set();
            this._listeners[type].add(listener);
          };

          OC.prototype.removeEventListener = function (type, listener) {
            if (this._listeners[type]) this._listeners[type].delete(listener);
          };

          OC.prototype.dispatchEvent = function (e) {
            if (!this._listeners?.[e?.type]) return false;
            e.target = this;
            this._listeners[e.type].forEach((fn) => fn.call(this, e));
            return true;
          };

          const originalDispose = OC.prototype.dispose || function () {};
          OC.prototype.dispose = function () {
            originalDispose.call(this);
            this._listeners = {};
          };
        }
        return OC;
      }
    );
  }

  return orbitControlsPromise;
}

/**
 * Check if element is in viewport
 */
export function isElementInViewport(el) {
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.top <= windowHeight &&
    rect.bottom >= 0 &&
    rect.left <= windowWidth &&
    rect.right >= 0
  );
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

  onIdleStateChange((idle) => {
    if (isGameViewActive) renderGameView();
  });
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

  const frameDelay = isIdle()
    ? CONSTANTS.IDLE_FRAME_INTERVAL
    : CONSTANTS.FRAME_INTERVAL;

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

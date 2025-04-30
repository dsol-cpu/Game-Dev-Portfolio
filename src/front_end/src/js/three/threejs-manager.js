/**
 * @fileoverview Three.js initialization and core rendering.
 * Handles renderer setup, scene creation, camera management, and animation loop.
 * @author David Solinsky
 * @version 2.1.0
 */

import {
  initUserInteraction,
  handleUserInteraction,
  isIdle,
  onUserInteraction,
  onIdleStateChange,
} from "../user-interaction.js";

// Import only what we need from Three.js
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  PCFSoftShadowMap,
} from "../extern/three/three.module.min.js";

import { detectLowEndDevice } from "../utils/device.js";
import {
  initCameraRegistry,
  registerCamera,
  getCamerasBySection,
  updateActiveControls,
  renderActiveCameras,
  createSimpleAutorotation,
  activateAllCameras,
} from "./camera-registry.js";

import { debounce } from "../utils/helper.js";

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
const TARGET_FRAMERATE = 60;
const IDLE_FRAMERATE = 15; // Lower framerate for when no interaction is happening
const FRAME_INTERVAL = 1000 / TARGET_FRAMERATE;
const IDLE_FRAME_INTERVAL = 1000 / IDLE_FRAMERATE;
const MAX_CAMERAS = 16;
const VISIBLE_PRIORITY_COUNT = 6;

// Global state
let isAnimating = false;
let lastRenderTime = 0;
let isGameViewActive = false;
let lastInteractionTime = 0;
let userActive = false;
let resizeObserver = null;
let visibleSections = new Set();
const isLowEndDevice = detectLowEndDevice();

// Three.js variables
let renderer = null;
let info = null;
let thirdPersonCamera = null;
let gameScene = null;
let projectCardScene = null;
let OrbitControls = null;
let mainGameCanvas = null;
let mainGameCanvasContext = null;
let gameAnimationFrameId = null;

// Performance monitoring
let frameCounter = 0;
let lastFPSUpdate = 0;
let fpsValue = 0;

/**
 * Initialize Three.js renderer and scenes with optimizations
 */
export function initThreeJS() {
  // Check if we've already initialized
  if (renderer) {
    console.warn("Three.js is already initialized");
    return;
  }

  console.log("Initializing Three.js");

  // Initialize renderer with dynamic performance optimizations
  renderer = new WebGLRenderer({
    powerPreference: isLowEndDevice ? "low-power" : "high-performance",
    precision: isLowEndDevice ? "lowp" : "mediump",
    antialias: !isLowEndDevice, // No antialias on low end
    alpha: true, // Enable alpha for transparent background
    preserveDrawingBuffer: true, // Needed for canvas copying
    premultipliedAlpha: true, // Better alpha blending
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: false, // Don't fail on low performance devices
  });

  info = renderer.info;

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

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(
    isLowEndDevice ? 1 : Math.min(window.devicePixelRatio, 2)
  );
  renderer.setSize(300, 200, false);
  renderer.shadowMap.enabled = !isLowEndDevice;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.info.autoReset = false;

  // Initialize user interaction
  initUserInteraction();

  // Register animation restart callback
  onUserInteraction(() => {
    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(animate);
    }
  });

  // Initialize camera registry with more cameras
  initCameraRegistry(MAX_CAMERAS);

  // Initialize model manager
  initModelManager();

  // Initialize scenes
  initGameScene();
  initProjectCardScene();

  // Get visible project models and preload them first
  const visibleProjects = getVisibleProjectModels();

  // Create a loading sequence with proper initialization order
  const initSequence = async () => {
    try {
      console.log("Starting initialization sequence");

      // First, load priority models (visible ones)
      await preloadProjectModels(visibleProjects.slice(0, 3), visibleProjects);
      console.log("Priority models loaded");

      //Initialize About Me Section canvas
      initAboutCanvas();
      console.log("About section canvas initialized");

      // Then initialize portfolio canvases
      initPortfolioCanvases();
      console.log("Portfolio canvases initialized");

      // Make sure all cameras are active
      activateAllCameras();

      // Start animation loop
      isAnimating = true;
      requestAnimationFrame(animate);
      console.log("Animation loop started");

      // Preload remaining models during idle time
      return preloadProjectModels(visibleProjects.slice(3), visibleProjects);
    } catch (error) {
      console.error("Error in initialization sequence:", error);
    }
  };

  // Start the initialization sequence
  initSequence();

  if (process.env.NODE_ENV === "development") {
    initPerformanceMonitoring();
  }
}

/**
 * Initialize performance monitoring
 */
function initPerformanceMonitoring() {
  const stats = document.createElement("div");
  stats.style.position = "fixed";
  stats.style.top = "0";
  stats.style.right = "0";
  stats.style.backgroundColor = "rgba(0,0,0,0.5)";
  stats.style.color = "white";
  stats.style.padding = "5px";
  stats.style.fontSize = "12px";
  stats.style.fontFamily = "monospace";
  stats.style.zIndex = "9999";
  document.body.appendChild(stats);

  setInterval(() => {
    if (renderer) {
      stats.textContent = `
            FPS: ${fpsValue.toFixed(0)}
            Draw calls: ${info.render.calls}
            Geometries: ${info.memory.geometries}
            Textures: ${info.memory.textures}
          `;
      info.reset();
    }
  }, 1000);
}

/**
 * Update FPS counter
 */
function updateFPS(timestamp) {
  frameCounter++;

  const elapsedTime = timestamp - lastFPSUpdate;

  // Update FPS counter if 1 second has passed or more
  if (elapsedTime >= 1000) {
    fpsValue = frameCounter / (elapsedTime / 1000); // Calculate FPS as frames per second
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

  // Add lighting - simpler lighting for performance
  const ambientLight = new AmbientLight(0xffffff, 0.7);
  gameScene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = false; // Only enable when needed
  gameScene.add(directionalLight);

  // Set up camera
  thirdPersonCamera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 0, 0);
}

/**
 * Initialize project card scene with improved model handling
 */
function initProjectCardScene() {
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  projectCardScene = new Scene();
  projectCardScene.background = null;

  console.log(`Found ${portfolioItems.length} portfolio items`);

  // Add improved lighting for better visibility
  const ambientLight = new AmbientLight(0xffffff, 0.8); // Brighter ambient light
  projectCardScene.add(ambientLight);

  // Add two directional lights for better model visibility
  const dirLight1 = new DirectionalLight(0xffffff, 0.6);
  dirLight1.position.set(1, 1, 1);
  projectCardScene.add(dirLight1);

  const dirLight2 = new DirectionalLight(0xffffff, 0.4);
  dirLight2.position.set(-1, 0.5, -1);
  projectCardScene.add(dirLight2);

  // Add fallback cube to scene
  const fallbackCube = getFallbackCube();
  projectCardScene.add(fallbackCube);
  console.log("Added fallback cube to scene");

  // Calculate positions for models
  const modelNames = Array.from(portfolioItems)
    .map((item) => item.getAttribute("data-model"))
    .filter(Boolean);

  console.log(`Found ${modelNames.length} model names from portfolio items`);

  // Calculate grid positions for models
  calculateModelPositions(modelNames);
}

/**
 * Get models from visible project cards
 * @returns {Array} Array of model names that are currently visible
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
    i < Math.min(VISIBLE_PRIORITY_COUNT, portfolioItems.length);
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
 * Initialize about me section canvas with lazy loading
 */
function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) {
    console.warn("No about canvas found!");
  }

  console.log(`Setting up canvas for about me section`);
  const camera = getCamerasBySection();
}

/**
 * Initialize portfolio canvases with lazy loading
 */
function initPortfolioCanvases() {
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  if (!portfolioItems.length) {
    console.warn("No portfolio items found");
    return;
  }

  console.log(
    `Setting up canvases for ${portfolioItems.length} portfolio items`
  );

  // Set up intersection observer for lazy loading
  setupVisibleProjectCameras(portfolioItems);
}

/**
 * Setup visible project cameras with improved intersection observer
 */
function setupVisibleProjectCameras(portfolioItems) {
  if (!portfolioItems.length) return;

  // Setup intersectionObserver for lazy loading cameras
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = entry.target;
        const index = Array.from(portfolioItems).indexOf(item);
        const portfolioSection = item.closest("section");
        const sectionId = portfolioSection?.id || "portfolio";

        if (entry.isIntersecting) {
          // Check if camera already exists
          const existingCameras = getCamerasBySection(sectionId);
          const existingCamera = existingCameras.some(
            (camera) => camera.metadata?.index === index
          );

          if (!existingCamera) {
            // Use requestIdleCallback for non-critical setup
            requestIdleCallback(() => {
              setupProjectCamera(item, index);
            });
          }
        } else {
          // When item is out of view, mark associated model for potential cleanup
          const modelName = item.getAttribute("data-model");
          if (modelName) {
            markModelUnused(modelName);
          }
        }
      });
    },
    { threshold: 0.1, rootMargin: "150px" }
  );

  // Process items - immediately setup visible ones, observe others
  let visibleCount = 0;
  const setupPromises = [];

  portfolioItems.forEach((item, index) => {
    if (isElementInViewport(item) && visibleCount < VISIBLE_PRIORITY_COUNT) {
      // Setup priority visible cameras immediately and collect promises
      setupPromises.push(setupProjectCamera(item, index));
      visibleCount++;
    }
    // Observe all items for future visibility changes
    observer.observe(item);
  });

  // Wait for all priority setups to complete
  Promise.all(setupPromises).catch((err) =>
    console.warn("Error setting up priority cameras:", err)
  );
}

/**
 * Ensure model is loaded and added to scene
 * @param {string} modelName - The name of the model
 * @param {THREE.Scene} scene - The scene to add the model to
 */
async function ensureModelInScene(modelName, scene) {
  if (!modelName || !scene) return getFallbackCube();

  try {
    // First, attempt to get the model (this will either return a cached model or load it)
    const model = await getModel(modelName);

    // If model doesn't have a parent, it's not in the scene yet
    if (!model.parent) {
      scene.add(model);
      console.log(`Added model ${modelName} to scene`);
    }

    // Update position based on calculated grid
    const position = getModelPosition(modelName);

    // Set position with small Y offset to ensure model is visible
    model.position.set(position.x, position.y + 0.1, position.z);

    // Ensure model is visible
    model.visible = true;

    // Make sure model has proper scale
    if (model.scale.x < 0.5 || model.scale.x > 2) {
      model.scale.set(1, 1, 1);
    }

    // Force update matrix for correct positioning
    model.updateMatrix();
    model.updateMatrixWorld(true);

    return model;
  } catch (error) {
    console.error(`Failed to add model ${modelName} to scene`, error);

    // Use the shared fallback cube
    const fallback = getFallbackCube();

    // Make sure fallback is in scene
    if (!fallback.parent) {
      scene.add(fallback);
    }

    return fallback;
  }
}

/**
 * Set up camera and controls for a project card with memory optimizations
 */
async function setupProjectCamera(item, index) {
  if (!item) return;

  const canvas = item.querySelector(".threejs-canvas");
  if (!canvas) return;

  // Check if canvas has already been transferred to offscreen
  if (canvas._offscreenTransferred) {
    return;
  }

  // Use high-performance canvas options
  const ctxOptions = {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  };

  let ctx;
  let offscreenCanvas = null;

  // Try to use offscreen canvas if supported
  if (!window.OffscreenCanvas) ctx = canvas.getContext("2d", ctxOptions);
  try {
    offscreenCanvas = canvas.transferControlToOffscreen();
    ctx = offscreenCanvas.getContext("2d", ctxOptions);
    // Mark the original canvas as transferred
    canvas._offscreenTransferred = true;
    canvas._offscreen = offscreenCanvas;
  } catch (e) {
    console.warn("OffscreenCanvas failed, using regular canvas", e);
    ctx = canvas.getContext("2d", ctxOptions);
  }

  if (!ctx) return;

  // Mark canvas for Safari/WebKit GPU acceleration
  canvas.style.transform = "translateZ(0)";

  // Set the canvas size BEFORE transferring to offscreen
  const width = canvas.clientWidth || 300;
  const height = canvas.clientHeight || 200;

  if (offscreenCanvas) {
    // Use the offscreen canvas for size operations
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  } else if (!canvas._offscreenTransferred) {
    // Only set dimensions on the original canvas if not transferred
    canvas.width = width;
    canvas.height = height;
  }

  // Get model info and setup camera
  const modelName = item.getAttribute("data-model") || FALLBACK_CUBE_NAME;

  // Load model asynchronously and ensure it's in the scene FIRST
  const model = await ensureModelInScene(modelName, projectCardScene);

  // IMPORTANT: Get the actual position after the model is loaded
  const target = model.position.clone();

  // Create camera with proper aspect ratio
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

  // Vary the camera angle for visual interest
  const angle = (index % 8) * (Math.PI / 4);

  // Position camera to look directly at the model's center
  const cameraDistance = 10; // Reduced distance for better view
  camera.position.set(
    target.x + Math.sin(angle) * cameraDistance,
    target.y + 1.0, // Camera slightly above model
    target.z + Math.cos(angle) * cameraDistance
  );

  // Force the camera to look at the model's actual position
  camera.lookAt(target);

  // Load OrbitControls only once
  if (!OrbitControls) {
    try {
      OrbitControls = await loadAndPatchOrbitControls();
    } catch (e) {
      console.error("Failed to load OrbitControls:", e);
    }
  }

  // Create camera controls
  let controls;
  try {
    if (OrbitControls) {
      controls = new OrbitControls(camera, canvas);
      Object.assign(controls, {
        enableDamping: true,
        dampingFactor: 0.05,
        autoRotate: true,
        autoRotateSpeed: 2.0, // Ensure rotation is visible
        enableZoom: true,
        minDistance: 1.5, // Allow closer zooming
        maxDistance: 8,
      });

      // IMPORTANT: Set target to the model's actual position
      controls.target.copy(target);

      // Add event listeners with passive flag for better performance
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

      // Force control update
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
    console.warn("Using fallback controls:", e);
    controls = createSimpleAutorotation(camera, target, cameraDistance, index);
  }

  // Ensure section ID is properly obtained
  const portfolioSection = item.closest("section");
  const sectionId = portfolioSection?.id || "portfolio";

  // Register camera with improved metadata
  const cameraIndex = registerCamera(
    camera,
    controls,
    ctx,
    {
      section: sectionId,
      modelName,
      elementId: item.id || `portfolio-item-${index}`,
      index,
      visible: isElementInViewport(item),
    },
    true // Force activation regardless of viewport
  );

  // Perform initial render after model is loaded
  if (renderer) {
    // Set size specifically for this canvas
    renderer.setSize(width, height, false);

    // Force render to this canvas context
    if (projectCardScene) {
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.scissorTest = true;

      // Ensure camera aspect ratio is correct
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Clear and render
      renderer.clear();
      renderer.render(projectCardScene, camera);

      // Draw to 2D context
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
  }

  return cameraIndex;
}

/**
 * Animation loop
 */
function animate(timestamp) {
  if (!isAnimating) return;

  // Calculate time since last frame
  const deltaTime = timestamp - lastRenderTime;

  // Hard cap at 60 FPS (or lower if idle)
  const frameDelay = isIdle() ? IDLE_FRAME_INTERVAL : FRAME_INTERVAL;

  if (deltaTime >= frameDelay) {
    // Update last render time
    lastRenderTime = timestamp;

    // Update only active controls that need it
    updateActiveControls(timestamp);

    // Render cameras with the active ones first
    renderActiveCameras(renderer, projectCardScene);

    // Reset renderer info for next frame if in development
    if (process.env.NODE_ENV === "development") {
      updateFPS(timestamp);
      renderer?.info?.reset();
    }
  }

  // Schedule next frame
  requestAnimationFrame(animate);
}

/**
 * Load and patch OrbitControls with memory management
 */
let orbitControlsPromise = null;

async function loadAndPatchOrbitControls() {
  if (OrbitControls) return OrbitControls; // already loaded

  if (!orbitControlsPromise) {
    orbitControlsPromise = import("../extern/three/OrbitControls.js").then(
      ({ OrbitControls: OC }) => {
        if (!OC.prototype._patched) {
          // Add missing event dispatcher functionality
          OC.prototype._patched = true;
          OC.prototype._listeners = OC.prototype._listeners || {};

          // Track dragging state with timestamp
          const originalOnMouseDown = OC.prototype.onMouseDown;
          OC.prototype.onMouseDown = function (event) {
            this._dragging = true;
            this._lastDragTime = performance.now();
            handleUserInteraction(); // Trigger high framerate
            if (originalOnMouseDown) originalOnMouseDown.call(this, event);
          };

          const originalOnMouseUp = OC.prototype.onMouseUp;
          OC.prototype.onMouseUp = function (event) {
            this._dragging = false;
            if (originalOnMouseUp) originalOnMouseUp.call(this, event);
          };

          // Throttle mouse move events
          const originalOnMouseMove = OC.prototype.onMouseMove;
          OC.prototype.onMouseMove = function (event) {
            const now = performance.now();
            // Only process move events at most every 16ms when dragging
            if (this._lastMoveTime && now - this._lastMoveTime <= 16)
              event.preventDefault();

            this._lastMoveTime = now;
            if (this._dragging) {
              this._lastDragTime = now;
            }
            if (originalOnMouseMove) originalOnMouseMove.call(this, event);
          };

          const originalOnTouchStart = OC.prototype.onTouchStart;
          OC.prototype.onTouchStart = function (event) {
            this._dragging = true;
            this._lastDragTime = performance.now();
            handleUserInteraction(); // Trigger high framerate
            if (originalOnTouchStart) originalOnTouchStart.call(this, event);
          };

          const originalOnTouchEnd = OC.prototype.onTouchEnd;
          OC.prototype.onTouchEnd = function (event) {
            this._dragging = false;
            if (originalOnTouchEnd) originalOnTouchEnd.call(this, event);
          };

          // Throttle touch move events too
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

          // Optimized event dispatcher
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

          // Add dispose method for better memory management
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
 * Check if element is in viewport with improved calculation
 */
export function isElementInViewport(el) {
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // Element is at least partially visible
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

  // Register for idle state changes to adjust game rendering
  onIdleStateChange((idle) => {
    if (isGameViewActive) {
      // Force a new frame when idle state changes
      renderGameView();
    }
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

  // Use a clear rect with specific dimensions to avoid clearing whole canvas
  const w = mainGameCanvas.width;
  const h = mainGameCanvas.height;
  mainGameCanvasContext.clearRect(0, 0, w, h);
  mainGameCanvasContext.drawImage(renderer.domElement, 0, 0);

  // Implement adaptive frame rate for game view
  const frameDelay = isIdle() ? IDLE_FRAME_INTERVAL : FRAME_INTERVAL;

  gameAnimationFrameId = setTimeout(() => {
    gameAnimationFrameId = requestAnimationFrame(renderGameView);
  }, frameDelay);
}

export function setupGameCanvasResize() {
  if (!mainGameCanvas) return;

  // Clean up existing observer
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

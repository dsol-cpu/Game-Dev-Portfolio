/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles navigation, portfolio filtering, form submission,
 * and other UI interactions.
 * @author David Solinsky
 * @version 2.1.0
 */

// Import only what we need from Three.js
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  BoxGeometry,
  MeshNormalMaterial,
  Mesh,
  Box3,
  Vector3,
  PCFSoftShadowMap,
  LinearFilter,
} from "./extern/three/three.module.min.js";

import { detectLowEndDevice } from "./utils/device.js";
import { initBlogPosts } from "./blog.js";
import { setupBackdropListener, renderProjectsGrid } from "./project-card.js";
import { projectCardData } from "./data/project.js";
import {
  initCameraRegistry,
  registerCamera,
  setActiveCamerasBySection,
  getCamerasBySection,
  updateActiveControls,
  renderActiveCameras,
  setIdleFunction,
} from "./three/camera-registry.js";

// Constants
const TARGET_FRAMERATE = 60;
const IDLE_FRAMERATE = 15; // Lower framerate for when no interaction is happening
const FRAME_INTERVAL = 1000 / TARGET_FRAMERATE;
const IDLE_FRAME_INTERVAL = 1000 / IDLE_FRAMERATE;
const MAX_CAMERAS = 16;
const BATCH_SIZE = 3;
const VISIBLE_PRIORITY_COUNT = 6;
const GRID_SIZE = 325;
const DEFAULT_CAMERA_DISTANCE = 3;
const FALLBACK_CUBE_NAME = "fallbackCube";
const INTERACTION_TIMEOUT = 3000; // ms before switching to idle framerate
const MODEL_CLEANUP_THRESHOLD = 10000; // ms to keep unused models in memory

// Global state
let isAnimating = false;
let lastRenderTime = 0;
let isGameViewActive = false;
let lastInteractionTime = 0;
let userActive = false;
let disposedModels = new Set();
let unusedModelTimers = {};
let resizeObserver = null;

// DOM Elements
let filterButtons;
let portfolioItems;

// Three.js variables
let renderer = null;
let info = null;
let thirdPersonCamera = null;
let gameScene = null;
let projectCardScene = null;
let models = {};
let modelLoadPromises = {};
let sharedFallbackCube = null;
let GLTFLoader = null;
let OrbitControls = null;
let mainGameCanvas = null;
let mainGameCanvasContext = null;
let gameAnimationFrameId = null;
let modelPositions = {};
let visibleSections = new Set();
const isLowEndDevice = detectLowEndDevice();

// Performance monitoring
let frameCounter = 0;
let lastFPSUpdate = 0;
let fpsValue = 0;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Main initialization function
 */
function initializeApp() {
  // Start performance monitoring
  window.addEventListener("focus", () => (userActive = true));
  window.addEventListener("blur", () => (userActive = false));
  document.addEventListener("mousemove", handleUserInteraction);
  document.addEventListener("touchstart", handleUserInteraction);
  document.addEventListener("keydown", handleUserInteraction);
  document.addEventListener("scroll", handleUserInteraction);

  // Lazy initialize components
  initNavigation();
  requestIdleCallback(() => {
    initThreeJS();
    initProjectCards();
    initPortfolioFilters();
    setupBackdropListener();

    // Delay less critical initializations
    setTimeout(() => {
      initBlogPosts();
      initGameView();
      handleUserInteraction(); // Consider user active initially
    }, 100);
  });

  // Handle visibility change
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

/**
 * Track user interaction for adaptive framerate
 */
let lastInteractionCallTime = 0;
const INTERACTION_THROTTLE = 16; // ~60fps

function handleUserInteraction() {
  const now = performance.now();
  if (now - lastInteractionCallTime < INTERACTION_THROTTLE) return;

  lastInteractionCallTime = now;
  lastInteractionTime = now;

  if (!isAnimating) {
    isAnimating = true;
    requestAnimationFrame(animate);
  }
}

/**
 * Check if we should be in idle mode (lower framerate)
 */
function isIdle() {
  return (
    !userActive && performance.now() - lastInteractionTime > INTERACTION_TIMEOUT
  );
}

setIdleFunction(isIdle);

/**
 * Handle document visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    isAnimating = false;
    if (gameAnimationFrameId) {
      cancelAnimationFrame(gameAnimationFrameId);
      gameAnimationFrameId = null;
    }
  } else {
    lastRenderTime = 0;
    isAnimating = true;
    handleUserInteraction();
    requestAnimationFrame(animate);
    if (isGameViewActive) renderGameView();
  }
}

/**
 * Toggle between scroll view and game view
 */
function toggleGameView() {
  const body = document.body;
  const toggleBtn = document.getElementById("view-toggle-btn");
  const viewLabel = toggleBtn.querySelector(".view-label");

  isGameViewActive = !isGameViewActive;

  if (isGameViewActive) {
    body.classList.add("game-mode");
    viewLabel.textContent = "Game View";
    startGameRendering();
  } else {
    body.classList.remove("game-mode");
    viewLabel.textContent = "Scroll View";
    stopGameRendering();
  }

  handleUserInteraction();
}

/**
 * Resize the game canvas using ResizeObserver
 */
function setupGameCanvasResize() {
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

/**
 * Debounce function to limit function calls
 */
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Start game rendering
 */
function startGameRendering() {
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
  renderGameView();
}

/**
 * Stop game rendering
 */
function stopGameRendering() {
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }
}

/**
 * Render game view with adaptive framerate
 */
function renderGameView() {
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

/**
 * Initialize game view
 */
function initGameView() {
  const viewToggleBtn = document.getElementById("view-toggle-btn");
  mainGameCanvas = document.getElementById("main-game-canvas");

  if (viewToggleBtn && mainGameCanvas) {
    setupGameCanvasResize();
    viewToggleBtn.addEventListener("click", toggleGameView);
  }
}

/**
 * Initialize navigation with intersection observer
 */
/**
 * Initialize navigation with intersection observer
 */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  // Function to activate a specific section
  function activateSection(sectionId) {
    // Hide all sections first
    sections.forEach((section) => {
      section.classList.remove("active");
    });

    // Show the target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");

      // Update navigation active state
      navLinks.forEach((link) => {
        link.classList.toggle(
          "active",
          link.getAttribute("data-target") === sectionId
        );
      });

      // Handle cameras and other section-specific initializations
      setActiveCamerasBySection(sectionId);

      // Update visible sections tracking
      visibleSections.clear();
      visibleSections.add(sectionId);
    }
  }

  // Add click handlers for navigation
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      handleUserInteraction();

      // const targetId = this.getAttribute("data-target");
      // if (targetId) {
      // Directly activate the section instead of scrolling
      activateSection(this.getAttribute("data-target"));

      // Update URL hash for bookmarking (optional)
      // history.pushState(null, null, `${targetId}`);
      // }
    });
  });

  // Handle initial section based on URL hash or default to first section
  function handleInitialSection() {
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
      activateSection(hash);
    } else {
      // Activate first section by default
      const firstSection = sections[0];
      if (firstSection?.id) {
        activateSection(firstSection.id);
      }
    }
  }

  // Initialize on load
  handleInitialSection();

  // Handle browser back/forward navigation
  window.addEventListener("popstate", handleInitialSection);
}

/**
 * Initialize project cards
 */
function initProjectCards() {
  const portfolioGrid = document.querySelector(".portfolio-grid");
  if (!portfolioGrid) return;

  // Using the renderProjectsGrid function from project-card.js
  renderProjectsGrid(projectCardData);
}

/**
 * Initialize portfolio canvases with lazy loading
 */
function initPortfolioCanvases() {
  portfolioItems = document.querySelectorAll(".portfolio-item");
  if (!portfolioItems.length) return;

  // Set up intersection observer for lazy loading
  setupVisibleProjectCameras();
}

/**
 * Setup visible project cameras with improved intersection observer
 */
function setupVisibleProjectCameras() {
  portfolioItems = document.querySelectorAll(".portfolio-item");
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
          const existingCamera = getCamerasBySection(sectionId).includes(index);

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
  portfolioItems.forEach((item, index) => {
    if (isElementInViewport(item) && visibleCount < VISIBLE_PRIORITY_COUNT) {
      setupProjectCamera(item, index);
      visibleCount++;
    }
    observer.observe(item);
  });
}

/**
 * Mark a model as unused for potential cleanup
 */
function markModelUnused(modelName) {
  // Clear any existing timer
  if (unusedModelTimers[modelName]) {
    clearTimeout(unusedModelTimers[modelName]);
  }

  // Set timer to clean up model if it remains unused
  unusedModelTimers[modelName] = setTimeout(() => {
    if (!isModelVisible(modelName)) {
      disposeModel(modelName);
    }
  }, MODEL_CLEANUP_THRESHOLD);
}

/**
 * Check if a model is currently visible in any portfolio item
 */
function isModelVisible(modelName) {
  // Check if any visible portfolio item uses this model
  for (const item of portfolioItems) {
    if (
      isElementInViewport(item) &&
      item.getAttribute("data-model") === modelName
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Dispose of a 3D model and free memory
 */
function disposeModel(modelName) {
  if (!models[modelName] || disposedModels.has(modelName)) return;

  const model = models[modelName];

  // Remove from scene
  if (projectCardScene && model.parent === projectCardScene) {
    projectCardScene.remove(model);
  }

  // Dispose geometries and materials
  model.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            disposeMaterial(mat);
          });
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });

  // Mark as disposed but keep reference for reloading
  disposedModels.add(modelName);

  // Log memory cleanup
  console.log(`Disposed model: ${modelName}`);
}

/**
 * Dispose of a material and its textures
 */
function disposeMaterial(material) {
  if (!material) return;

  // Dispose textures
  Object.keys(material).forEach((prop) => {
    if (material[prop]?.isTexture) {
      material[prop].dispose();
    }
  });

  // Dispose material
  material.dispose();
}

/**
 * Check if element is in viewport with improved calculation
 */
function isElementInViewport(el) {
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
 * Initialize portfolio filters with performance optimizations
 */
function initPortfolioFilters() {
  filterButtons = document.querySelectorAll(".filter-button");
  portfolioItems = document.querySelectorAll(".portfolio-item");

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const filter = this.getAttribute("data-filter");
      handleUserInteraction();

      // Update active button
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Get visible indices based on filter
      const visibleIndices = [];
      portfolioItems.forEach((item, index) => {
        const categories = item.getAttribute("data-category");
        const match = filter === "all" || categories.includes(filter);

        // Update display only if necessary
        const currentDisplay = item.style.display;
        if (
          (match && currentDisplay === "none") ||
          (!match && currentDisplay !== "none")
        ) {
          item.style.display = match ? "block" : "none";
        }

        if (match) visibleIndices.push(index);
      });

      // Batch DOM updates
      requestAnimationFrame(() => {
        // Update active cameras with visible indices
        setActiveCamerasBySection("portfolio", visibleIndices);

        // Free memory for hidden models
        cleanupHiddenModels();
      });
    });
  });
}

/**
 * Clean up models that are hidden
 */
function cleanupHiddenModels() {
  // Get all visible model names
  const visibleModelNames = new Set();

  portfolioItems.forEach((item) => {
    if (item.style.display !== "none") {
      const modelName = item.getAttribute("data-model");
      if (modelName) visibleModelNames.add(modelName);
    }
  });

  // Mark unused models for potential cleanup
  Object.keys(models).forEach((modelName) => {
    if (!visibleModelNames.has(modelName)) {
      markModelUnused(modelName);
    }
  });
}

/**
 * Load a model with improved caching and error handling
 */
async function loadModel(modelName) {
  // If model was disposed, remove from disposed list
  if (disposedModels.has(modelName)) {
    disposedModels.delete(modelName);
  }

  // Return cached model if available
  if (models[modelName]) return models[modelName];
  if (modelLoadPromises[modelName]) return modelLoadPromises[modelName];

  // Load the GLTFLoader if not already loaded
  if (!GLTFLoader) {
    try {
      const module = await import("./extern/three/GLTFLoader.js");
      GLTFLoader = module.GLTFLoader;
    } catch (error) {
      console.error("Failed to load GLTFLoader:", error);
      return createFallbackCube(modelName);
    }
  }

  // Create loading promise with timeout
  const modelUrl = `/models/${modelName}.glb`;
  const loadPromise = Promise.race([
    new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          models[modelName] = model;
          setupModel(model);
          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`Model failed to load: ${modelName}`, error);
          const fallback = createFallbackCube(modelName);
          models[modelName] = fallback;
          resolve(fallback);
        }
      );
    }),
    // Timeout after 10 seconds
    new Promise((resolve) => {
      setTimeout(() => {
        if (!models[modelName]) {
          const fallback = createFallbackCube(modelName);
          models[modelName] = fallback;
          resolve(fallback);
        }
      }, 10000);
    }),
  ]);

  modelLoadPromises[modelName] = loadPromise;
  return loadPromise;
}

/**
 * Create a fallback cube for failed model loads
 */
function createFallbackCube(modelName) {
  // Create a unique fallback cube for this model
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshNormalMaterial();
  const cube = new Mesh(geometry, material);
  cube.name = `${modelName}-fallback`;

  // Position it based on the model grid
  const position = getModelPosition(modelName);
  cube.position.set(position.x, position.y, position.z);

  return cube;
}

/**
 * Optimized model cache
 */
const modelCache = new Map();

async function getModel(modelName) {
  if (modelCache.has(modelName)) return modelCache.get(modelName);

  try {
    const model = await loadModel(modelName);
    if (model) {
      modelCache.set(modelName, model);
      // Clear unused timer if it exists
      if (unusedModelTimers[modelName]) {
        clearTimeout(unusedModelTimers[modelName]);
        delete unusedModelTimers[modelName];
      }
    }
    return model;
  } catch (e) {
    console.warn(`Failed to load model: ${modelName}`, e);
    return sharedFallbackCube.clone();
  }
}

/**
 * Optimize model geometry and materials with advanced techniques
 */
function optimizeModel(model) {
  if (!model) return;

  const geometries = {};
  const materials = {};

  model.traverse((child) => {
    if (!child.isMesh) return;

    // Optimize geometry
    const geo = child.geometry;
    if (geo) {
      const geoKey = geo.uuid;
      if (geometries[geoKey]) {
        child.geometry = geometries[geoKey];
      } else if (geo.attributes?.position) {
        if (!geo.attributes?.normal) geo.computeVertexNormals();

        // Optimize buffers
        if (!geo.attributes.position.normalized) {
          geo.attributes.position.normalized = true;
        }

        // Remove unused attributes to save memory
        ["color", "uv2", "uv3"].forEach((attr) => {
          if (geo.attributes[attr] && !child.material.map) {
            geo.deleteAttribute(attr);
          }
        });

        geometries[geoKey] = geo;
      }
    }

    // Optimize material
    const material = child.material;
    if (material) {
      if (Array.isArray(material)) {
        child.material = material.map((mat) => {
          const matKey = mat?.uuid;
          if (!matKey) return mat;
          if (!materials[matKey]) {
            optimizeMaterial(mat);
            materials[matKey] = mat;
          }
          return materials[matKey];
        });
      } else {
        const matKey = material?.uuid;
        if (matKey) {
          if (!materials[matKey]) {
            optimizeMaterial(material);
            materials[matKey] = material;
          }
          child.material = materials[matKey];
        }
      }
    }

    // Optimize mesh
    child.frustumCulled = true;
    child.matrixAutoUpdate = true;
    child.matrixWorldAutoUpdate = false;
  });
}

/**
 * Optimize individual material properties
 */
function optimizeMaterial(material) {
  if (!material) return;

  // Performance optimizations
  material.precision = "lowp"; // lower shader precision
  material.fog = false; // disable fog calculations

  // Reduce texture quality if needed
  if (material.map) {
    material.map.anisotropy = 1;
    material.map.minFilter = LinearFilter;
    material.map.generateMipmaps = false;
  }
}

/**
 * Load models in batches with priority and scheduling
 */
async function preloadProjectModels(priorityModels = []) {
  const allModelNames = [
    ...new Set(projectCardData.map((item) => item.modelName).filter(Boolean)),
  ];

  if (allModelNames.length === 0) return;

  // Create load queue with priority models first
  const loadQueue = [
    ...priorityModels.filter((name) => allModelNames.includes(name)),
    ...allModelNames.filter((name) => !priorityModels.includes(name)),
  ];

  // Load in batches using requestIdleCallback for background loading
  const loadBatch = async (startIndex) => {
    const batch = loadQueue.slice(startIndex, startIndex + BATCH_SIZE);
    if (batch.length === 0) return;

    try {
      await Promise.allSettled(batch.map((name) => loadModel(name)));

      // Schedule next batch during idle time
      if (startIndex + BATCH_SIZE < loadQueue.length) {
        if (window.requestIdleCallback) {
          requestIdleCallback(() => loadBatch(startIndex + BATCH_SIZE));
        } else {
          setTimeout(() => loadBatch(startIndex + BATCH_SIZE), 100);
        }
      }
    } catch (error) {
      console.error("Error loading model batch:", error);
    }
  };

  // Start loading priority models immediately
  const priorityBatchSize = Math.min(BATCH_SIZE, priorityModels.length);
  await loadBatch(0);

  // Schedule remaining models for idle time
  if (loadQueue.length > priorityBatchSize) {
    if (window.requestIdleCallback) {
      requestIdleCallback(() => loadBatch(priorityBatchSize));
    } else {
      setTimeout(() => loadBatch(priorityBatchSize), 100);
    }
  }
}

/**
 * Initialize Three.js renderer and scenes with optimizations
 */
function initThreeJS() {
  // Initialize renderer with dynamic performance optimizations
  renderer = new WebGLRenderer({
    powerPreference: isLowEndDevice ? "low-power" : "high-performance",
    precision: isLowEndDevice ? "lowp" : "mediump",
    antialias: !isLowEndDevice, // No antialias on low end
    alpha: false,
    preserveDrawingBuffer: isLowEndDevice ? false : true,
    premultipliedAlpha: false,
    stencil: false,
    depth: true,
    failIfMajorPerformanceCaveat: true, // Force fail if bad performance
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

  // Initialize rest
  initCameraRegistry(MAX_CAMERAS);
  createSharedFallbackCube();
  initGameScene();
  initProjectCardScene();

  const visibleProjects = getVisibleProjectModels();
  preloadProjectModels(visibleProjects.slice(0, 3))
    .then(() => {
      requestIdleCallback(() => {
        initPortfolioCanvases();
        isAnimating = true;
        requestAnimationFrame(animate);
        return preloadProjectModels(visibleProjects.slice(3));
      });
    })
    .catch((error) => console.error("Error initializing scenes:", error));

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
      // const info = renderer.info;
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
 * Create fallback cube
 */
function createSharedFallbackCube() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshNormalMaterial();
  sharedFallbackCube = new Mesh(geometry, material);
  sharedFallbackCube.name = FALLBACK_CUBE_NAME;
  return sharedFallbackCube;
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
 * Initialize project card scene
 */
function initProjectCardScene() {
  portfolioItems = document.querySelectorAll(".portfolio-item");
  projectCardScene = new Scene();
  projectCardScene.background = null;

  // Add simplified lighting for performance
  const ambientLight = new AmbientLight(0xffffff, 0.7);
  projectCardScene.add(ambientLight);

  const dirLight = new DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(1, 1, 1);
  projectCardScene.add(dirLight);

  // Add fallback cube
  if (sharedFallbackCube) {
    sharedFallbackCube.position.set(0, 0, 0);
    projectCardScene.add(sharedFallbackCube);
  }

  // Calculate model positions
  calculateModelPositions();

  // Add existing models to scene
  Object.entries(models).forEach(([modelName, model]) => {
    if (model) {
      setupModel(model);
      const position = getModelPosition(modelName);
      model.position.set(position.x, position.y, position.z);
      projectCardScene.add(model);
    }
  });
}

/**
 * Get models for visible project cards
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
 * Calculate model positions in a grid layout with improved spacing
 */
function calculateModelPositions() {
  modelPositions = {};

  // Get unique model names plus fallback
  const modelNames = [
    ...new Set(projectCardData.map((item) => item.modelName).filter(Boolean)),
    FALLBACK_CUBE_NAME,
  ];

  // Calculate grid dimensions
  const gridSide = Math.ceil(Math.sqrt(modelNames.length));

  // Position models in grid with better spacing
  modelNames.forEach((name, index) => {
    const row = Math.floor(index / gridSide);
    const col = index % gridSide;

    const offsetX = (col - (gridSide - 1) / 2) * GRID_SIZE;
    const offsetZ = (row - (gridSide - 1) / 2) * GRID_SIZE;

    modelPositions[name] = new Vector3(offsetX, 0, offsetZ);
  });

  // Ensure fallback cube is at origin
  modelPositions[FALLBACK_CUBE_NAME] = new Vector3(0, 0, 0);
}

/**
 * Get model position by name with error handling
 */
function getModelPosition(modelName) {
  return modelPositions[modelName] || new Vector3(0, 0, 0);
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
  if (window.OffscreenCanvas) {
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
  } else {
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
  const target = getModelPosition(modelName);
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

  // Vary the camera angle for visual interest
  const angle = (index % 8) * (Math.PI / 4);

  // FIXED: Position camera to look directly at the center
  Object.assign(camera.position, {
    x: target.x + Math.sin(angle) * DEFAULT_CAMERA_DISTANCE,
    y: target.y + 1.0, // Lowered camera height for better centering
    z: target.z + Math.cos(angle) * DEFAULT_CAMERA_DISTANCE,
  });

  camera.lookAt(target.x, target.y, target.z);

  // Load model asynchronously but don't block
  if (!disposedModels.has(modelName)) {
    getModel(modelName)
      .then((model) => {
        if (
          model &&
          projectCardScene &&
          !projectCardScene.children.some((c) => c.uuid === model.uuid)
        ) {
          projectCardScene.add(model);
          updateModelPosition(modelName);
        }
      })
      .catch((e) => {
        console.warn(`Failed to load model for ${modelName}:`, e);
      });
  }

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
        enableZoom: true,
        minDistance: 2,
        maxDistance: 8,
      });
      controls.target.set(target.x, target.y, target.z);

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

      controls.update();
    } else {
      controls = createSimpleAutorotation(
        camera,
        target,
        DEFAULT_CAMERA_DISTANCE,
        index
      );
    }
  } catch (e) {
    console.warn("Using fallback controls:", e);
    controls = createSimpleAutorotation(
      camera,
      target,
      DEFAULT_CAMERA_DISTANCE,
      index
    );
  }

  // Register camera with improved metadata
  registerCamera(
    camera,
    controls,
    ctx,
    {
      section: "portfolio",
      modelName,
      elementId: item.id || `portfolio-item-${index}`,
      index,
      visible: isElementInViewport(item),
    },
    isElementInViewport(item) // Only activate if visible
  );

  // Perform initial render
  if (renderer && isElementInViewport(item)) {
    renderer.setSize(canvas.width, canvas.height, false);
    if (projectCardScene) {
      renderer.render(projectCardScene, camera);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        renderer.domElement,
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  }
}

/**
 * Create simple auto-rotation controls with improved performance
 */
function createSimpleAutorotation(
  camera,
  targetPosition,
  cameraDistance,
  index
) {
  // Significantly reduce rotation speed
  const rotationSpeed = 0.001 + (index % 5) * 0.0005;
  let lastUpdate = 0;

  return {
    update: (timestamp) => {
      if (!camera) return;

      // Still skip updates during idle periods, but don't affect speed
      if (isIdle() && timestamp - lastUpdate < 100) return;
      lastUpdate = timestamp || performance.now();

      const currentAngle = Math.atan2(
        camera.position.x - targetPosition.x,
        camera.position.z - targetPosition.z
      );
      const newAngle = currentAngle + rotationSpeed;

      camera.position.x =
        targetPosition.x + Math.sin(newAngle) * cameraDistance;
      camera.position.z =
        targetPosition.z + Math.cos(newAngle) * cameraDistance;
      camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);
    },
    dispose: () => {
      // Clean up function
    },
  };
}

/**
 * Setup model transformations with optimized normalization
 */
function setupModel(model, options = { randomRotation: true }) {
  if (!model) return;

  // Optimize model geometry
  optimizeModel(model);

  // Center and normalize model size efficiently
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  // Only adjust position if significantly off-center
  if (center.length() > 0.01) {
    model.position.sub(center);
  }

  model.position.y += size.y * 0.1;

  // Scale to normalized size only if needed
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && (maxDim < 0.5 || maxDim > 2)) {
    const scale = 1 / maxDim;
    model.scale.multiplyScalar(scale);
  }

  // Add random rotation if requested
  if (options.randomRotation) {
    model.rotation.y = Math.random() * Math.PI * 2;
  }

  // Enable shadows only if needed
  if (renderer?.shadowMap?.enabled) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
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
 * Update model position based on grid
 */
function updateModelPosition(modelName) {
  // Early exit if only one model is being updated
  if (modelName && modelPositions[modelName]) {
    const model = models[modelName];
    if (model) {
      const position = modelPositions[modelName];
      model.position.set(position.x, position.y, position.z);
    }
    return;
  }

  // Recalculate model positions if updating all models
  calculateModelPositions();

  // Update all models' positions
  for (const [name, model] of Object.entries(models)) {
    const position = modelPositions[name];
    if (model && position) {
      model.position.set(position.x, position.y, position.z);
    }
  }

  // Update camera targets (optimized to a separate function for clarity)
  updateCameraTargets("portfolio");
}

// Separate function for updating camera targets
function updateCameraTargets(section) {
  const cameraSections = getCamerasBySection(section);
  if (!Array.isArray(cameraSections)) return;

  cameraSections.forEach((camData) => {
    const index = typeof camData === "object" ? camData?.index : camData;
    const controls = getCameraControls(index);
    if (controls?.target) {
      const item = portfolioItems[index];
      if (item) {
        const itemModelName =
          item.getAttribute("data-model") || FALLBACK_CUBE_NAME;
        const position = modelPositions[itemModelName] || new Vector3(0, 0, 0);
        controls.target.set(position.x, position.y, position.z);
      }
    }
  });
}

/**
 * Helper function to get camera controls
 */
function getCameraControls(index) {
  const allCameras = getCamerasBySection("portfolio");
  if (!allCameras) return null;

  const cameraData = Array.isArray(allCameras)
    ? allCameras.find(
        (cam) =>
          (typeof cam === "object" && cam.index === index) || cam === index
      )
    : allCameras[index];

  return cameraData?.controls;
}

/**
 * Load and patch OrbitControls with memory management
 */
let orbitControlsPromise = null;

async function loadAndPatchOrbitControls() {
  if (OrbitControls) return OrbitControls; // already loaded

  if (!orbitControlsPromise) {
    orbitControlsPromise = import("./extern/three/OrbitControls.js").then(
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
            if (!this._lastMoveTime || now - this._lastMoveTime > 16) {
              this._lastMoveTime = now;
              if (this._dragging) {
                this._lastDragTime = now;
              }
              if (originalOnMouseMove) originalOnMouseMove.call(this, event);
            } else {
              event.preventDefault();
            }
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

// Initialize the app when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM already loaded, initialize now
  initializeApp();
}

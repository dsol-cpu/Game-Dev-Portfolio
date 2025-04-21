/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles navigation, portfolio filtering, form submission,
 * and other UI interactions.
 * @author Portfolio Developer
 * @version 1.0.0
 */

import {
  createBitArray,
  enableAllBits,
  disableAllBits,
  createBitmask,
  logBitArray,
  applyBitmask,
  isBitSet,
} from "./utils/bit-array.js";

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
} from "./three/three.module.min.js";

/**
 * Global state variables
 * @type {number} portfolioItemCount - Total number of portfolio items
 * @type {number} activeProjectCardCamBitMask - Bitmask for active project card cameras
 * @type {boolean} isAnimating - Flag to control animation loop
 * @type {number} lastRenderTime - Timestamp of last render
 * @type {number} TARGET_FRAMERATE - Target framerate for rendering
 * @type {number} FRAME_INTERVAL - Milliseconds between frames
 */
let portfolioItemCount = 0;
let activeProjectCardCamBitMask = 0;
let isAnimating = true;
let lastRenderTime = 0;
const TARGET_FRAMERATE = 60; // Limit to 30fps for project cards
const FRAME_INTERVAL = 1000 / TARGET_FRAMERATE;

/**
 * DOM Elements
 * @type {NodeListOf<Element>} filterButtons - Collection of filter buttons
 * @type {NodeListOf<Element>} portfolioItems - Collection of portfolio items
 */
let filterButtons;
let portfolioItems;

/**
 * Portfolio category enum
 * @readonly
 * @enum {string}
 */
const PortfolioCategory = Object.freeze({
  UNITY: "unity",
  WEB: "web",
  MOBILE: "mobile",
  GAME: "game",
});

/**
 * Technology tags enum
 * @readonly
 * @enum {string}
 */
const TechTags = Object.freeze({
  UNITY: "Unity",
  CSHARP: "C#",
  PROCEDURAL: "Procedural Generation",
  REACT: "React",
  D3: "D3.js",
  API: "API",
});

/**
 * Portfolio item data array
 * @type {Array<Object>}
 * @property {string} category - Project category
 * @property {string} title - Project title
 * @property {Array<string>} tags - Technology tags
 * @property {string} description - Project description
 * @property {string} demoLink - URL to demo
 * @property {string} detailsLink - URL to details page
 * @property {string} modelName - 3D model name to display
 */
const portfolioData = [
  {
    category: PortfolioCategory.UNITY,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNITY, TechTags.CSHARP],
    description: "A visualization of geospatial information.",
    demoLink: "",
    detailsLink: "",
    modelName: "babyTurtle",
  },
  {
    category: PortfolioCategory.WEB,
    title: "Interactive Dashboard",
    tags: [TechTags.REACT, TechTags.D3, TechTags.API],
    description: "A dashboard showing dynamic financial data.",
    demoLink: "",
    detailsLink: "",
    modelName: "",
  },
];

/**
 * Renderer and scene variables
 * @type {WebGLRenderer} renderer - Shared WebGL renderer
 * @type {PerspectiveCamera} gameSceneCamera - Camera for game scene
 * @type {PerspectiveCamera} thirdPersonCamera - Third person camera
 * @type {boolean} gameSceneCameraActive - Flag for active camera
 * @type {Scene} gameScene - Main game scene
 */
let renderer = null;
let gameSceneCamera = null;
let thirdPersonCamera = null;
let gameSceneCameraActive = false;
let gameScene = null;

/**
 * Project card related variables
 * @type {Array<PerspectiveCamera>} projectCardCameras - Cameras for project cards
 * @type {Scene} projectCardScene - Shared scene for project cards
 * @type {Array<OrbitControls>} projectCardControls - Orbit controls for cards
 * @type {Array<CanvasRenderingContext2D>} canvasContexts - Canvas contexts
 */
let projectCardCameras = [];
let projectCardScene = null; // Single shared scene for all project cards
let projectCardControls = []; // Array to store individual orbit controls
let canvasContexts = [];

/**
 * Model cache
 * @type {Object<string, Object3D>} models - Cached 3D models
 * @type {Object<string, Promise>} modelLoadPromises - Promises for model loading
 */
let models = {};
let modelLoadPromises = {};

/**
 * Shared fallback cube for all models
 * @type {Mesh}
 */
let sharedFallbackCube = null;

/**
 * Lazy loaded modules
 * @type {Object} GLTFLoader - For loading GLTF models
 * @type {Object} OrbitControls - For camera controls
 */
let GLTFLoader = null;
let OrbitControls = null;

/**
 * Game view variables
 * @type {boolean} isGameViewActive - Flag for game view mode
 * @type {HTMLCanvasElement} mainGameCanvas - Main game canvas element
 * @type {CanvasRenderingContext2D} mainGameCanvasContext - Main game canvas context
 * @type {number} gameAnimationFrameId - Animation frame ID for game view
 */
let isGameViewActive = false;
let mainGameCanvas = null;
let mainGameCanvasContext = null;
let gameAnimationFrameId = null;

/**
 * Initialize on DOM load
 * @listens DOMContentLoaded
 */
document.addEventListener("DOMContentLoaded", function () {
  // Set up navigation
  initNavigation();

  // Create project cards
  initProjectCards();

  // Set up portfolio filtering
  initPortfolioFilters();

  // Initialize the Game and Project Scenes
  initThreeJS();

  initGameView();

  // Add visibility change handling to pause animation when tab is not active
  document.addEventListener("visibilitychange", () => {
    isAnimating = !document.hidden;
    if (isAnimating) {
      lastRenderTime = 0;
      requestAnimationFrame(animate);

      if (isGameViewActive) {
        renderGameView();
      }
    }
  });
});

/**
 * Toggle between scroll view and game view
 * Updates UI classes and starts/stops game rendering
 */
function toggleGameView() {
  const body = document.body;
  const toggleBtn = document.getElementById("view-toggle-btn");
  const viewLabel = toggleBtn.querySelector(".view-label");

  isGameViewActive = !isGameViewActive;

  if (isGameViewActive) {
    body.classList.add("game-mode");
    viewLabel.textContent = "Game View";

    // Start game rendering
    startGameRendering();
  } else {
    body.classList.remove("game-mode");
    viewLabel.textContent = "Scroll View";

    // Stop game rendering
    stopGameRendering();
  }
}

/**
 * Resize the game canvas when window size changes
 * Updates canvas dimensions and camera aspect ratio
 */
function resizeGameCanvas() {
  if (!mainGameCanvas) return;

  // Get container dimensions
  const container = document.getElementById("game-view-container");
  const width = container.clientWidth || 1; // Ensure at least 1px
  const height = container.clientHeight || 1; // Ensure at least 1px

  console.log(`Resizing game canvas to ${width}x${height}`);

  // Update canvas size
  mainGameCanvas.width = width;
  mainGameCanvas.height = height;

  // Update camera aspect ratio
  if (thirdPersonCamera) {
    thirdPersonCamera.aspect = width / height;
    thirdPersonCamera.updateProjectionMatrix();
  }
}

/**
 * Start rendering the game view
 * Sets up renderer and context for the main game canvas
 */
function startGameRendering() {
  if (!renderer || !gameScene || !thirdPersonCamera) {
    console.error("Game components not initialized");
    return;
  }

  // Set renderer to use the main game canvas
  mainGameCanvasContext = mainGameCanvas.getContext("2d");

  if (!mainGameCanvasContext) {
    console.error("Failed to get 2D context for main game canvas");
    return;
  }

  // Make sure the canvas dimensions are properly set
  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0) {
    resizeGameCanvas(); // Force resize to ensure proper dimensions
  }

  // Resize the renderer to match canvas dimensions
  renderer.setSize(mainGameCanvas.width, mainGameCanvas.height);

  // Start the game animation loop
  renderGameView();
}

/**
 * Stop rendering the game view
 * Cancels the animation frame to stop rendering
 */
function stopGameRendering() {
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }
}

/**
 * Render the game view
 * Called recursively via requestAnimationFrame while game view is active
 */
function renderGameView() {
  if (!isGameViewActive) return;

  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0) {
    console.warn("Skipping render: Canvas has zero dimensions");
    resizeGameCanvas();
    gameAnimationFrameId = requestAnimationFrame(renderGameView);
    return;
  }

  // Update game logic here
  // ...

  // Render the scene
  renderer.render(gameScene, thirdPersonCamera);

  // Copy to canvas
  mainGameCanvasContext.clearRect(
    0,
    0,
    mainGameCanvas.width,
    mainGameCanvas.height
  );
  if (renderer.domElement.width === 0 || renderer.domElement.height === 0) {
    console.warn("Renderer has zero dimensions!");
    return;
  }

  mainGameCanvasContext.drawImage(renderer.domElement, 0, 0);
}

/**
 * Initialize game view
 * Sets up canvas and event listeners
 */
function initGameView() {
  const viewToggleBtn = document.getElementById("view-toggle-btn");
  mainGameCanvas = document.getElementById("main-game-canvas");

  if (viewToggleBtn && mainGameCanvas) {
    // Set up the canvas size
    resizeGameCanvas();

    // Set up event listeners
    viewToggleBtn.addEventListener("click", toggleGameView);
    window.addEventListener("resize", resizeGameCanvas);
  }
}

/**
 * Initialize navigation functionality
 * Sets up event listeners for navigation links
 */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      // Make sure this line is executing
      e.preventDefault();
      console.log("Navigation link clicked, default prevented");

      // Remove active classes
      navLinks.forEach((l) => l.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));

      // Set active link
      this.classList.add("active");

      // Activate the target section
      const targetId = this.getAttribute("data-target");
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active");
        console.log(`Activated section: ${targetId}`);
      } else {
        console.error(`Target section not found: ${targetId}`);
      }
    });
  });
}

/**
 * Create a project card DOM element
 * @param {Object} item - Portfolio item data
 * @returns {HTMLElement} The created project card element
 */
function createProjectCard(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "portfolio-item";
  wrapper.setAttribute("data-category", item.category);
  wrapper.setAttribute("data-model", item.modelName || "");

  wrapper.innerHTML = `
    <div class="portfolio-canvas">
      <canvas class="threejs-canvas" width="300" height="200"></canvas>
    </div>
    <div class="portfolio-info">
      <h3 class="portfolio-title">${item.title}</h3>
      <p class="portfolio-category">${item.tags.join(", ")}</p>
      <p class="portfolio-desc">${item.description}</p>
      <div class="portfolio-links">
        <a href="${item.demoLink || "#"}">Demo</a>
        <a href="${item.detailsLink || "#"}">Details</a>
      </div>
    </div>
  `;
  return wrapper;
}

/**
 * Initialize project cards from data
 * Creates DOM elements for each portfolio item
 */
function initProjectCards() {
  const portfolioGrid = document.querySelector(".portfolio-grid");
  if (!portfolioGrid) return;

  const fragment = document.createDocumentFragment();
  portfolioData.forEach((item) => {
    const projectCard = createProjectCard(item);
    fragment.appendChild(projectCard);
  });

  portfolioGrid.appendChild(fragment);
}

/**
 * Initialize portfolio filtering functionality
 * Sets up filter buttons and their event listeners
 */
function initPortfolioFilters() {
  filterButtons = document.querySelectorAll(".filter-button");
  portfolioItems = document.querySelectorAll(".portfolio-item");

  portfolioItemCount = portfolioItems.length;
  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);
  enableAllBits(activeProjectCardCamBitMask);

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const filter = this.getAttribute("data-filter");
      console.log(`🔍 Filter clicked: "${filter}"`);

      // Clear active classes
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Create new mask for visible indices
      const visibleIndices = [];

      // Process only portfolio items that match the filter
      portfolioItems.forEach((item, index) => {
        const categories = item.getAttribute("data-category");
        const match = filter === "all" || categories.includes(filter);

        // Update display style
        item.style.display = match ? "block" : "none";

        if (match) {
          visibleIndices.push(index);
        }
      });

      // Update bitmask efficiently
      updateActiveCameraBitmask(visibleIndices);
    });
  });
}

/**
 * Update the camera bitmask based on visible indices
 * @param {Array<number>} visibleIndices - Indices of visible portfolio items
 */
function updateActiveCameraBitmask(visibleIndices) {
  // Disable all bits first
  disableAllBits(activeProjectCardCamBitMask);

  // Create and apply the new mask directly
  const newMask = createBitmask(portfolioItemCount, visibleIndices);
  applyBitmask(activeProjectCardCamBitMask, newMask, "OR");

  console.log(
    `🧠 New active camera bitmask: ${logBitArray(activeProjectCardCamBitMask)}`
  );
}

/**
 * Load a model or get from cache if already loaded
 * Uses a promise cache to prevent duplicate loading requests
 * @param {string} modelName - Name of the model to load
 * @returns {Promise<Object3D|null>} Promise that resolves to the loaded model or null
 */
async function loadModel(modelName) {
  // If we already have the model loaded
  if (models[modelName]) {
    return Promise.resolve(models[modelName]);
  }

  // If we're already loading this model, return the existing promise
  if (modelLoadPromises[modelName]) {
    return modelLoadPromises[modelName];
  }

  // Lazy load GLTFLoader when first needed
  if (!GLTFLoader) {
    try {
      const module = await import("./three/GLTFLoader.js");
      GLTFLoader = module.GLTFLoader;
    } catch (error) {
      console.error("Failed to load GLTFLoader:", error);
      return null;
    }
  }

  const modelUrl = `/models/${modelName}.glb`;

  // Create and cache the loading promise
  const loadPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        models[modelName] = gltf.scene;
        console.log(`Model ${modelName} loaded successfully`);
        resolve(gltf.scene);
      },
      undefined,
      (error) => {
        console.error(`Model failed to load: ${modelName}. Error:`, error);
        models[modelName] = null;
        console.warn(`Will use fallback cube for ${modelName}`);
        resolve(null);
      }
    );
  });

  modelLoadPromises[modelName] = loadPromise;
  return loadPromise;
}

/**
 * Preloads models for project cards with efficient caching
 * @returns {Promise<void>}
 */
async function preloadProjectModels() {
  // Extract unique model names from portfolio data
  const modelNames = [
    ...new Set(portfolioData.map((item) => item.modelName).filter(Boolean)),
  ];

  if (modelNames.length === 0) return;

  const loadPromises = modelNames.map((name) => loadModel(name));

  try {
    await Promise.all(loadPromises);
    console.log("All project models loaded successfully");
  } catch (error) {
    console.error("Error preloading project models:", error);
  }
}

/**
 * Clears all resources and disposes of geometries and materials
 * Important for memory management
 */
function clearResources() {
  Object.values(models).forEach((model) => {
    if (!model) return;

    model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  });

  // Clear caches
  models = {};
  modelLoadPromises = {};
  console.log("Resources cleared");
}

/**
 * Initialize Three.js scenes: Game Scene and Project Card Scene
 * Creates shared renderer and preloads models
 */
function initThreeJS() {
  // Create shared renderer
  renderer = new WebGLRenderer({
    preserveDrawingBuffer: true,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    autoClear: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(300, 200);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Create shared fallback cube
  createSharedFallbackCube();

  // Preload models and initialize scenes
  preloadProjectModels()
    .then(() => {
      initGameScene();
      initProjectCardScene();

      // Start animation loop
      requestAnimationFrame(animate);
    })
    .catch((error) => {
      console.error("Error initializing scenes:", error);
    });

  // Handle window resize efficiently with debouncing
  let resizeTimeout;
  window.addEventListener("resize", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
      projectCardCameras.forEach((camera, index) => {
        if (!camera) return;

        const canvas = document.querySelectorAll(".threejs-canvas")[index];
        if (canvas) {
          camera.aspect = canvas.width / canvas.height;
          camera.updateProjectionMatrix();
        }
      });
    }, 100);
  });
}

/**
 * Create a single shared fallback cube for all models
 * @returns {Mesh} The created fallback cube
 */
function createSharedFallbackCube() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshNormalMaterial();
  sharedFallbackCube = new Mesh(geometry, material);

  // We'll add this to the scene only once later
  return sharedFallbackCube;
}

/**
 * Initialize the game scene
 * Creates scene, lights, and camera
 */
function initGameScene() {
  gameScene = new Scene();
  gameScene.background = null;

  // Add lights
  const ambientLight = new AmbientLight(0xffffff, 0.5);
  gameScene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = true;
  gameScene.add(directionalLight);

  // Create camera
  thirdPersonCamera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 0, 0);

  console.log("Game scene initialized");
}

/**
 * Initialize shared scene for project cards
 * Creates shared scene, lights, and sets up cameras
 */
function initProjectCardScene() {
  portfolioItems = document.querySelectorAll(".portfolio-item");
  portfolioItemCount = portfolioItems.length;

  // Initialize visibility bit array
  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);
  enableAllBits(activeProjectCardCamBitMask);

  // Create shared scene
  projectCardScene = new Scene();
  projectCardScene.background = null;

  // Add shared lights
  const ambientLight = new AmbientLight(0xffffff, 0.7);
  projectCardScene.add(ambientLight);

  const dirLight = new DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(1, 1, 1);
  projectCardScene.add(dirLight);

  // Add shared fallback cube to scene once
  projectCardScene.add(sharedFallbackCube);

  // Add all loaded models to scene once
  Object.values(models).forEach((model) => {
    if (model) {
      setupModel(model);
      model.visible = false; // Initially hidden
      projectCardScene.add(model);
    }
  });

  // Set up cameras for each portfolio item
  portfolioItems.forEach((item, index) => {
    setupProjectCamera(item, index);
  });

  console.log("Project card scene initialized");
}

/**
 * Set up camera and controls for a project card
 * @param {HTMLElement} item - Portfolio item element
 * @param {number} index - Index of the portfolio item
 * @returns {Promise<void>}
 */
async function setupProjectCamera(item, index) {
  const canvas = item.querySelector(".threejs-canvas");
  if (!canvas) {
    console.error(`Canvas not found for portfolio item ${index}`);
    return;
  }

  // Get canvas context
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error(`Failed to get 2D context for canvas ${index}`);
    return;
  }
  canvasContexts[index] = ctx;

  // Create camera
  const camera = new PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000
  );
  camera.position.set(0, 0, 2);
  projectCardCameras[index] = camera;

  // Lazy load OrbitControls when first needed
  if (!OrbitControls) {
    try {
      const module = await import("./three/OrbitControls.js");
      OrbitControls = module.OrbitControls;
    } catch (error) {
      console.error("Failed to load OrbitControls:", error);
      return;
    }
  }

  // Make sure the canvas is actually in the DOM and has dimensions
  if (canvas.parentNode && canvas.width > 0 && canvas.height > 0) {
    try {
      // Create orbit controls
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 2.0;
      controls.enableZoom = false;
      controls.target.set(0, 0, 0);
      controls.update();

      projectCardControls[index] = controls;
    } catch (error) {
      console.error(`Failed to create controls for item ${index}:`, error);
      // Create a simple auto-rotation function as fallback
      projectCardControls[index] = {
        update: () => {
          if (camera) {
            // Simple rotation around the y-axis
            const rotationSpeed = 0.01;
            camera.position.x =
              camera.position.x * Math.cos(rotationSpeed) -
              camera.position.z * Math.sin(rotationSpeed);
            camera.position.z =
              camera.position.x * Math.sin(rotationSpeed) +
              camera.position.z * Math.cos(rotationSpeed);
            camera.lookAt(0, 0, 0);
          }
        },
      };
    }
  } else {
    console.warn(`Canvas for item ${index} not ready, skipping OrbitControls`);
  }
}

/**
 * Set up model positioning and scaling
 * Centers and scales the model to fit in view
 * @param {Object3D} model - 3D model to set up
 */
function setupModel(model) {
  // Center and scale the model
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  // Center the model
  model.position.sub(center);

  // Scale to reasonable size
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1 / maxDim;
  model.scale.multiplyScalar(scale);
}

/**
 * Optimized animation loop with frame rate control
 * @param {number} timestamp - Current timestamp from requestAnimationFrame
 */
function animate(timestamp) {
  if (isAnimating) {
    requestAnimationFrame(animate);
  }

  // Limit framerate for performance
  if (timestamp - lastRenderTime < FRAME_INTERVAL) return;
  lastRenderTime = timestamp;

  // First update all active controls
  updateActiveControls();

  // Then render only active scenes
  renderActiveScenes();
}

/**
 * Update only active controls
 * Uses bitmask to skip inactive items for performance
 */
function updateActiveControls() {
  for (let i = 0; i < portfolioItemCount; i++) {
    if (!isBitSet(activeProjectCardCamBitMask, i)) continue;
    if (!projectCardControls[i]) continue;

    projectCardControls[i].update();
  }
}

/**
 * Render only active scenes
 * Uses visibility toggling to render each item efficiently
 */
function renderActiveScenes() {
  // Hide all models initially
  sharedFallbackCube.visible = false;
  Object.values(models).forEach((model) => {
    if (model) model.visible = false;
  });

  // Loop through all items
  for (let i = 0; i < portfolioItemCount; i++) {
    // Skip inactive cameras
    if (!isBitSet(activeProjectCardCamBitMask, i)) continue;

    // Skip if missing components
    const camera = projectCardCameras[i];
    const ctx = canvasContexts[i];
    if (!camera || !ctx) continue;

    // Get the model for this card
    const item = portfolioItems[i];
    const modelName = item.getAttribute("data-model");
    const model = models[modelName];

    // Show either the model or fallback cube
    if (model) {
      model.visible = true;
    } else {
      sharedFallbackCube.visible = true;
    }

    // Render to canvas
    renderToCanvas(camera, ctx);

    // Hide the model again
    if (model) {
      model.visible = false;
    } else {
      sharedFallbackCube.visible = false;
    }
  }
}

/**
 * Render a scene to a canvas
 * @param {PerspectiveCamera} camera - Camera to render from
 * @param {CanvasRenderingContext2D} ctx - Canvas context to render to
 */
function renderToCanvas(camera, ctx) {
  // Set renderer size
  renderer.setSize(ctx.canvas.width, ctx.canvas.height);

  // Render scene
  renderer.render(projectCardScene, camera);

  // Copy to canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(renderer.domElement, 0, 0);
}

/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles navigation, portfolio filtering, form submission,
 * and other UI interactions.
 * @author David Solinsky
 * @version 1.0.0
 */

import {
  createBitArray,
  enableAllBits,
  disableAllBits,
  createBitmask,
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

import { initBlogPosts } from "./blog.js";

import { setupBackdropListener, renderProjectsGrid } from "./project-card.js";

import { projectCardData } from "./data/project.js";
// Global state
let portfolioItemCount = 0;
let activeProjectCardCamBitMask = 0;
let isAnimating = true;
let lastRenderTime = 0;

const TARGET_FRAMERATE = 60;
const FRAME_INTERVAL = 1000 / TARGET_FRAMERATE;

// DOM Elements
let filterButtons;
let portfolioItems;

// Three.js variables
let renderer = null;
let thirdPersonCamera = null;
let gameSceneCameraActive = false;
let gameScene = null;
let projectCardCameras = [];
let projectCardScene = null;
let projectCardControls = [];
let canvasContexts = [];
let models = {};
let modelLoadPromises = {};
let sharedFallbackCube = null;
let GLTFLoader = null;
let OrbitControls = null;
let isGameViewActive = false;
let mainGameCanvas = null;
let mainGameCanvasContext = null;
let gameAnimationFrameId = null;
let modelPositions = {};

const fallbackCubeName = "fallbackCube";

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", function () {
  initNavigation();
  initProjectCards();
  initPortfolioFilters();
  initThreeJS();
  initBlogPosts();
  initGameView();
  setupBackdropListener(); // Set up event listener for backdrop

  // Handle visibility change
  document.addEventListener("visibilitychange", () => {
    isAnimating = !document.hidden;
    if (isAnimating) {
      lastRenderTime = 0;
      requestAnimationFrame(animate);
      if (isGameViewActive) renderGameView();
    }
  });
});

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
}

/**
 * Resize the game canvas
 */
function resizeGameCanvas() {
  if (!mainGameCanvas) return;

  const container = document.getElementById("game-view-container");
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;

  mainGameCanvas.width = width;
  mainGameCanvas.height = height;

  if (thirdPersonCamera) {
    thirdPersonCamera.aspect = width / height;
    thirdPersonCamera.updateProjectionMatrix();
  }
}

/**
 * Game rendering functions
 */
function startGameRendering() {
  if (!renderer || !gameScene || !thirdPersonCamera) return;

  mainGameCanvasContext = mainGameCanvas.getContext("2d");
  if (!mainGameCanvasContext) return;

  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0)
    resizeGameCanvas();

  renderer.setSize(mainGameCanvas.width, mainGameCanvas.height);
  renderGameView();
}

function stopGameRendering() {
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }
}

function renderGameView() {
  if (!isGameViewActive) return;

  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0) {
    resizeGameCanvas();
    gameAnimationFrameId = requestAnimationFrame(renderGameView);
    return;
  }

  renderer.render(gameScene, thirdPersonCamera);

  mainGameCanvasContext.clearRect(
    0,
    0,
    mainGameCanvas.width,
    mainGameCanvas.height
  );
  mainGameCanvasContext.drawImage(renderer.domElement, 0, 0);

  gameAnimationFrameId = requestAnimationFrame(renderGameView);
}

/**
 * Initialize game view
 */
function initGameView() {
  const viewToggleBtn = document.getElementById("view-toggle-btn");
  mainGameCanvas = document.getElementById("main-game-canvas");

  if (viewToggleBtn && mainGameCanvas) {
    resizeGameCanvas();
    viewToggleBtn.addEventListener("click", toggleGameView);
    window.addEventListener("resize", resizeGameCanvas);
  }
}

/**
 * Initialize navigation
 */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      navLinks.forEach((l) => l.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));

      this.classList.add("active");

      const targetId = this.getAttribute("data-target");
      const targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.classList.add("active");
    });
  });
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
 * Initialize portfolio canvases
 */
function initPortfolioCanvases() {
  portfolioItems = document.querySelectorAll(".portfolio-item");

  projectCardCameras = new Array(portfolioItemCount);
  projectCardControls = new Array(portfolioItemCount);
  canvasContexts = new Array(portfolioItemCount);

  // Setup intersection observer for lazy loading
  setTimeout(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const item = entry.target;
            const index = Array.from(portfolioItems).indexOf(item);
            setupProjectCamera(item, index);
            observer.unobserve(item);
          }
        });
      },
      { threshold: 0.1 }
    );

    portfolioItems.forEach((item) => observer.observe(item));

    // Fallback to ensure all cameras get set up eventually
    setTimeout(() => {
      portfolioItems.forEach((item, index) => {
        if (!projectCardCameras[index]) setupProjectCamera(item, index);
      });
    }, 2000);
  }, 100);

  // Watch for new portfolio items
  const portfolioGrid = document.querySelector(".portfolio-grid");
  if (portfolioGrid) {
    const mutationObserver = new MutationObserver((mutations) => {
      let newItemsAdded = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.classList?.contains("portfolio-item"))
              newItemsAdded = true;
          });
        }
      });

      if (newItemsAdded) {
        const oldCount = portfolioItemCount;
        portfolioItems = document.querySelectorAll(".portfolio-item");
        portfolioItemCount = portfolioItems.length;

        // Process only newly added items
        for (let i = oldCount; i < portfolioItemCount; i++) {
          setupProjectCamera(portfolioItems[i], i);
        }

        // Update bitmask if needed
        if (activeProjectCardCamBitMask.length < portfolioItemCount) {
          const newMask = createBitArray(portfolioItemCount);
          for (let i = 0; i < activeProjectCardCamBitMask.length; i++) {
            if (isBitSet(activeProjectCardCamBitMask, i)) {
              setBit(newMask, i);
            }
          }
          activeProjectCardCamBitMask = newMask;
        }
      }
    });

    mutationObserver.observe(portfolioGrid, {
      childList: true,
      subtree: false,
    });
  }
}

/**
 * Initialize portfolio filters
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

      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      const visibleIndices = [];
      portfolioItems.forEach((item, index) => {
        const categories = item.getAttribute("data-category");
        const match = filter === "all" || categories.includes(filter);
        item.style.display = match ? "block" : "none";
        if (match) visibleIndices.push(index);
      });

      updateActiveCameraBitmask(visibleIndices);
    });
  });
}

/**
 * Update camera bitmask
 */
function updateActiveCameraBitmask(visibleIndices) {
  disableAllBits(activeProjectCardCamBitMask);
  const newMask = createBitmask(portfolioItemCount, visibleIndices);
  applyBitmask(activeProjectCardCamBitMask, newMask, "OR");
}

/**
 * Load a model
 */
async function loadModel(modelName) {
  if (models[modelName]) return models[modelName];
  if (modelLoadPromises[modelName]) return modelLoadPromises[modelName];

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
  const loadPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        models[modelName] = gltf.scene;
        setupModel(gltf.scene);
        if (projectCardScene) {
          projectCardScene.add(gltf.scene);
          updateModelPosition(modelName);
        }
        resolve(gltf.scene);
      },
      undefined,
      (error) => {
        console.error(`Model failed to load: ${modelName}`, error);
        models[modelName] = null;
        resolve(null);
      }
    );
  });

  modelLoadPromises[modelName] = loadPromise;
  return loadPromise;
}

/**
 * Optimize model
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
      const sharedGeo = geometries[geoKey];
      child.geometry = sharedGeo || geo;

      if (!sharedGeo && geo.attributes?.position) {
        if (!geo.attributes?.normal) geo.computeVertexNormals();
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
          if (!materials[matKey]) materials[matKey] = mat;
          return materials[matKey];
        });
      } else {
        const matKey = material?.uuid;
        if (matKey) {
          if (!materials[matKey]) materials[matKey] = material;
          child.material = materials[matKey];
        }
      }
    }
  });
}

/**
 * Preload project models
 */
async function preloadProjectModels(priorityModels = []) {
  const modelNames = [
    ...new Set(projectCardData.map((item) => item.modelName).filter(Boolean)),
  ];
  if (modelNames.length === 0) return;

  const loadQueue = [
    ...priorityModels.filter((name) => modelNames.includes(name)),
    ...modelNames.filter((name) => !priorityModels.includes(name)),
  ];

  const BATCH_SIZE = 3;
  const failedModels = [];

  for (let i = 0; i < loadQueue.length; i += BATCH_SIZE) {
    const batch = loadQueue.slice(i, i + BATCH_SIZE);
    try {
      const results = await Promise.allSettled(
        batch.map((name) => loadModel(name))
      );
      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value) {
          failedModels.push(batch[index]);
        }
      });
    } catch (error) {
      console.error("Error loading model batch:", error);
    }
  }

  // Retry failed models once
  if (failedModels.length > 0) {
    try {
      await Promise.allSettled(failedModels.map((name) => loadModel(name)));
    } catch (error) {
      console.error("Error retrying failed models:", error);
    }
  }
}

/**
 * Clear model cache
 */
function clearModelCache(
  options = { memory: true, storage: true, models: [] }
) {
  const { memory, storage, models: targetModels } = options;
  const modelsToProcess =
    targetModels.length > 0 ? targetModels : Object.keys(models);

  if (memory) {
    modelsToProcess.forEach((modelName) => {
      if (models[modelName]) {
        models[modelName].traverse((child) => {
          if (child.isMesh) {
            if (child.geometry && !child.geometry._isShared)
              child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                  if (!mat._isShared) mat.dispose();
                });
              } else if (!child.material._isShared) {
                child.material.dispose();
              }
            }
          }
        });
        delete models[modelName];
      }
    });
  }

  if (storage && window.localStorage) {
    modelsToProcess.forEach((modelName) => {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith(`model_${modelName}_`)) keysToRemove.push(key);
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (error) {
        console.error(`Error clearing storage for model ${modelName}:`, error);
      }
    });
  }
}

/**
 * Initialize Three.js
 */
function initThreeJS() {
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

  createSharedFallbackCube();

  preloadProjectModels()
    .then(() => {
      initGameScene();
      initProjectCardScene();
      initPortfolioCanvases();
      requestAnimationFrame(animate);
    })
    .catch((error) => console.error("Error initializing scenes:", error));

  // Handle window resize
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
 * Create fallback cube
 */
function createSharedFallbackCube() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshNormalMaterial();
  sharedFallbackCube = new Mesh(geometry, material);
  return sharedFallbackCube;
}

/**
 * Initialize game scene
 */
function initGameScene() {
  gameScene = new Scene();
  gameScene.background = null;

  const ambientLight = new AmbientLight(0xffffff, 0.5);
  gameScene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = true;
  gameScene.add(directionalLight);

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
  portfolioItemCount = portfolioItems.length;

  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);
  enableAllBits(activeProjectCardCamBitMask);

  projectCardScene = new Scene();
  projectCardScene.background = null;

  const ambientLight = new AmbientLight(0xffffff, 0.7);
  projectCardScene.add(ambientLight);

  const dirLight = new DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(1, 1, 1);
  projectCardScene.add(dirLight);

  sharedFallbackCube.position.set(0, 0, 0);
  projectCardScene.add(sharedFallbackCube);

  calculateModelPositions();

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
 * Calculate model positions
 */
function calculateModelPositions() {
  const GRID_SIZE = 325;
  modelPositions = {};

  const modelNames = [
    ...new Set(projectCardData.map((item) => item.modelName).filter(Boolean)),
    fallbackCubeName,
  ];

  const gridSide = Math.ceil(Math.sqrt(modelNames.length));

  modelNames.forEach((name, index) => {
    const row = Math.floor(index / gridSide);
    const col = index % gridSide;

    const offsetX = (col - (gridSide - 1) / 2) * GRID_SIZE;
    const offsetZ = (row - (gridSide - 1) / 2) * GRID_SIZE;

    modelPositions[name] = new Vector3(offsetX, 0, offsetZ);
  });

  modelPositions[fallbackCubeName] = new Vector3(0, 0, 0);
}

/**
 * Get model position
 */
function getModelPosition(modelName) {
  return modelPositions[modelName] || new Vector3(0, 0, 0);
}

/**
 * Set up camera and controls for a project card
 */
async function setupProjectCamera(item, index) {
  const canvas = item.querySelector(".threejs-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvasContexts[index] = ctx;

  const modelName = item.getAttribute("data-model") || fallbackCubeName;
  const targetPosition = getModelPosition(modelName);

  const camera = new PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000
  );

  const cameraDistance = 3;
  const angleOffset = (index % 8) * (Math.PI / 4);

  camera.position.x = targetPosition.x + Math.sin(angleOffset) * cameraDistance;
  camera.position.y = targetPosition.y + 1.5;
  camera.position.z = targetPosition.z + Math.cos(angleOffset) * cameraDistance;

  camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);

  projectCardCameras[index] = camera;

  if (!OrbitControls) {
    try {
      OrbitControls = await loadAndPatchOrbitControls();
    } catch (error) {
      console.error("Failed to load OrbitControls:", error);
    }
  }

  await new Promise(requestAnimationFrame);

  const createSimpleAutorotation = () => ({
    update: () => {
      if (!camera) {
        return;
      }
      const rotationSpeed = 0.005 + (index % 5) * 0.002;
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
  });

  if (!canvas.isConnected || canvas.width <= 0 || canvas.height <= 0) {
    projectCardControls[index] = createSimpleAutorotation();
    return;
  }

  try {
    if (!OrbitControls) {
      projectCardControls[index] = createSimpleAutorotation();
    }
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0 + (index % 5) * 0.5;
    controls.enableZoom = true;
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.target.set(targetPosition.x, targetPosition.y, targetPosition.z);

    // Add event listeners for OrbitControls cursor changes
    controls.addEventListener("start", () => {
      canvas.style.cursor = "grabbing";
    });

    controls.addEventListener("end", () => {
      canvas.style.cursor = "grab";
    });

    controls.update();
    projectCardControls[index] = controls;
  } catch (error) {
    projectCardControls[index] = createSimpleAutorotation();
  }
}

/**
 * Set up model
 */
function setupModel(model, options = { randomRotation: true }) {
  if (!model) return;

  optimizeModel(model);

  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  model.position.sub(center);
  model.position.y += size.y * 0.1;

  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const scale = 1 / maxDim;
    model.scale.multiplyScalar(scale);
  }

  if (options.randomRotation) {
    model.rotation.y = Math.random() * Math.PI * 2;
  }

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Animation loop
 */
function animate(timestamp) {
  if (isAnimating) {
    requestAnimationFrame(animate);
  }

  if (timestamp - lastRenderTime < FRAME_INTERVAL) return;
  lastRenderTime = timestamp;

  // Update active controls
  for (let i = 0; i < portfolioItemCount; i++) {
    if (isBitSet(activeProjectCardCamBitMask, i) && projectCardControls[i]) {
      projectCardControls[i].update();
    }
  }

  if (gameSceneCameraActive) {
    renderer.setSize(mainGameCanvas.width, mainGameCanvas.height);
    renderer.render(gameScene, thirdPersonCamera);
  }

  // Render active scenes
  for (let i = 0; i < portfolioItemCount; i++) {
    if (!isBitSet(activeProjectCardCamBitMask, i)) continue;

    const camera = projectCardCameras[i];
    const ctx = canvasContexts[i];
    if (!camera || !ctx) continue;

    // Render to canvas
    renderer.setSize(ctx.canvas.width, ctx.canvas.height);
    renderer.render(projectCardScene, camera);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(renderer.domElement, 0, 0);
  }
}

/**
 * Update model position
 */
function updateModelPosition(modelName) {
  if (modelPositions[modelName]) {
    const model = models[modelName];
    if (model) {
      const position = modelPositions[modelName];
      model.position.set(position.x, position.y, position.z);
    }
    return;
  }

  calculateModelPositions();

  Object.entries(models).forEach(([name, model]) => {
    if (model && modelPositions[name]) {
      const position = modelPositions[name];
      model.position.set(position.x, position.y, position.z);
    }
  });

  portfolioItems.forEach((item, index) => {
    const controls = projectCardControls[index];
    if (controls?.target) {
      const modelName = item.getAttribute("data-model") || fallbackCubeName;
      const position = modelPositions[modelName] || new Vector3(0, 0, 0);
      controls.target.set(position.x, position.y, position.z);
    }
  });
}

/**
 * Load and patch OrbitControls
 */
async function loadAndPatchOrbitControls() {
  try {
    const module = await import("./three/OrbitControls.js");
    OrbitControls = module.OrbitControls;

    // Patch OrbitControls to prevent errors
    if (!OrbitControls.prototype._patched) {
      OrbitControls.prototype._patched = true;
      const originalDispatchEvent = OrbitControls.prototype.dispatchEvent;

      OrbitControls.prototype.dispatchEvent = function (event) {
        if (!this._listeners || !event) return false;

        const listeners = this._listeners;
        const listenerArray = listeners[event.type];

        if (listenerArray === undefined) {
          return false;
        }

        event.target = this;
        const array = listenerArray.slice(0);

        for (let i = 0, l = array.length; i < l; i++) {
          array[i].call(this, event);
        }
        return true;
      };
    }

    return OrbitControls;
  } catch (error) {
    console.error("Failed to load OrbitControls:", error);
    return null;
  }
}

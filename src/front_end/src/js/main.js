/**
 * Main JavaScript for portfolio site
 * Handles navigation, portfolio filtering, form submission,
 * and other UI interactions
 */

import {
  createBitArray,
  enableAllBits,
  disableAllBits,
  createBitmask,
  logBitArray,
  applyBitmask,
} from "./utils/bit-array.js";

import * as THREE from "./three/three.module.min.js";
import { GLTFLoader } from "./three/GLTFLoader.js";
import { OrbitControls } from "./three/OrbitControls.js";

let portfolioItemCount = 0;
let activeProjectCardCamBitMask = 0;

let filterButtons;
let portfolioItems;

const PortfolioCategory = Object.freeze({
  UNITY: "unity",
  WEB: "web",
  MOBILE: "mobile",
  GAME: "game",
});

const TechTags = Object.freeze({
  UNITY: "Unity",
  CSHARP: "C#",
  PROCEDURAL: "Procedural Generation",
  REACT: "React",
  D3: "D3.js",
  API: "API",
});

const portfolioData = [
  {
    category: PortfolioCategory.UNITY,
    title: "Geospatial Visualizer",
    tags: [TechTags.UNITY, TechTags.CSHARP, TechTags.PROCEDURAL],
    description: "A visualization of geospatial information.",
    demoLink: "",
    detailsLink: "",
  },
  {
    category: PortfolioCategory.WEB,
    title: "Interactive Dashboard",
    tags: [TechTags.REACT, TechTags.D3, TechTags.API],
    description: "A dashboard showing dynamic financial data.",
    demoLink: "",
    detailsLink: "",
  },
];

// Renderer and scene variables
let renderer = null;
let gameSceneCamera = null;
let thirdPersonCamera = null;
let gameScene = null;

let projectCardCameras = [];
let projectCardScene = null; // Single shared scene for all project cards
let projectCardModels = []; // Array to store individual models for each card
let projectCardControls = []; // Array to store individual orbit controls
let canvasContexts = [];

let models = {};

// Create fallback cube for when model loading fails
const fallbackCube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);

document.addEventListener("DOMContentLoaded", function () {
  // Set up navigation
  initNavigation();

  initProjectCards();

  // Set up portfolio filtering
  initPortfolioFilters();

  // Initialize the Game and Project Scenes
  initThreeJS();
});

/**
 * Initialize navigation functionality
 */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      // Remove active classes
      navLinks.forEach((link) => link.classList.remove("active"));
      sections.forEach((section) => section.classList.remove("active"));

      // Set active link
      this.classList.add("active");

      // Activate the target section
      const targetId = this.getAttribute("data-target");
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active");
      }
    });
  });
}
function createProjectCard(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "portfolio-item";
  wrapper.setAttribute("data-category", item.category);

  wrapper.innerHTML = `
    <div class="portfolio-canvas">
      <canvas class="threejs-canvas" width="300" height="200"></canvas>
    </div>
    <div class="portfolio-info">
      <h3 class="portfolio-title">${item.title}</h3>
      <p class="portfolio-category">${item.tags.join(", ")}</p>
      <p class="portfolio-desc">${item.description}</p>
      <div class="portfolio-links">
        <a href="${item.demoLink}">Demo</a>
        <a href="${item.detailsLink}">Details</a>
      </div>
    </div>
  `;
  return wrapper;
}

function initProjectCards() {
  const portfolioGrid = document.querySelector(".portfolio-grid");

  portfolioData.forEach((item) => {
    const projectCard = createProjectCard(item);
    portfolioGrid.appendChild(projectCard);
  });
}

/**
 * Initialize portfolio filtering
 */
function initPortfolioFilters() {
  filterButtons = document.querySelectorAll(".filter-button");
  portfolioItems = document.querySelectorAll(".portfolio-item");

  portfolioItemCount = portfolioItems.length;
  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);
  enableAllBits(activeProjectCardCamBitMask); // Now modifies in place

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const filter = this.getAttribute("data-filter");
      console.log(`🔍 Filter clicked: "${filter}"`);

      // Clear active classes
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      const visibleIndices = [];

      portfolioItems.forEach((item, index) => {
        const categories = item.getAttribute("data-category");
        const match = filter === "all" || categories.includes(filter);

        item.style.display = match ? "block" : "none";

        if (match) {
          visibleIndices.push(index);
          console.log(
            `✅ Showing item at index ${index} [category: "${categories}"]`
          );
        } else {
          console.log(
            `🚫 Hiding item at index ${index} [category: "${categories}"]`
          );
        }
      });

      // Update bitmask
      const newMask = createBitmask(portfolioItemCount, visibleIndices);
      disableAllBits(activeProjectCardCamBitMask); // Now works because activeProjectCardCamBitMask was properly initialized
      applyBitmask(activeProjectCardCamBitMask, newMask, "OR");

      console.log(
        `🧠 New active camera bitmask: ${logBitArray(
          activeProjectCardCamBitMask
        )}`
      );
    });
  });
}

/**
 * Loads a GLTF model with the given name
 * @param {string} modelName - Name of the model to load
 */
function loadModel(modelName) {
  const modelUrl = `/assets/models/${modelName}.gltf`;

  return new Promise((resolve, reject) => {
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
}

/**
 * Gets a clone of the specified model
 * @param {string} name - Name of the model to retrieve
 * @returns {Object} - Clone of the requested model or null if not found
 */
function getModel(name) {
  if (!models[name]) {
    console.warn(`Model ${name} not found in cache, using fallback`);
    return null;
  }
  return models[name].clone();
}

/**
 * Preloads models for project cards
 * @returns {Promise} - Promise that resolves when all models are loaded
 */
async function preloadProjectModels() {
  const modelPaths = [{ name: "baby_turtle" }];

  const loadPromises = modelPaths.map((model) => {
    return loadModel(model.name);
  });

  try {
    await Promise.all(loadPromises);
    console.log("All project models loaded successfully");
  } catch (error) {
    console.error("Error preloading project models:", error);
  }
}

/**
 * Clears all resources and disposes of geometries and materials
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

  // Clear the models dictionary
  Object.keys(models).forEach((key) => delete models[key]);
  console.log("Resources cleared");
}

// Initialize Three.js scenes: Game Scene and Project Card Scene
function initThreeJS() {
  // Renderer setup
  renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: true,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    autoClear: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(300, 200);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Preload models and initialize scenes
  preloadProjectModels()
    .then(() => {
      initGameScene();
      console.log("Game scene initialized");

      initProjectCardScene();
      console.log("Project card scene initialized");

      // Start animation loop
      animate();
    })
    .catch((error) => {
      console.error("Error initializing scenes:", error);
    });

  // Handle window resize
  window.addEventListener("resize", () => {
    // Update all project card cameras
    projectCardCameras.forEach((camera, index) => {
      if (camera) {
        const canvas = document.querySelectorAll(".threejs-canvas")[index];
        if (canvas) {
          camera.aspect = canvas.width / canvas.height;
          camera.updateProjectionMatrix();
        }
      }
    });
  });
}

function initGameScene() {
  // Scene setup
  gameScene = new THREE.Scene();
  gameScene.background = null;

  // Lights for game scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  gameScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = true;
  gameScene.add(directionalLight);

  // Camera for third-person view
  thirdPersonCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 0, 0);
}

// Initialize single shared scene for all project cards with separate models and cameras
async function initProjectCardScene() {
  portfolioItems = document.querySelectorAll(".portfolio-item");
  portfolioItemCount = portfolioItems.length;

  // Initialize bit array for camera visibility
  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);
  enableAllBits(activeProjectCardCamBitMask);

  // Create the single shared scene
  projectCardScene = new THREE.Scene();
  projectCardScene.background = null;

  // Add lights to the shared scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  projectCardScene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(1, 1, 1);
  projectCardScene.add(dirLight);

  portfolioItems.forEach((item, index) => {
    const canvas = item.querySelector(".threejs-canvas");
    if (!canvas) {
      console.error(`Canvas not found for portfolio item ${index}`);
      return;
    }

    // Get 2D context for the canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(`Failed to get 2D context for canvas ${index}`);
      return;
    }
    canvasContexts[index] = ctx;

    // Set up camera
    const camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2);
    projectCardCameras[index] = camera;

    // Try to get the model
    const model = getModel("baby_turtle");

    if (model) {
      // We have a loaded model
      // Center and scale the model properly
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center the model
      model.position.sub(center);

      // Scale to reasonable size
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1 / maxDim;
      model.scale.multiplyScalar(scale);

      // Add model to the shared scene
      model.visible = true; // All models start visible
      projectCardScene.add(model);
      projectCardModels[index] = model;
    } else {
      // Use a new fallback cube
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshNormalMaterial()
      );
      fallback.visible = true;
      projectCardScene.add(fallback);
      projectCardModels[index] = fallback;
    }

    // Create orbit controls for this camera
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.enableZoom = false;

    // Set the target to the center of the model
    controls.target.set(0, 0, 0);
    controls.update();

    projectCardControls[index] = controls;

    console.log(`Setup complete for portfolio item ${index}`);
  });
}

// Game loop function
function animate() {
  requestAnimationFrame(animate);

  // Render project card scenes
  portfolioItems.forEach((item, index) => {
    if (index >= projectCardCameras.length || !canvasContexts[index]) return;

    const camera = projectCardCameras[index];
    const ctx = canvasContexts[index];
    const controls = projectCardControls[index];
    const model = projectCardModels[index];

    if (!camera || !ctx || !model) return;

    // Check if this camera is active in the bitmask
    const byteIndex = Math.floor(index / 8);
    const bitPosition = index % 8;
    const isActive =
      (activeProjectCardCamBitMask.bytes[byteIndex] >> bitPosition) & 1;

    // Only render if this card is visible and the camera is active in the bitmask
    if (item.style.display !== "none" && isActive === 1) {
      // Make only this model visible in the shared scene
      projectCardModels.forEach((m, i) => {
        if (m) m.visible = i === index;
      });

      // Update the orbit controls
      if (controls) {
        controls.update();
      }

      // Clear the canvas before rendering
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // Use renderer to render the shared scene with this card's camera
      renderer.setSize(ctx.canvas.width, ctx.canvas.height);
      renderer.render(projectCardScene, camera);

      // Copy from renderer to canvas
      ctx.drawImage(renderer.domElement, 0, 0);
    }
  });
}

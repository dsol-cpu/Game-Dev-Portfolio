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
    demoLink: "#",
    detailsLink: "#",
  },
  {
    category: PortfolioCategory.WEB,
    title: "Interactive Dashboard",
    tags: [TechTags.REACT, TechTags.D3, TechTags.API],
    description: "A dashboard showing dynamic financial data.",
    demoLink: "#",
    detailsLink: "#",
  },
];
document.addEventListener("DOMContentLoaded", function () {
  // Set up navigation
  initNavigation();

  initProjectCards();

  // Set up portfolio filtering
  initPortfolioFilters();

  //Initialize the Game and Project Scenes
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
  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);

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
  portfolioItems = document.querySelectorAll("portfolio-item");

  portfolioItemCount = portfolioItems.length;
  activeProjectCardCamBitMask = createBitArray(portfolioItemCount);

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
      disableAllBits(activeProjectCardCamBitMask);
      applyBitmask(activeProjectCardCamBitMask, newMask, "OR");

      console.log(
        `🧠 New active camera bitmask: ${logBitArray(
          activeProjectCardCamBitMask
        )}`
      );
    });
  });
}

import * as THREE from "./three/three.module.min.js";
import { GLTFLoader } from "./three/GLTFLoader.js";
import { OrbitControls } from "./three/OrbitControls.js";

let renderer = null;
let gameSceneCamera = null;
let thirdPersonCamera = null;
let gameScene = null;

let projectCardCameras = [];
let projectCardScene = null;
let renderTarget = null;

let models = [];
let canvasContexts = [];

let player = null;
let playerModel = null;

const moveSpeed = 0.1;
const rotationSpeed = 0.05;
let keysPressed = {};

// Create fallback cube if model doesn't load
const fallbackCube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1), // A simple cube geometry
  new THREE.MeshBasicMaterial({ color: 0xff0000 }) // Red color for the cube
);

// Resource Manager to handle models
const resourceManager = {
  models: {},

  // Load GLB model
  loadModel(modelName) {
    const modelUrl = `/assets/models/${modelName}.gltf`; // Assuming model files are in .gltf format

    // Attempt to load the model
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.name = modelName;
        models[modelName] = model;
        console.log(`${modelName} to models dict`);
      },
      undefined, // onProgress callback, can be left undefined
      (error) => {
        console.error(`Model failed to load: ${modelName}. Error:`, error);
        fallbackCube.name = modelName;
        models[modelName] = fallbackCube;
        console.log(models[modelName]);
        console.warn(`Fallback cube used for missing model: ${modelName}`);
      }
    );
  },

  // Get model
  getModel: function (name) {
    console.log(`Getting model: ${models[name]}`);
    console.log(`Models list: ${models}`);
    return this.models[name].clone();
  },

  // Preload models for project cards
  preloadProjectModels: async function () {
    const modelPaths = [
      {
        name: "baby_turtle",
        path: "/assets/models/project_card/babyTurtle.glb",
      },
    ];

    const loadPromises = modelPaths.map((model) => {
      this.loadModel(model.name, model.path);
    });

    try {
      await Promise.all(loadPromises);
      console.log("All project models loaded successfully");
    } catch (error) {
      console.error("Error preloading project models:", error);
    }
  },

  // Preload models for the game scene
  preloadGameModels: async function () {
    const modelPaths = [
      // { name: "game_model_1", path: "/assets/models/game/model1.glb" },
      // { name: "game_model_2", path: "/assets/models/game/model2.glb" },
      // { name: "player_model", path: "/assets/models/game/player.glb" },
    ];

    const loadPromises = modelPaths.map((model) =>
      this.loadModel(model.name, model.path)
    );

    try {
      await Promise.all(loadPromises);
      console.log("All game models loaded successfully");
    } catch (error) {
      console.error("Error preloading game models:", error);
    }
  },

  // Clear resources
  clear: function () {
    Object.values(this.models).forEach((model) => {
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

    this.models = {};
    console.log("Resources cleared");
  },
};

// Initialize Three.js scenes: Game Scene and Project Card Scene
function initThreeJS() {
  const container = document.getElementById("game-canvas");
  console.log(container);

  if (!container) return;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: true,
    antialias: true,
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Swappable render target for rendering using the same renderer
  renderTarget = new THREE.WebGLRenderTarget(
    container.clientWidth,
    container.clientHeight
  );

  // Preload models
  resourceManager.preloadProjectModels();
  resourceManager.preloadGameModels();

  console.log("done");
  //Initialize Game Scene
  initGameScene();
  console.log("Game scene initialized");

  //Initialize ProjectCard Scene
  initProjectCardScene();
  console.log("Project card scene initialized");
  // Handle window resize
  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Update camera
    gameSceneCamera.aspect = width / height;
    gameSceneCamera.updateProjectionMatrix();

    // Update all project card cameras
    projectCardCameras.forEach((cameraInfo) => {
      if (cameraInfo.camera) {
        cameraInfo.camera.aspect = width / height;
        cameraInfo.camera.updateProjectionMatrix();
      }
    });
  });

  // Set up keyboard controls
  setupKeyboardControls();

  // Start animation loop
  console.log("yay");
  animate();
}

// Set up keyboard controls for player movement
function setupKeyboardControls() {
  // Key down event
  document.addEventListener("keydown", (event) => {
    keysPressed[event.key.toLowerCase()] = true;
  });

  // Key up event
  document.addEventListener("keyup", (event) => {
    keysPressed[event.key.toLowerCase()] = false;
  });
}

// Update player position based on key input
function updatePlayerPosition() {
  if (!player || !gameScene) return;

  // Forward vector based on player's current rotation
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyQuaternion(player.quaternion);

  // Right vector
  const right = new THREE.Vector3(1, 0, 0);
  right.applyQuaternion(player.quaternion);

  // Apply movement based on keys pressed
  let moved = false;

  // Forward / Backward
  if (keysPressed["w"] || keysPressed["arrowup"]) {
    player.position.addScaledVector(forward, moveSpeed);
    moved = true;
  }
  if (keysPressed["s"] || keysPressed["arrowdown"]) {
    player.position.addScaledVector(forward, -moveSpeed);
    moved = true;
  }

  // Left / Right rotation
  if (keysPressed["a"] || keysPressed["arrowleft"]) {
    player.rotation.y += rotationSpeed;
    moved = true;
  }
  if (keysPressed["d"] || keysPressed["arrowright"]) {
    player.rotation.y -= rotationSpeed;
    moved = true;
  }

  // If the player moved, update the camera position to follow
  if (moved && thirdPersonCamera) {
    updateThirdPersonCamera();
  }
}

// Update third-person camera position to follow player
function updateThirdPersonCamera() {
  if (!player || !thirdPersonCamera) return;

  // Define camera offset from player (behind and above)
  const cameraOffset = new THREE.Vector3(0, 2, 5);
  cameraOffset.applyQuaternion(player.quaternion);

  // Set camera position relative to player
  thirdPersonCamera.position.copy(player.position).add(cameraOffset);

  // Make camera look at player
  thirdPersonCamera.lookAt(
    player.position.clone().add(new THREE.Vector3(0, 1, 0))
  );
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

  console.log("ccc");

  // Create player model (after loading)
  // playerModel = resourceManager.getModel("player_model");
  // if (!playerModel) return;

  // player = playerModel.clone();
  // player.position.set(0, 0, 0);
  // player.scale.set(0.5, 0.5, 0.5);
  // gameScene.add(player);

  // Add orbit controls for the game camera

  // const controls = new OrbitControls(gameSceneCamera, renderer.domElement);
  // controls.target.set(0, 1, 0);
  // controls.enableDamping = true;
  // controls.dampingFactor = 0.25;
  // controls.enableZoom = true;

  // Camera for third-person view (fixed behind the player)
  thirdPersonCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
}

// Initialize shared scene for all project cards with separate models and cameras
function initProjectCardScene() {
  projectCardScene = new THREE.Scene();

  // Add lights to the shared scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  projectCardScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  projectCardScene.add(directionalLight);

  portfolioItems = document.querySelectorAll(".portfolio-item");
  portfolioItemCount = portfolioItems.length;

  // Position offset to ensure models are far apart (1000 units between each model)
  const SPACING = 1000;

  portfolioItems.forEach((item, index) => {
    const canvas = item.querySelector(".threejs-canvas");
    canvasContexts.push(canvas);
    // Set up camera
    const camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.1,
      1000
    );

    const positionX = index * SPACING;
    const positionZ = 0;

    // Setup camera for this project card
    camera.position.set(positionX, 0, 2);
    camera.lookAt(positionX, 0, 0);

    // Determine which model to use based on data attribute
    const modelName = "baby_turtle";

    // Get the model and add it to the scene at the specified position
    const model = resourceManager.getModel(modelName);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.x = positionX - center.x;
    model.position.y = -center.y;
    model.position.z = positionZ - center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(1 / maxDim);

    projectCardScene.add(model);

    // Create the project card camera to match the renderer
    projectCardCameras.push(camera);

    // Render the project card view
    function renderProjectCardView() {
      // Ensure the camera's aspect ratio is updated
      camera.aspect = cardElement.offsetWidth / cardElement.offsetHeight;
      camera.updateProjectionMatrix();

      // Render the scene
      renderer.render(projectCardScene, camera);
    }

    // Add event listener to resize renderer when the portfolio image is resized
    window.addEventListener("resize", renderProjectCardView);

    // Call render function initially
    renderProjectCardView();
  });
}

// Game loop function
function animate() {
  // Update the game scene, camera, and player position
  // updatePlayerPosition();

  // // Update orbit controls
  // if (thirdPersonCamera) {
  //   thirdPersonCamera.update();
  // }

  // Render the game scene via different viewports to different canvases with their respective cameras.
  // renderer.render(gameScene, gameSceneCamera);
  activeProjectCardCamBitMask.forEach((bit, i) => {
    console.log(`Processing camera at index ${i}, bit: ${bit}`); // Log the index and bit value

    if (bit !== 1) {
      console.log(`Skipping camera at index ${i} because the bit is disabled`); // Debug when skipping
      return; // Skip this camera if the bit is disabled
    }

    const camera = projectCardCameras[i];
    const ctx = canvasContexts[i];

    console.log(`Rendering camera at index ${i} to render target`); // Debug when rendering
    // Render to shared render target
    renderer.setRenderTarget(renderTarget);
    renderer.render(projectCardScene, camera);
    renderer.setRenderTarget(null);

    // Read pixels from render target
    console.log(`Reading pixels from render target for camera at index ${i}`); // Debug for pixel read
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

    console.log(`Creating image data for canvas at index ${i}`); // Debug for image data creation
    // Create image data for canvas
    const imageData = ctx.createImageData(width, height);

    // Flip Y axis and copy pixel data
    console.log(`Flipping and copying pixel data for camera at index ${i}`); // Debug pixel flipping
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = ((height - y - 1) * width + x) * 4;
        const dst = (y * width + x) * 4;
        imageData.data[dst] = pixels[src];
        imageData.data[dst + 1] = pixels[src + 1];
        imageData.data[dst + 2] = pixels[src + 2];
        imageData.data[dst + 3] = pixels[src + 3];
      }
    }

    console.log(`Drawing image data to canvas at index ${i}`); // Debug when drawing to canvas
    // Draw to canvas
    ctx.putImageData(imageData, 0, 0);
  });

  // Call the next frame
  console.log("Requesting next animation frame"); // Debug for next frame
  requestAnimationFrame(animate);
}

// Assuming you're using a canvas with id="threejs-canvas"

// const canvas = document.querySelector("#threejs-canvas");

// // Set up scene, camera, renderer
// const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(
//   75,
//   canvas.width / canvas.height,
//   0.1,
//   1000
// );
// const rendererums = new THREE.WebGLRenderer({
//   canvas: canvas,
//   antialias: true,
// });

// rendererums.setSize(canvas.width, canvas.height);

// // Add a cube as a placeholder or fallback
// const geometry = new THREE.BoxGeometry(1, 1, 1);
// const material = new THREE.MeshNormalMaterial(); // colorful surface
// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

// // Add ambient light (helps make things look nice)
// const light = new THREE.AmbientLight(0xffffff, 1);
// scene.add(light);

// // OrbitControls
// const controls = new OrbitControls(camera, rendererums.domElement);
// controls.enableDamping = true; // adds smoothing to movement
// controls.dampingFactor = 0.1;
// controls.target.set(0, 0, 0); // optional: focus on center
// controls.update();

// // Position camera back a bit
// camera.position.z = 3;

// // Save initial positions
// const initialCameraPosition = camera.position.clone();
// const initialTarget = controls.target.clone();

// // Reset button logic
// const resetButton = document.getElementById("reset-orbit-btn");
// resetButton.addEventListener("click", () => {
//   camera.position.copy(initialCameraPosition);
//   controls.target.copy(initialTarget);
//   controls.update();
// });

// // Animation loop
// function animateums() {
//   requestAnimationFrame(animateums);

//   controls.update(); // required if damping is enabled
//   const SPEED = 0.01;
//   cube.rotation.x -= SPEED * 2;
//   rendererums.render(scene, camera);
// }

// animateums();

import * as THREE from "./three/three.module.min.js";
import { GLTFLoader } from "./three/GLTFLoader.js";
import { OrbitControls } from "./three/OrbitControls.js";

let renderer = null;
let gameSceneCamera = null;
let thirdPersonCamera = null;
let gameScene = null;

let activeProjectCardCamBitmask = new Uint8Array(2);
let projectCardCameras = [];
let projectCardScene = null;

let player = null;
let playerModel = null;

const moveSpeed = 0.1;
const rotationSpeed = 0.05;
let keysPressed = {};

// Resource Manager to handle models
const resourceManager = {
  models: {},

  // Load GLB model
  loadModel: function (name, url) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          this.models[name] = gltf.scene;
          console.log(`Model ${name} loaded`);
          resolve(gltf.scene);
        },
        (xhr) => {
          console.log(
            `${name} ${((xhr.loaded / xhr.total) * 100).toFixed(2)}% loaded`
          );
        },
        (error) => {
          console.error(`Error loading model ${name}:`, error);
          reject(error);
        }
      );
    });
  },

  // Get model
  getModel: function (name) {
    if (this.models[name]) {
      return this.models[name].clone();
    }
    console.warn(`Model ${name} not found`);
    return null;
  },

  // TODO: Load Project Models into the Project Card Scene by a certain offset
  // Preload models from specific directories
  preloadProjectModels: async function () {
    const modelPaths = [
      // Add your project card model filenames here
      {
        name: "baby_turtle",
        path: "/assets/models/project_card/babyTurtle.glb",
      },
    ];

    const loadPromises = modelPaths.map((model) =>
      this.loadModel(model.name, model.path)
    );

    try {
      await Promise.all(loadPromises);
      console.log("All project models loaded successfully");
      initProjectCardScene();
    } catch (error) {
      console.error("Error preloading project models:", error);
    }
  },

  preloadGameModels: async function () {
    const modelPaths = [
      // Add your game model filenames here
      { name: "game_model_1", path: "/assets/models/game/model1.glb" },
      { name: "game_model_2", path: "/assets/models/game/model2.glb" },
      { name: "player_model", path: "/assets/models/game/player.glb" }, // Player model
      // Add more models as needed
    ];

    const loadPromises = modelPaths.map((model) =>
      this.loadModel(model.name, model.path)
    );

    try {
      await Promise.all(loadPromises);
      console.log("All game models loaded successfully");
      initGameScene();
    } catch (error) {
      console.error("Error preloading game models:", error);
    }
  },

  // Clear resources
  clear: function () {
    // Dispose models if needed
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

// Initialize Three.js scene
function initThreeJS() {
  const container = document.getElementById("canvas-container");
  if (!container) return;

  // Scene setup
  gameScene = new THREE.Scene();
  gameScene.background = null;

  // Game camera setup (for game view)
  gameSceneCamera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  gameSceneCamera.position.z = 5;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Lights for game scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  gameScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = true;
  gameScene.add(directionalLight);

  // Preload models
  resourceManager.preloadProjectModels();
  resourceManager.preloadGameModels();

  // Handle window resize
  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Update main camera
    gameSceneCamera.aspect = width / height;
    gameSceneCamera.updateProjectionMatrix();

    // Update all project card cameras
    projectCardCameras.forEach((cameraInfo) => {
      if (cameraInfo.camera) {
        cameraInfo.camera.aspect = width / height;
        cameraInfo.camera.updateProjectionMatrix();
      }
    });

    // Update game camera
    if (gameScene && gameScene.camera) {
      gameScene.camera.aspect = width / height;
      gameScene.camera.updateProjectionMatrix();
    }

    // Update third person camera
    if (thirdPersonCamera) {
      thirdPersonCamera.aspect = width / height;
      thirdPersonCamera.updateProjectionMatrix();
    }

    renderer.setSize(width, height);
  });

  // Set up keyboard controls
  setupKeyboardControls();

  // Set up filter button listeners
  setupFilterButtons();

  // Start animation loop
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
  if (!player || !gameScene || !gameScene.visible) return;

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

// Initialize shared scene for all project cards with separate models and cameras
function initProjectCardScene() {
  // Create a single shared scene for all project cards
  projectCardScene = new THREE.Scene();

  // Add lights to the shared scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  projectCardScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  projectCardScene.add(directionalLight);

  const portfolioItems = document.querySelectorAll(".portfolio-item");

  // Position offset to ensure models are far apart (1000 units between each model)
  const SPACING = 1000;

  portfolioItems.forEach((item, index) => {
    // Position for this model in the shared scene
    const positionX = index * SPACING;
    const positionZ = 0;

    // Setup camera for this project card
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(positionX, 0, 2); // Position camera at the model's X position
    camera.lookAt(positionX, 0, 0); // Look at the model's position

    // Determine which model to use based on category
    let modelName;
    const category = item.getAttribute("data-category");

    if (category.includes("unity")) {
      modelName = "project_model_1";
    } else if (category.includes("unreal")) {
      modelName = "project_model_2";
    } else {
      // Default model or randomly choose
      modelName = index % 2 === 0 ? "project_model_1" : "project_model_2";
    }

    // Get the model and add it to the scene at the specified position
    const model = resourceManager.getModel(modelName);
    if (model) {
      // Center the model around its local origin
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      model.position.x = positionX - center.x;
      model.position.y = -center.y;
      model.position.z = positionZ - center.z;

      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.multiplyScalar(1 / maxDim);

      projectCardScene.add(model);
    }

    // Create a mini-renderer for this project card
    const cardElement = item.querySelector(".portfolio-img");
    const renderer = document.createElement("div");
    renderer.classList.add("project-model-viewer");
    renderer.style.width = "100%";
    renderer.style.height = "200px";
    renderer.style.position = "absolute";
    renderer.style.top = "0";
    renderer.style.left = "0";

    // Replace the image with our model viewer
    cardElement.appendChild(renderer);

    // Set up orbital controls
    const controls = new OrbitControls(camera, renderer);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2;

    // Configure controls to never view other models
    // This ensures the orbit controls stay focused on this model's position
    controls.minAzimuthAngle = -Math.PI / 4;
    controls.maxAzimuthAngle = Math.PI / 4;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = (3 * Math.PI) / 4;

    // Limit distance to prevent seeing other models
    controls.minDistance = 1;
    controls.maxDistance = 3;

    // Store camera info with reference to the DOM element and controls
    projectCardCameras.push({
      element: renderer,
      camera: camera,
      controls: controls,
      visible: true,
      category: category,
      position: new THREE.Vector3(positionX, 0, 0), // Store model position for camera targeting
    });
  });
}

// Initialize game scene
function initGameScene() {
  // Create a scene for the game view
  const gameModelScene = new THREE.Scene();
  gameModelScene.background = new THREE.Color(0x87ceeb); // Sky blue background

  // Add lights to the scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  gameModelScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  gameModelScene.add(directionalLight);

  // Create a ground plane
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b8e23, // Olive green
    roughness: 0.8,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  gameModelScene.add(ground);

  // Add some environment objects
  const model = resourceManager.getModel("game_model_1");
  if (model) {
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());

    model.position.x = -center.x + 10;
    model.position.y = -center.y;
    model.position.z = -center.z + 5;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    gameModelScene.add(model);
  }

  // Add a second environment model
  const model2 = resourceManager.getModel("game_model_2");
  if (model2) {
    // Position the second model
    model2.position.set(-10, 0, -5);
    model2.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    gameModelScene.add(model2);
  }

  // Create player model and third-person camera
  setupPlayerWithCamera(gameModelScene);

  // Get the canvas container
  const container = document.getElementById("canvas-container");

  // Static camera for overall game scene view (not used with third-person)
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  // Store game scene information
  gameScene = {
    scene: gameModelScene,
    camera: camera, // Keep the static camera as a backup
    controls: null, // No orbit controls for game scene since we're using third-person camera
    visible: true, // Initially visible, toggles based on section visibility
  };
}

// Setup player model with third-person camera
function setupPlayerWithCamera() {
  // Create player container
  player = new THREE.Object3D();
  player.position.set(0, 0, 0);
  gameScene.add(player);

  // Try to load player model
  playerModel = resourceManager.getModel("player_model");

  if (playerModel) {
    // Add the loaded model to the player container
    player.add(playerModel);

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(playerModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    playerModel.position.x = -center.x;
    playerModel.position.y = -center.y;
    playerModel.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    playerModel.scale.multiplyScalar(1 / maxDim);

    // Setup shadow casting
    playerModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  } else {
    // Create a simple placeholder if model not available
    const geometry = new THREE.ConeGeometry(0.5, 1, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cone = new THREE.Mesh(geometry, material);
    cone.rotation.x = Math.PI / 2;
    cone.position.y = 0.5;
    cone.castShadow = true;
    player.add(cone);

    console.warn("Player model not found, using placeholder");
  }

  // Create third-person camera
  const container = document.getElementById("canvas-container");

  gameSceneCamera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );

  thirdPersonCamera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );

  // Position the camera behind and above the player
  updateThirdPersonCamera();
}

// Set up filter button event listeners
function setupFilterButtons() {
  const filterButtons = document.querySelectorAll(".filter-button");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons
      filterButtons.forEach((btn) => btn.classList.remove("active"));

      // Add active class to clicked button
      button.classList.add("active");

      const filter = button.getAttribute("data-filter");

      // Update visibility of project cards
      updateProjectCardVisibility(filter);
    });
  });
}

// Update project card visibility based on filter
function updateProjectCardVisibility(filter) {
  const portfolioItems = document.querySelectorAll(".portfolio-item");

  portfolioItems.forEach((item, index) => {
    const category = item.getAttribute("data-category");
    const isVisible = filter === "all" || category.includes(filter);

    // Update DOM visibility
    item.style.display = isVisible ? "block" : "none";

    // Update our camera tracking info
    if (projectCardCameras[index]) {
      projectCardCameras[index].visible = isVisible;
    }
  });
}

// Check which section is currently active
function getCurrentSection() {
  const sections = document.querySelectorAll("section");
  let currentSection = null;

  sections.forEach((section) => {
    if (section.classList.contains("active")) {
      currentSection = section.id;
    }
  });

  return currentSection;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  const currentSection = getCurrentSection();

  // Update player position based on key input
  updatePlayerPosition();

  // Update project card orbital controls
  projectCardCameras.forEach((cameraInfo) => {
    if (cameraInfo.visible && cameraInfo.controls) {
      cameraInfo.controls.update();
    }
  });

  //TODO: Make this respond to a switch
  // Render based on current section
  if (currentSection === "home" && gameScene && gameScene.visible) {
    // Render game scene in the main canvas using third-person camera if available
    if (thirdPersonCamera) {
      renderer.render(gameScene, thirdPersonCamera);
    } else {
      renderer.render(gameScene, gameSceneCamera);
    }
  } else {
    // Render main scene with main camera
    renderer.render(gameScene, gameSceneCamera);
  }

  // Render all visible project cards in the portfolio section
  if (currentSection === "portfolio") {
    for (let index = 0; index < portfolioItemCount; index++) {
      renderer.render(projectCardScene, projectCardCameras[index]);
    }
  }
}

initThreeJS();
// Set up navigation to toggle section visibility
document.addEventListener("DOMContentLoaded", function () {
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      // Remove active class from all links and sections
      navLinks.forEach((link) => link.classList.remove("active"));
      document
        .querySelectorAll("section")
        .forEach((section) => section.classList.remove("active"));

      // Add active class to clicked link
      this.classList.add("active");

      // Show the corresponding section
      const sectionId = this.getAttribute("href").substring(1);
      console.log("sectionId:", sectionId, document.getElementById(sectionId));
      document.getElementById(sectionId).classList.add("active");

      // Update game scene visibility based on section
      if (gameScene) {
        gameScene.visible = sectionId === "home";
      }
    });
  });
});

// Clean up resources when page is unloaded
window.addEventListener("unload", function () {
  if (resourceManager) {
    resourceManager.clear();
  }

  if (renderer) {
    renderer.dispose();
  }

  // Dispose project card renderers
  projectCardCameras.forEach((cameraInfo) => {
    if (cameraInfo.element && cameraInfo.element.firstChild) {
      cameraInfo.element.firstChild.remove();
    }
  });
});

function applyProjectCamBitmask(bitmask) {
  activeProjectCardCamBitmask |= bitmask;
}

function enableAllProjectCardsCameras() {
  activeProjectCardCamBitmask = (1 << portfolioItemCount) - 1;
}

function disableAllProjectCardsCameras() {
  activeProjectCardCamBitMask = 0;
}

export {
  applyProjectCamBitmask,
  enableAllProjectCardsCameras,
  disableAllProjectCardsCameras,
};

/**
 * @fileoverview Game scene with player model and camera follow
 **/

// Keep existing imports
import {
  Scene,
  PerspectiveCamera,
  Vector3,
  Clock,
  Mesh,
  CylinderGeometry,
  BoxGeometry,
  CapsuleGeometry,
  Group,
  MeshStandardMaterial,
  SphereGeometry
} from "../extern/three/three.module.min.js";
import {
  registerCamera,
  createSimpleAutorotation,
  onToggleGameCamera,
} from "./camera-registry.js";
import { CAMERA_SECTIONS } from "../data/sections.js";
import { isIdle, handleUserInteraction } from "../user-interaction.js";
import { debounce } from "../utils/helper.js";
import { hasWebGLSupport, getPerfLevel } from "../utils/device.js";
import { getClonedLight, getRenderer } from "./renderer-core.js";
// Import player model and camera follow modules
import {
  createPlayerModel,
  initPlayerControls,
  updatePlayerMovement,
  getPlayerModel,
} from "./player-model.js";
import { createOrbitController } from "./camera-follow.js";
import { COLORS } from "../constants/constants.js";
// Constants
const C = {
  FRAME_INTERVAL: 1000 / 60,
  IDLE_FRAME_INTERVAL: 1000 / 8,
  DEFAULT_FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
};

// Define colors for the scene objects
const colors = {
  clouds: 0xffffff,
  islandSide: 0x8B4513, // Brown
  islandTop: 0x228B22, // Forest Green
  shipBody: 0x3366cc,
  shipAccent: 0x66ccff,
};

// Island data - you would need to define this based on your game's world
const ISLAND_DATA = [
  {
    position: new Vector3(0, 0, 0),
    section: "home",
    name: "Home Island"
  },
  {
    position: new Vector3(10, 0, 10),
    section: "explore",
    name: "Exploration Island"
  },
  {
    position: new Vector3(-10, 0, -15),
    section: "adventure",
    name: "Adventure Island"
  }
];

// View modes
const VIEW_MODES = {
  SCROLL: "scroll",
  GAME: "game",
};

// Game scene state
let gameScene = null;
let thirdPersonCamera = null;
let mainGameCanvas = null;
let mainGameCanvasContext = null;
let gameAnimationFrameId = null;
let isGameViewActive = false;
let renderer = null;
let resizeObserver = null;
let gameTime = new Clock();
let playerEntity = null;
let cameraFollowActive = true;
let orbitController = null;

// Game controller state
const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  renderFrameId: null,
  lastCanvasWidth: 0,
  lastCanvasHeight: 0,
  isInitialized: false,
};

/**
 * Initialize game scene
 */
export function initGameScene() {
  renderer = getRenderer();
  gameTime.start();

  gameScene = new Scene();
  gameScene.background = COLORS.SKY;
  gameScene.add(getClonedLight("ambientLight"));
  gameScene.add(getClonedLight("directionalLight1"));

  const cloudGeometry = new SphereGeometry(1, 7, 7);
  const cloudMaterial = new MeshStandardMaterial({
    color: colors.clouds,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });

  const islandBaseGeometry = new CylinderGeometry(2, 1.5, 2, 8);
  const islandBaseMaterial = new MeshStandardMaterial({
    color: colors.islandSide,
    flatShading: true,
  });

  const islandTopGeometry = new CylinderGeometry(2, 2, 0.5, 8);
  const islandTopMaterial = new MeshStandardMaterial({
    color: colors.islandTop,
    flatShading: true,
  });

  // Create containers for scene objects
  const clouds = [];
  const islands = [];

  // Create islands using ISLAND_DATA from world.js
  for (let i = 0; i < ISLAND_DATA.length; i++) {
    const islandGroup = new Group();
    const islandInfo = ISLAND_DATA[i];

    // Create geometries with randomized dimensions
    const baseSize = 2 + Math.random() * 0.5;
    const topSize = 2 + Math.random() * 0.5;

    // Clone and modify geometries for variation
    const customBaseGeometry = islandBaseGeometry.clone();
    customBaseGeometry.scale(baseSize / 2, 1, baseSize / 2);

    const customTopGeometry = islandTopGeometry.clone();
    customTopGeometry.scale(topSize / 2, 1, topSize / 2);

    // Create island parts
    const base = new Mesh(customBaseGeometry, islandBaseMaterial);

    const top = new Mesh(customTopGeometry, islandTopMaterial);
    top.position.y = 1;

    // Add island parts to group
    islandGroup.add(base, top);

    // Use position from ISLAND_DATA
    islandGroup.position.copy(islandInfo.position);

    // Store section information in userData for navigation
    islandGroup.userData.type = islandInfo.section;
    islandGroup.userData.name = islandInfo.name;

    gameScene.add(islandGroup);
    islands.push(islandGroup);
  }

  // Create clouds more efficiently
  for (let i = 0; i < 8; i++) {
    // Clone and modify geometry for each cloud
    const customGeometry = cloudGeometry.clone();
    customGeometry.scale(
      1 + Math.random(),
      1 + Math.random(),
      1 + Math.random()
    );

    const cloud = new Mesh(customGeometry, cloudMaterial);

    const scale = 0.8 + Math.random() * 1.5;
    cloud.position.set(
      (Math.random() - 0.5) * 40,
      5 + Math.random() * 8,
      (Math.random() - 0.5) * 40
    );

    cloud.scale.set(scale, scale * 0.6, scale);
    gameScene.add(cloud);
    clouds.push(cloud);
  }

  // Create player model using the imported function
  playerEntity = createPlayerModel();

  // Start player at home island position + offset for height
  const homeIsland = ISLAND_DATA.find((island) => island.section === "home");
  if (homeIsland) {
    playerEntity.position.set(
      homeIsland.position.x,
      homeIsland.position.y + 2, // Offset player above island
      homeIsland.position.z
    );
  } else {
    playerEntity.position.set(0, 2, 0); // Fallback position
  }

  gameScene.add(playerEntity);

  // Initialize player controls
  initPlayerControls();

  thirdPersonCamera = new PerspectiveCamera(
    C.DEFAULT_FOV,
    window.innerWidth / window.innerHeight,
    C.NEAR,
    C.FAR
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 0, 0);

  // Initialize orbit controller for camera follow
  orbitController = createOrbitController(thirdPersonCamera, playerEntity);

  // Get the game canvas context
  const mainGameCanvas = document.getElementById("main-game-canvas");
  const gameCanvasContext = mainGameCanvas
    ? mainGameCanvas.getContext("2d")
    : null;

  registerCamera(
    thirdPersonCamera,
    createSimpleAutorotation(thirdPersonCamera, new Vector3(0, 0, 0), 5, 0),
    gameCanvasContext,
    {
      type: CAMERA_SECTIONS.GAME,
      elementId: "game-view",
      section: CAMERA_SECTIONS.GAME,
    },
    false
  );
}

/**
 * Get the game scene object
 * @returns {Scene} The game scene
 */
export function getGameScene() {
  return gameScene;
}

/**
 * Get the third person camera
 * @returns {PerspectiveCamera} The third person camera
 */
export function getThirdPersonCamera() {
  return thirdPersonCamera;
}

/**
 * Toggle camera follow mode
 * @param {boolean} active - Whether camera follow should be active
 */
export function toggleCameraFollow(active) {
  cameraFollowActive = active !== undefined ? active : !cameraFollowActive;
  return cameraFollowActive;
}

/**
 * Get game's clock
 * @returns {Clock} The game clock
 */
export function getGameClock() {
  return gameTime;
}

/**
 * Initialize the game module
 * @returns {Object} - Game module API
 */
export function initGame() {
  if (gameState.isInitialized) return getPublicAPI();

  // Setup DOM elements
  const elements = {
    viewToggleBtn: document.getElementById("view-toggle-btn"),
    mainGameCanvas: document.getElementById("main-game-canvas"),
    gameViewContainer: document.getElementById("game-view-container"),
    sidebar: document.querySelector(".sidebar"),
    body: document.body,
  };

  // Check if all required elements exist
  if (
    !elements.viewToggleBtn ||
    !elements.mainGameCanvas ||
    !elements.gameViewContainer ||
    !elements.sidebar
  ) {
    console.error(
      "Game view initialization failed: Required DOM elements not found"
    );
    return getPublicAPI();
  }

  // Initialize game scene
  initGameScene();

  // Hide game view initially
  elements.gameViewContainer.style.display = "none";

  // Set up event handlers
  elements.viewToggleBtn.addEventListener("click", () => {
    toggleGameView(elements);
  });

  // Set main game canvas
  setMainGameCanvas(elements.mainGameCanvas);

  // Make canvas globally accessible if needed by external code
  window.mainGameCanvas = elements.mainGameCanvas;

  // Setup resize handling
  setupGameCanvasResize(elements);

  // Set global API for backward compatibility
  window.isGameViewActive = () => gameState.viewMode === VIEW_MODES.GAME;
  window.toggleGameView = () => toggleGameView(elements);
  window.updateGameViewSize = (width, height) =>
    updateGameViewSize(elements, width, height);

  gameState.isInitialized = true;
  return getPublicAPI();
}

/**
 * Get the public API for the game module
 * @returns {Object} - Public API
 */
function getPublicAPI() {
  return {
    getViewMode: () => gameState.viewMode,
    isGameViewActive: () => gameState.viewMode === VIEW_MODES.GAME,
    toggleGameView: (elements) => toggleGameView(elements),
    updateGameViewSize,
    hasWebGLSupport,
    getPerfLevel,
    getGameScene,
    getThirdPersonCamera,
    getPlayerModel,
    toggleCameraFollow,
  };
}

/**
 * Set the main game canvas
 * @param {HTMLCanvasElement} canvas - The canvas element
 */
export function setMainGameCanvas(canvas) {
  mainGameCanvas = canvas;
}

/**
 * Toggle between scroll and game view modes
 * @param {Object} elements - DOM elements
 * @returns {boolean} - Is game view active
 */
export function toggleGameView(elements) {
  if (!elements) {
    console.error("Toggle game view failed: elements object is required");
    return false;
  }

  const { body, viewToggleBtn, gameViewContainer, sidebar } = elements;

  if (!body || !viewToggleBtn || !gameViewContainer || !sidebar) {
    console.error("Toggle game view failed: missing required elements");
    return false;
  }

  const viewLabel = viewToggleBtn.querySelector(".view-label");
  if (!viewLabel) {
    console.error("Toggle game view failed: view-label element not found");
    return false;
  }

  // Toggle state
  gameState.viewMode =
    gameState.viewMode === VIEW_MODES.GAME
      ? VIEW_MODES.SCROLL
      : VIEW_MODES.GAME;
  const isGameView = gameState.viewMode === VIEW_MODES.GAME;
  onToggleGameCamera(isGameView);

  if (isGameView) {
    // Switch to game view
    body.classList.add("game-mode");
    viewLabel.textContent = "Scroll View";

    // Position and show game container
    const sidebarWidth = sidebar.offsetWidth;
    Object.assign(gameViewContainer.style, {
      position: "fixed",
      top: "0",
      left: sidebarWidth + "px",
      width: `calc(100% - ${sidebarWidth}px)`,
      height: "100%",
      zIndex: "100",
      display: "block",
    });

    // Initialize canvas size
    updateGameViewSize(elements);

    // Start rendering
    startGameRendering(handleUserInteraction, elements.mainGameCanvas);
  } else {
    // Switch to scroll view
    body.classList.remove("game-mode");
    viewLabel.textContent = "Game View";

    // Hide game container
    Object.assign(gameViewContainer.style, {
      position: "",
      top: "",
      left: "",
      width: "",
      height: "",
      zIndex: "",
      display: "none",
    });

    // Stop rendering
    stopGameRendering();

    if (gameState.renderFrameId) {
      cancelAnimationFrame(gameState.renderFrameId);
      gameState.renderFrameId = null;
    }
  }

  // Notify interaction system
  handleUserInteraction();

  return isGameView;
}

/**
 * Update game view canvas size
 * @param {Object} elements - DOM elements
 * @param {number} [width] - Optional explicit width
 * @param {number} [height] - Optional explicit height
 */
export function updateGameViewSize(elements, width, height) {
  const { mainGameCanvas, sidebar } = elements;
  if (!mainGameCanvas) return;

  // Calculate dimensions if not provided
  if (!width || !height) {
    const sidebarWidth = sidebar?.offsetWidth || 0;
    width = window.innerWidth - sidebarWidth || 1;
    height = window.innerHeight || 1;
  }

  // Update canvas dimensions if changed
  if (mainGameCanvas.width !== width || mainGameCanvas.height !== height) {
    mainGameCanvas.width = width;
    mainGameCanvas.height = height;
    gameState.lastCanvasWidth = width;
    gameState.lastCanvasHeight = height;

    // Update camera aspect ratio
    if (thirdPersonCamera) {
      thirdPersonCamera.aspect = width / height;
      thirdPersonCamera.updateProjectionMatrix();
    }

    // Update renderer size
    if (renderer) {
      renderer.setSize(width, height, false);
    }

    // If currently in game view, restart rendering with new dimensions
    if (gameState.viewMode === VIEW_MODES.GAME) {
      stopGameRendering();
      if (elements.mainGameCanvas) {
        startGameRendering(handleUserInteraction, elements.mainGameCanvas);
      }
    }
  }
}

/**
 * Start game rendering
 * @param {Function} handleUserInteraction - User interaction handler
 * @param {HTMLCanvasElement} [canvas] - Optional canvas element
 */
export function startGameRendering(handleUserInteraction, canvas) {
  if (!renderer || !gameScene || !thirdPersonCamera) {
    console.error("Cannot start game rendering: missing core components");
    return;
  }

  // Use provided canvas or stored canvas
  if (canvas) {
    mainGameCanvas = canvas;
  }

  if (!mainGameCanvas) {
    console.error("Cannot start game rendering: no canvas available");
    return;
  }

  mainGameCanvasContext = mainGameCanvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
  });

  if (!mainGameCanvasContext) {
    console.error("Cannot start game rendering: failed to get canvas context");
    return;
  }

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

/**
 * Stop game rendering
 */
export function stopGameRendering() {
  if (gameAnimationFrameId) {
    cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = null;
  }
  isGameViewActive = false;
}

/**
 * Render the game view
 */
function renderGameView() {
  if (!isGameViewActive) return;

  if (mainGameCanvas.width === 0 || mainGameCanvas.height === 0) {
    const container = document.getElementById("game-view-container");
    mainGameCanvas.width = container.clientWidth || 1;
    mainGameCanvas.height = container.clientHeight || 1;
    renderer.setSize(mainGameCanvas.width, mainGameCanvas.height, false);
  }

  // Update game logic
  const deltaTime = gameTime.getDelta() * 1000; // Convert to milliseconds

  // Update player movement
  if (playerEntity) {
    updatePlayerMovement(deltaTime);

    // Update camera to follow player if enabled
    if (cameraFollowActive && thirdPersonCamera) {
      orbitController();
    }
  }

  // Render scene
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

/**
 * Setup game canvas resize handling
 * @param {Object} [elements] - Optional DOM elements
 */
export function setupGameCanvasResize(elements) {
  // If elements provided, use game controller approach
  if (elements) {
    setupGameControllerResize(elements);
    return;
  }

  // Otherwise use the original approach
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

/**
 * Set up canvas resize handling using game controller approach
 * @param {Object} elements - DOM elements
 */
function setupGameControllerResize(elements) {
  const { mainGameCanvas, sidebar } = elements;
  if (!mainGameCanvas || !sidebar) return;

  // Clean up existing observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Set initial size
  updateGameViewSize(elements);

  // Create resize handler
  const handleResize = debounce(() => {
    if (gameState.viewMode !== VIEW_MODES.GAME) return;

    const sidebarWidth = sidebar.offsetWidth;
    const width = window.innerWidth - sidebarWidth || 1;
    const height = window.innerHeight || 1;

    // Only update if dimensions changed significantly
    if (
      Math.abs(gameState.lastCanvasWidth - width) > 1 ||
      Math.abs(gameState.lastCanvasHeight - height) > 1
    ) {
      console.log(`Resizing game canvas: ${width}x${height}`);
      updateGameViewSize(elements, width, height);
    }
  }, 200);

  // Set up resize listener
  window.addEventListener("resize", handleResize);
}

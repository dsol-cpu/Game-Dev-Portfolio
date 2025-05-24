import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
} from "../extern/three/three.module.min.js";
import { handleUserInteraction } from "../user-interaction.js";
import { debounce } from "../utils/helper.js";
import { initCamController, updateCamera } from "./camera-follow.js";
import { disposeGameUI, initGameUI, updateGameUI } from "./game-ui.js";
import {
  createPlayerModel,
  initPlayerControls,
  updatePlayer,
} from "./player.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { runFixedUpdates } from "./time.js";
import { random } from "../utils/random.js";
import {
  pauseMusic,
  isAudioEnabled,
  isMusicPlaying,
  restoreAudioState,
  handleVisibilityChange,
  dispose as disposeAudio,
} from "./audio.js";

const COLORS = {
  clouds: 0xffffff,
  islandSide: 0x8b4513,
  islandTop: 0x228b22,
  shipBody: 0x3366cc,
  shipAccent: 0x66ccff,
};
import { TWO_PI } from "../constants/constants.js";

export const ISLAND_DATA = [
  { name: "Home Island", position: new Vector3(0, 0, 1000), section: "home" },
  {
    name: "Experience Island",
    position: new Vector3(30, 10, 1030),
    section: "experience",
  },
  {
    name: "Projects Island",
    position: new Vector3(-20, -15, 975),
    section: "projects",
  },
  {
    name: "Resume Island",
    position: new Vector3(10, 25, 990),
    section: "resume",
  },
];

const VIEW_MODES = { SCROLL: "scroll", GAME: "game" };
const TRANSITION_DURATION = 500; // ms for view transition

// Game state and references - All consolidated for faster access
const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  totalTime: 0,
  isInitialized: false,
  isTransitioning: false,
};

// Game entities and references
let thirdPersonCamera;
let cameraIndex = -1;
let playerEntity;
let islands = [];
let islandAnimationData = [];
let cameraFollowActive = true;
let gameWorker = null;
let workerBusy = false;

export const isGameView = () => gameState.viewMode === VIEW_MODES.GAME;

function initIslandBobbing(islands) {
  // Pre-allocate animation data for all islands
  islands.forEach(() =>
    islandAnimationData.push({
      initialY: islands[islandAnimationData.length].position.y,
      amplitude: 0.2 + random() * 0.15,
      frequency: 0.5 + random() * 0.3,
      offset: random() * TWO_PI,
    })
  );
}

const ANGLE_COUNT = 628;
const sinCache = new Float32Array(ANGLE_COUNT); // Cache for 0 to 2π with 0.01 precision
function initSinCache() {
  for (let i = 0; i < ANGLE_COUNT; i++) {
    sinCache[i] = Math.sin(i * 0.01);
  }
}

// Get sin value from cache with linear interpolation for smooth results
function fastSin(x) {
  const wrappedX = ((x % TWO_PI) + TWO_PI) % TWO_PI;
  const index = wrappedX * 100;
  const lowIndex = Math.floor(index) % ANGLE_COUNT;
  const highIndex = (lowIndex + 1) % ANGLE_COUNT;
  const fraction = index - Math.floor(index);
  return sinCache[lowIndex] * (1 - fraction) + sinCache[highIndex] * fraction;
}

export function updateIslandBobbing(deltaTime) {
  gameState.totalTime += deltaTime;

  // Always use worker when available
  if (gameWorker && !workerBusy) {
    workerBusy = true;
    gameWorker.postMessage({
      type: "calculateIslandAnimations",
      data: {
        islands: islands.map((island, i) => ({
          currentY: island.position.y,
          animationData: islandAnimationData[i],
        })),
        totalTime: gameState.totalTime,
        deltaTime,
      },
    });
    return;
  }

  // Fallback to main thread calculation
  const smoothingFactor = 0.05 * Math.min(1, deltaTime * 60);

  for (let i = 0; i < islands.length; i++) {
    const island = islands[i];
    const data = islandAnimationData[i];
    if (!data) continue;

    const newY =
      data.initialY +
      fastSin(gameState.totalTime * data.frequency + data.offset) *
        data.amplitude;

    island.position.y += (newY - island.position.y) * smoothingFactor;
  }
}

export async function initGameScene() {
  gameState.totalTime = 0;
  const gameScene = getScene();

  // Create reusable geometries and materials for performance
  const cloudGeometry = new SphereGeometry(1, 7, 7);
  const cloudMaterial = new MeshStandardMaterial({
    color: COLORS.clouds,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });

  const islandBaseGeometry = new CylinderGeometry(2, 1.5, 2, 8);
  const islandBaseMaterial = new MeshStandardMaterial({
    color: COLORS.islandSide,
    flatShading: true,
  });

  const islandTopGeometry = new CylinderGeometry(2, 2, 0.5, 8);
  const islandTopMaterial = new MeshStandardMaterial({
    color: COLORS.islandTop,
    flatShading: true,
  });

  // Create islands - batch process for performance
  for (let i = 0; i < ISLAND_DATA.length; i++) {
    const { position, section, name } = ISLAND_DATA[i];
    const islandGroup = new Group();
    const baseSize = 2 + random() * 0.5;
    const topSize = 2 + random() * 0.5;

    // Create base and top meshes
    const base = new Mesh(islandBaseGeometry.clone(), islandBaseMaterial);
    const top = new Mesh(islandTopGeometry.clone(), islandTopMaterial);

    // Configure meshes
    base.scale.set(baseSize / 2, 1, baseSize / 2);
    top.scale.set(topSize / 2, 1, topSize / 2);
    top.position.y = 1;

    // Assemble and position island
    islandGroup.add(base, top);
    islandGroup.position.copy(position);
    islandGroup.userData = { type: section, name };

    // Add to scene and tracking array
    gameScene.add(islandGroup);
    islands.push(islandGroup);
  }

  // Create clouds - batch process
  for (let i = 0; i < 8; i++) {
    const cloud = new Mesh(cloudGeometry.clone(), cloudMaterial);
    const scale = 0.8 + random() * 1.5;

    cloud.position.set(
      random() * -0.5,
      5 + random() * 8,
      (random() * 1000 - 0.5) * 40
    );
    cloud.scale.set(scale, scale * 0.6, scale);
    gameScene.add(cloud);
  }

  // Create player entity
  playerEntity = await createPlayerModel();

  // Position player at home island
  const homeIsland = ISLAND_DATA.find(({ section }) => section === "home");
  playerEntity.position.set(
    homeIsland?.position.x || 0,
    (homeIsland?.position.y || 0) + 2,
    homeIsland?.position.z || 0
  );

  gameScene.add(playerEntity);

  // Initialize systems
  initSinCache();
  initIslandBobbing(islands);
  initPlayerControls();

  // Setup camera
  thirdPersonCamera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 2, 0);

  initCamController(thirdPersonCamera, playerEntity);

  // Register camera with renderer
  const gameCanvas = document.getElementById("main-game-canvas");
  const gameCanvasContext = gameCanvas?.getContext("2d");
  cameraIndex = registerCamera(thirdPersonCamera, gameCanvasContext);
}

export function updateGameLoop(deltaTime) {
  // Update player if exists
  if (playerEntity) {
    playerEntity.visible = true;

    runFixedUpdates((fixedDeltaTime) => {
      updatePlayer(fixedDeltaTime);
      updateIslandBobbing(fixedDeltaTime);
    });

    // Get current player state for UI update
    const playerState = {
      position: playerEntity.position,
      direction: playerEntity.userData?.direction || "N",
      model: playerEntity,
    };

    // Update game UI with player state
    updateGameUI(playerState);
  }

  // Update camera if following player
  if (thirdPersonCamera && playerEntity && cameraFollowActive) {
    updateCamera(deltaTime);
  }
}

export function toggleGameView(elements) {
  const { body, viewToggleBtn, gameViewContainer, sidebar } = elements;

  // Validate required elements
  if (!body || !viewToggleBtn || !gameViewContainer || !sidebar) {
    console.error("Toggle game view failed: missing required elements");
    return false;
  }

  const viewLabel = viewToggleBtn.querySelector(".view-label");
  if (!viewLabel) {
    console.error("Toggle game view failed: view-label not found");
    return false;
  }

  // Prevent toggling during transitions
  if (gameState.isTransitioning) return isGameView();

  gameState.isTransitioning = true;

  // Determine new view mode
  const newViewMode = isGameView() ? VIEW_MODES.SCROLL : VIEW_MODES.GAME;
  const switchingToGameView = newViewMode === VIEW_MODES.GAME;

  // Update button text
  viewLabel.textContent = switchingToGameView ? "Scroll View" : "Game View";

  if (switchingToGameView) {
    // Calculate sidebar width
    const sidebarWidth = sidebar.offsetWidth;

    // Apply all styles at once for better performance
    Object.assign(gameViewContainer.style, {
      position: "fixed",
      top: "0",
      left: sidebarWidth + "px",
      width: `calc(100% - ${sidebarWidth}px)`,
      height: "100%",
      zIndex: "100",
      display: "block",
      opacity: "0", // Start transparent
    });

    updateGameViewSize(elements);

    // Use setTimeout to batch DOM operations
    setTimeout(() => {
      gameViewContainer.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      gameViewContainer.style.opacity = "1";
      body.classList.add("game-mode");

      if (thirdPersonCamera && playerEntity) {
        initCamController(thirdPersonCamera, playerEntity);
      }

      cameraFollowActive = true;

      // Initialize game UI here
      initGameUI(elements);

      // Properly restore audio state when entering game view
      if (isAudioEnabled()) {
        restoreAudioState(true);
      }

      // Complete transition after animation finishes
      setTimeout(() => {
        gameState.viewMode = newViewMode;
        gameState.isTransitioning = false;
        gameViewContainer.style.transition = "";
      }, TRANSITION_DURATION);
    }, 50);
  } else {
    gameViewContainer.style.transition = `opacity ${TRANSITION_DURATION}ms ease-out`;
    gameViewContainer.style.opacity = "0";

    // Pause audio when leaving game view, but don't change enabled state
    if (isMusicPlaying()) {
      pauseMusic(true);
    }

    // Complete transition after fade out
    setTimeout(() => {
      gameViewContainer.style.display = "none";
      gameViewContainer.style.transition = "";
      body.classList.remove("game-mode");
      disposeGameUI();

      gameState.viewMode = newViewMode;
      gameState.isTransitioning = false;
    }, TRANSITION_DURATION);
  }

  handleUserInteraction();
  return switchingToGameView;
}

// Update page visibility handling for improved audio behavior
document.addEventListener("visibilitychange", () => {
  handleVisibilityChange(document.visibilityState === "visible", isGameView());
});

export function updateGameViewSize(elements, width, height) {
  const canvas = elements?.mainGameCanvas;
  if (!canvas) return;

  // Calculate dimensions if not provided
  if (!width || !height) {
    const sidebarWidth = elements?.sidebar?.offsetWidth || 0;
    width = window.innerWidth - sidebarWidth || 1;
    height = window.innerHeight || 1;
  }

  // Only update if dimensions actually changed
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;

    if (thirdPersonCamera) {
      thirdPersonCamera.aspect = width / height;
      thirdPersonCamera.updateProjectionMatrix();
    }
  }
}

function initGameControlsPanel() {
  // Wait for DOM to be ready
  document.addEventListener("DOMContentLoaded", () => {
    const controlsBox = document.querySelector(".game-controls-info");
    const closeBtn = document.querySelector(".close-btn");
    const toggleBtn = document.querySelector(".toggle-btn");
    const allKeys = document.querySelectorAll(".key[data-key]");

    if (!controlsBox || !closeBtn || !toggleBtn) return;

    // Setup keyboard highlighting with Map for O(1) lookups
    const keyMap = new Map();
    allKeys.forEach((el) => keyMap.set(el.dataset.key, el));

    // Set up event handlers
    closeBtn.addEventListener("click", () => {
      controlsBox.style.display = "none";
    });

    toggleBtn.addEventListener("click", () => {
      const collapsed = controlsBox.classList.toggle("collapsed");
      toggleBtn.textContent = collapsed ? "+" : "-";
    });

    // Create one handler for key events
    const updateKeyHighlight = (event, isPressed) => {
      let keyCode = event.code;
      // Handle right shift same as left for consistency
      if (keyCode === "ShiftRight" && keyMap.has("ShiftLeft")) {
        keyCode = "ShiftLeft";
      }

      const keyEl = keyMap.get(keyCode);
      if (keyEl) {
        keyEl.classList.toggle("active", isPressed);
      }
    };

    // Add event listeners
    document.addEventListener("keydown", (e) => updateKeyHighlight(e, true));
    document.addEventListener("keyup", (e) => updateKeyHighlight(e, false));

    // Slight delay for smooth animations
    setTimeout(() => (controlsBox.style.opacity = 1), 100);
  });
}

export async function initGame() {
  if (gameState.isInitialized) return;

  initGameControlsPanel();

  // Get all required DOM elements at once
  const elements = {
    viewToggleBtn: document.getElementById("view-toggle-btn"),
    mainGameCanvas: document.getElementById("main-game-canvas"),
    gameViewContainer: document.getElementById("game-view-container"),
    sidebar: document.querySelector(".sidebar"),
    body: document.body,
  };

  // Validate required elements
  if (
    !elements.viewToggleBtn ||
    !elements.mainGameCanvas ||
    !elements.gameViewContainer ||
    !elements.sidebar
  ) {
    console.error(
      "Game initialization failed: Required DOM elements not found"
    );
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    #game-view-container {
      transition: opacity 0.5s ease-in-out;
    }
    .game-mode-transition {
      transition: all 0.5s ease-in-out;
    }
  `;
  document.head.appendChild(style);

  // Initialize game scene
  await initGameScene();
  elements.gameViewContainer.style.display = "none";

  // Set up view toggle
  elements.viewToggleBtn.addEventListener("click", () => {
    toggleGameView(elements);
  });

  // Set initial view size
  updateGameViewSize(elements);

  // Debounce resize handler for performance
  window.addEventListener(
    "resize",
    debounce(() => {
      if (isGameView()) {
        updateGameViewSize(elements);
      }
    }, 200)
  );

  // Clean up resources on page unload
  window.addEventListener("beforeunload", () => {
    disposeAudio();
  });

  gameState.isInitialized = true;
}

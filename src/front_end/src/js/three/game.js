import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SphereGeometry,
  InstancedMesh,
  Matrix4,
  Vector3,
} from "../extern/three/three.module.min.js";
import { handleUserInteraction } from "../user-interaction.js";
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
import {
  getMovementVector,
  isMovementActive,
  isHorizontalMovementActive,
  isVerticalMovementActive,
  isAscending,
  isDescending,
  bindKey,
  unbindKey,
  setEnabled,
  getInputState,
  dispose as disposeInputManager,
} from "./input-manager.js";
import { updateAllKeyStates } from "./game-controls-ui.js";
import { TWO_PI } from "../constants/constants.js";
import { resetExpandedCards } from "./project-cards.js";
import { ISLAND_DATA } from "../data/islands.js";

const COLORS = Object.freeze({
  clouds: 0xffffff,
  islandSide: 0x8b4513,
  islandTop: 0x228b22,
  shipBody: 0x3366cc,
  shipAccent: 0x66ccff,
});

const VIEW_MODES = Object.freeze({ SCROLL: "scroll", GAME: "game" });
const TRANSITION_DURATION = 500;

const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  totalTime: 0,
  isInitialized: false,
  isTransitioning: false,
  lastFrameTime: 0,
  frameCount: 0,
};

const tempMatrix = new Matrix4();
const tempVector = new Vector3();

// Game entities and references
let thirdPersonCamera;
let cameraIndex = -1;
let playerEntity;
let islands = [];
let islandAnimationData = [];
let cameraFollowActive = true;
let gameWorker = null;
let workerBusy = false;

let sharedGeometries = null;
let sharedMaterials = null;

const objectPools = {
  vectors: [],
  matrices: [],
};

function getPooledVector() {
  return objectPools.vectors.pop() || new Vector3();
}

function returnPooledVector(vector) {
  vector.set(0, 0, 0);
  objectPools.vectors.push(vector);
}

function getPooledMatrix() {
  return objectPools.matrices.pop() || new Matrix4();
}

function returnPooledMatrix(matrix) {
  matrix.identity();
  objectPools.matrices.push(matrix);
}

export const isGameView = () => gameState.viewMode === VIEW_MODES.GAME;

function initIslandBobbing(islands) {
  islandAnimationData.length = 0; // Clear existing data

  for (let i = 0; i < islands.length; i++) {
    const island = islands[i];
    islandAnimationData.push({
      initialY: island.position.y,
      amplitude: 0.2 + random() * 0.15,
      frequency: 0.5 + random() * 0.3,
      offset: random() * TWO_PI,
      currentY: island.position.y,
      targetY: island.position.y,
    });
  }
}

const ANGLE_COUNT = 1256; // Double precision
const sinCache = new Float32Array(ANGLE_COUNT);
const cosCache = new Float32Array(ANGLE_COUNT);

function initTrigCache() {
  const step = TWO_PI / ANGLE_COUNT;
  for (let i = 0; i < ANGLE_COUNT; i++) {
    const angle = i * step;
    sinCache[i] = Math.sin(angle);
    cosCache[i] = Math.cos(angle);
  }
}

function fastSin(x) {
  const normalized = ((x % TWO_PI) + TWO_PI) % TWO_PI;
  const index = (normalized / TWO_PI) * ANGLE_COUNT;
  const lowIndex = Math.floor(index) % ANGLE_COUNT;
  const highIndex = (lowIndex + 1) % ANGLE_COUNT;
  const fraction = index - Math.floor(index);

  return (
    sinCache[lowIndex] + (sinCache[highIndex] - sinCache[lowIndex]) * fraction
  );
}

export function updateIslandBobbing(deltaTime) {
  gameState.totalTime += deltaTime;

  // Use worker when available and not busy
  if (gameWorker && !workerBusy) {
    workerBusy = true;
    gameWorker.postMessage({
      type: "calculateIslandAnimations",
      data: {
        animationData: islandAnimationData,
        totalTime: gameState.totalTime,
        deltaTime,
      },
    });
    return;
  }

  const smoothingFactor = Math.min(0.1, 0.05 * deltaTime * 60);

  // Process islands in chunks to avoid frame drops
  const chunkSize = Math.ceil(islands.length / 3);
  const startIndex = (gameState.frameCount % 3) * chunkSize;
  const endIndex = Math.min(startIndex + chunkSize, islands.length);

  for (let i = startIndex; i < endIndex; i++) {
    const island = islands[i];
    const data = islandAnimationData[i];
    if (!data) continue;

    const newY =
      data.initialY +
      fastSin(gameState.totalTime * data.frequency + data.offset) *
        data.amplitude;

    // Use lerp for smoother animation
    island.position.y += (newY - island.position.y) * smoothingFactor;
  }

  gameState.frameCount++;
}

function createSharedResources() {
  if (sharedGeometries && sharedMaterials) return;

  sharedGeometries = {
    cloud: new SphereGeometry(1, 7, 7),
    islandBase: new CylinderGeometry(2, 1.5, 2, 8),
    islandTop: new CylinderGeometry(2, 2, 0.5, 8),
  };

  sharedMaterials = {
    cloud: new MeshStandardMaterial({
      color: COLORS.clouds,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    }),
    islandBase: new MeshStandardMaterial({
      color: COLORS.islandSide,
      flatShading: true,
    }),
    islandTop: new MeshStandardMaterial({
      color: COLORS.islandTop,
      flatShading: true,
    }),
  };
}

export async function initGameScene() {
  gameState.totalTime = 0;
  gameState.frameCount = 0;
  const gameScene = getScene();

  createSharedResources();

  const cloudCount = 8;
  const cloudInstancedMesh = new InstancedMesh(
    sharedGeometries.cloud,
    sharedMaterials.cloud,
    cloudCount
  );

  // Position clouds using instanced rendering
  for (let i = 0; i < cloudCount; i++) {
    const scale = 0.8 + random() * 1.5;
    tempMatrix.compose(
      tempVector.set(
        random() * -0.5,
        5 + random() * 8,
        (random() * 1000 - 0.5) * 40
      ),
      { x: 0, y: 0, z: 0, w: 1 }, // quaternion
      { x: scale, y: scale * 0.6, z: scale } // scale
    );
    cloudInstancedMesh.setMatrixAt(i, tempMatrix);
  }
  cloudInstancedMesh.instanceMatrix.needsUpdate = true;
  gameScene.add(cloudInstancedMesh);

  islands.length = 0; // Clear existing islands

  const islandPromises = ISLAND_DATA.map(
    async ({ position, section, name }) => {
      const islandGroup = new Group();
      const baseSize = 2 + random() * 0.5;
      const topSize = 2 + random() * 0.5;

      const base = new Mesh(
        sharedGeometries.islandBase,
        sharedMaterials.islandBase
      );
      const top = new Mesh(
        sharedGeometries.islandTop,
        sharedMaterials.islandTop
      );

      // Configure meshes
      base.scale.set(baseSize / 2, 1, baseSize / 2);
      top.scale.set(topSize / 2, 1, topSize / 2);
      top.position.y = 1;

      islandGroup.add(base, top);
      islandGroup.position.copy(position);
      islandGroup.userData = { type: section, name };

      return islandGroup;
    }
  );

  // Wait for all islands to be created, then add to scene
  const createdIslands = await Promise.all(islandPromises);
  createdIslands.forEach((island) => {
    gameScene.add(island);
    islands.push(island);
  });

  // Create player entity
  playerEntity = await createPlayerModel();

  // Position player at home island
  const homeIsland = ISLAND_DATA.find(({ section }) => section === "home");
  if (homeIsland) {
    playerEntity.position.set(
      homeIsland.position.x,
      homeIsland.position.y + 2,
      homeIsland.position.z
    );
  }

  gameScene.add(playerEntity);

  // Initialize systems
  initTrigCache();
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

let lastPlayerUpdate = 0;
const PLAYER_UPDATE_INTERVAL = 16; // ~60fps

export function updateGameLoop(deltaTime) {
  const now = performance.now();

  // Update player at controlled intervals
  if (playerEntity && now - lastPlayerUpdate > PLAYER_UPDATE_INTERVAL) {
    playerEntity.visible = true;

    runFixedUpdates((fixedDeltaTime) => {
      updatePlayer(fixedDeltaTime);
      updateIslandBobbing(fixedDeltaTime);
    });

    // Cache player state to avoid recalculation
    const playerState = {
      position: playerEntity.position,
      direction: playerEntity.userData?.direction || "N",
      model: playerEntity,
    };

    updateGameUI(playerState);
    lastPlayerUpdate = now;
  }

  // Update camera if following player
  if (thirdPersonCamera && playerEntity && cameraFollowActive) {
    updateCamera(deltaTime);
  }
}

let cachedElements = null;

function getCachedElements() {
  if (!cachedElements) {
    cachedElements = {
      body: document.body,
      viewToggleBtn: document.getElementById("view-toggle-btn"),
      gameViewContainer: document.getElementById("game-view-container"),
      sidebar: document.querySelector(".sidebar"),
      mainGameCanvas: document.getElementById("main-game-canvas"),
      viewLabel: null, // Will be set when needed
    };

    if (cachedElements.viewToggleBtn) {
      cachedElements.viewLabel =
        cachedElements.viewToggleBtn.querySelector(".view-label");
    }
  }
  return cachedElements;
}

export function toggleGameView(elements = null) {
  const els = elements || getCachedElements();
  const { body, viewToggleBtn, gameViewContainer, sidebar, viewLabel } = els;

  // Validate required elements
  if (!body || !viewToggleBtn || !gameViewContainer || !sidebar) {
    console.error("Toggle game view failed: missing required elements");
    return false;
  }

  if (!viewLabel) {
    console.error("Toggle game view failed: view-label not found");
    return false;
  }

  // Prevent toggling during transitions
  if (gameState.isTransitioning) return isGameView();

  gameState.isTransitioning = true;
  const newViewMode = isGameView() ? VIEW_MODES.SCROLL : VIEW_MODES.GAME;
  const switchingToGameView = newViewMode === VIEW_MODES.GAME;

  // Reset any expanded cards when switching to game view
  if (switchingToGameView) {
    resetExpandedCards();
  }

  // Update button text
  viewLabel.textContent = switchingToGameView ? "Scroll View" : "Game View";

  // Remove focus from the button to prevent space key activation
  if (document.activeElement === viewToggleBtn) {
    viewToggleBtn.blur();
  }

  if (switchingToGameView) {
    const sidebarWidth = sidebar.offsetWidth;
    const styleUpdates = {
      position: "fixed",
      top: "0",
      left: sidebarWidth + "px",
      width: `calc(100% - ${sidebarWidth}px)`,
      height: "100%",
      zIndex: "100",
      display: "block",
      opacity: "0",
    };

    Object.assign(gameViewContainer.style, styleUpdates);
    updateGameViewSize(els);

    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      gameViewContainer.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      gameViewContainer.style.opacity = "1";
      body.classList.add("game-mode");

      if (thirdPersonCamera && playerEntity) {
        initCamController(thirdPersonCamera, playerEntity);
      }

      cameraFollowActive = true;
      initGameUI(els);
      setEnabled(true);

      setTimeout(() => updateAllKeyStates(), 200);

      if (isAudioEnabled()) {
        restoreAudioState(true);
      }

      setTimeout(() => {
        gameState.viewMode = newViewMode;
        gameState.isTransitioning = false;
        gameViewContainer.style.transition = "";
      }, TRANSITION_DURATION);
    });
  } else {
    gameViewContainer.style.transition = `opacity ${TRANSITION_DURATION}ms ease-out`;
    gameViewContainer.style.opacity = "0";
    setEnabled(false);

    if (isMusicPlaying()) {
      pauseMusic(true);
    }

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

let visibilityTimeout = null;

document.addEventListener("visibilitychange", () => {
  if (visibilityTimeout) {
    clearTimeout(visibilityTimeout);
  }

  visibilityTimeout = setTimeout(() => {
    const isVisible = document.visibilityState === "visible";
    handleVisibilityChange(isVisible, isGameView());
    setEnabled(isVisible && isGameView());
  }, 100);
});

let resizeRAF = null;

export function updateGameViewSize(elements, width, height) {
  const canvas = elements?.mainGameCanvas;
  if (!canvas) return;

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

// Cache movement input to avoid recalculation
let cachedMovementInput = null;
let lastMovementUpdate = 0;

export function getPlayerMovementInput() {
  if (!isGameView()) {
    return {
      movement: { x: 0, y: 0, z: 0 },
      isMoving: false,
      isHorizontalMoving: false,
      isVerticalMoving: false,
      isAscending: false,
      isDescending: false,
    };
  }

  const now = performance.now();

  // Cache movement input for performance
  if (!cachedMovementInput || now - lastMovementUpdate > 16) {
    const movement = getMovementVector();
    const isMoving = isMovementActive();
    const isHorizontalMoving = isHorizontalMovementActive();
    const isVerticalMoving = isVerticalMovementActive();
    const ascending = isAscending();
    const descending = isDescending();

    cachedMovementInput = {
      movement,
      isMoving,
      isHorizontalMoving,
      isVerticalMoving,
      isAscending: ascending,
      isDescending: descending,
    };

    lastMovementUpdate = now;
  }

  return cachedMovementInput;
}

let inputBindingsInitialized = false;

function initGameInputBindings() {
  if (inputBindingsInitialized) return;

  const keysToUnbind = ["Escape", "KeyC", "KeyT", "KeyR", "KeyI", "Space"];
  keysToUnbind.forEach((key) => unbindKey(key));

  const bindingConfigs = [
    {
      key: "Escape",
      action: () => {
        if (isGameView()) {
          toggleGameView();
        }
      },
      preventDefault: true,
    },
    {
      key: "KeyC",
      action: () => {
        if (isGameView()) {
          cameraFollowActive = !cameraFollowActive;
          console.log(
            "Camera follow:",
            cameraFollowActive ? "enabled" : "disabled"
          );
        }
      },
    },
    {
      key: "KeyT",
      action: () => {
        if (isGameView()) {
          const inputState = getInputState();
          const movementInput = getPlayerMovementInput();
          console.log("=== Input Debug Info ===");
          console.log("Input State:", inputState);
          console.log("Movement Input:", movementInput);
          console.log("========================");
        }
      },
    },
    {
      key: "KeyR",
      action: () => {
        if (isGameView() && playerEntity) {
          const homeIsland = ISLAND_DATA.find(
            ({ section }) => section === "home"
          );
          if (homeIsland) {
            playerEntity.position.set(
              homeIsland.position.x,
              homeIsland.position.y + 2,
              homeIsland.position.z
            );
            console.log("Player position reset to home island");
          }
        }
      },
    },
    {
      key: "KeyI",
      action: () => {
        if (isGameView()) {
          const inputState = getInputState();
          console.log("Input Manager State:", inputState);
          const movement = getPlayerMovementInput();
          console.log("Detailed Movement State:", movement);
        }
      },
    },
    {
      key: "Space",
      action: () => {
        // Prevent space from accidentally triggering buttons when focused
        if (
          document.activeElement &&
          document.activeElement.tagName === "BUTTON"
        ) {
          document.activeElement.blur();
        }
      },
      preventDefault: true,
    },
  ];

  bindingConfigs.forEach(({ key, action, preventDefault }) => {
    bindKey(key, {
      onPress: action,
      preventDefault: preventDefault || false,
    });
  });

  inputBindingsInitialized = true;
  console.log("Game input bindings initialized (optimized)");
}

export async function initGame() {
  if (gameState.isInitialized) return;

  initGameInputBindings();

  const elements = getCachedElements();

  // Validate required elements with proper checking
  const requiredElements = {
    viewToggleBtn: elements.viewToggleBtn,
    mainGameCanvas: elements.mainGameCanvas,
    gameViewContainer: elements.gameViewContainer,
    sidebar: elements.sidebar,
  };

  const missing = Object.entries(requiredElements)
    .filter(([key, element]) => !element)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(
      `Game initialization failed: Missing elements: ${missing.join(", ")}`
    );
    console.log("Available elements:", {
      viewToggleBtn: !!elements.viewToggleBtn,
      mainGameCanvas: !!elements.mainGameCanvas,
      gameViewContainer: !!elements.gameViewContainer,
      sidebar: !!elements.sidebar,
    });
    return;
  }

  // Add styles only once
  if (!document.getElementById("game-styles")) {
    const style = document.createElement("style");
    style.id = "game-styles";
    style.textContent = `
      #game-view-container {
        transition: opacity 0.5s ease-in-out;
      }
      .game-mode-transition {
        transition: all 0.5s ease-in-out;
      }

      /* Prevent focus outline on toggle button after click */
      #view-toggle-btn:focus:not(:focus-visible) {
        outline: none;
      }
    `;
    document.head.appendChild(style);
  }

  await initGameScene();
  elements.gameViewContainer.style.display = "none";

  // Add enhanced click handler for the toggle button
  elements.viewToggleBtn.addEventListener("click", (event) => {
    toggleGameView(elements);

    // Prevent the button from staying focused after click
    setTimeout(() => {
      if (document.activeElement === elements.viewToggleBtn) {
        elements.viewToggleBtn.blur();
      }
    }, 100);
  });

  // Add keyboard event handler to prevent space activation on focused button
  elements.viewToggleBtn.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      document.activeElement === elements.viewToggleBtn
    ) {
      event.preventDefault();
      elements.viewToggleBtn.blur();
    }
  });

  updateGameViewSize(elements);
  setEnabled(false);

  // Optimized resize handler
  window.addEventListener("resize", () => {
    if (resizeRAF) {
      cancelAnimationFrame(resizeRAF);
    }

    resizeRAF = requestAnimationFrame(() => {
      if (isGameView()) {
        updateGameViewSize(elements);
      }
    });
  });

  // Clean up resources on page unload
  window.addEventListener("beforeunload", () => {
    disposeAudio();
    disposeInputManager();

    // Clean up object pools
    objectPools.vectors.length = 0;
    objectPools.matrices.length = 0;

    // Clear caches
    cachedElements = null;
    cachedMovementInput = null;
  });

  gameState.isInitialized = true;
  console.log("Game initialized with comprehensive optimizations");
}

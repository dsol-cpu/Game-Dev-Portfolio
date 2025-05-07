/**
 * @fileoverview Game scene with player model and camera follow
 **/

import { CAMERA_SECTIONS } from "../data/sections.js";
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
import { createCameraController, updateCamera } from "./camera-follow.js";
import {
  createPlayerModel,
  initPlayerControls,
  updatePlayer,
} from "./player.js";
import {
  forceRedraw,
  getScene,
  isCameraActive,
  registerCamera,
  setCameraVisible,
} from "./threejs-manager.js";

// Constants
const COLORS = {
  clouds: 0xffffff,
  islandSide: 0x8b4513,
  islandTop: 0x228b22,
  shipBody: 0x3366cc,
  shipAccent: 0x66ccff,
};
export const ISLAND_DATA = [
  {
    name: "Home Island",
    position: new Vector3(0, 0, 1000),
    section: "home",
  },
  {
    name: "Experience Island",
    position: new Vector3(912, 304, 304),
    section: "experience",
  },
  {
    name: "Projects Island",
    position: new Vector3(-371, 93, -928),
    section: "projects",
  },
  {
    name: "Resume Island",
    position: new Vector3(-229, 114, 915),
    section: "resume",
  },
];
const VIEW_MODES = { SCROLL: "scroll", GAME: "game" };

// Game state & objects
let thirdPersonCamera,
  camController,
  cameraIndex = -1,
  playerEntity,
  gameAnimationFrameId,
  islands = [],
  islandAnimationData = [],
  cameraFollowActive = true;

// Game controller state
const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  lastCanvasWidth: 0,
  lastCanvasHeight: 0,
  isInitialized: false,
  totalTime: 0,
};

/**
 * Initialize island bobbing animation
 */
function initIslandBobbing(islands) {
  islands.forEach(() =>
    islandAnimationData.push({
      initialY: islands[islandAnimationData.length].position.y,
      amplitude: 0.2 + Math.random() * 0.15,
      frequency: 0.5 + Math.random() * 0.3,
      offset: Math.random() * Math.PI * 2,
    })
  );
}

/**
 * Update island bobbing animation
 */
export function updateIslandBobbing(deltaTime) {
  gameState.totalTime += deltaTime;
  islands.forEach((island, i) => {
    if (islandAnimationData[i]) {
      const data = islandAnimationData[i];
      const newY =
        data.initialY +
        Math.sin(gameState.totalTime * data.frequency + data.offset) *
          data.amplitude;
      const smoothingFactor = 0.05 * Math.min(1, deltaTime * 60);
      island.position.y += (newY - island.position.y) * smoothingFactor;
    }
  });
}

/**
 * Initialize game scene
 */
export async function initGameScene() {
  gameState.totalTime = 0;
  const gameScene = getScene();

  // Create reusable geometries and materials
  const cloudGeometry = new SphereGeometry(1, 7, 7),
    cloudMaterial = new MeshStandardMaterial({
      color: COLORS.clouds,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    }),
    islandBaseGeometry = new CylinderGeometry(2, 1.5, 2, 8),
    islandBaseMaterial = new MeshStandardMaterial({
      color: COLORS.islandSide,
      flatShading: true,
    }),
    islandTopGeometry = new CylinderGeometry(2, 2, 0.5, 8),
    islandTopMaterial = new MeshStandardMaterial({
      color: COLORS.islandTop,
      flatShading: true,
    });

  // Create islands
  ISLAND_DATA.forEach(({ position, section, name }) => {
    const islandGroup = new Group(),
      baseSize = 2 + Math.random() * 0.5,
      topSize = 2 + Math.random() * 0.5,
      base = new Mesh(islandBaseGeometry.clone(), islandBaseMaterial),
      top = new Mesh(islandTopGeometry.clone(), islandTopMaterial);

    base.scale.set(baseSize / 2, 1, baseSize / 2);
    top.scale.set(topSize / 2, 1, topSize / 2);
    top.position.y = 1;

    islandGroup.add(base, top);
    islandGroup.position.copy(position);
    islandGroup.userData = { type: section, name };

    gameScene.add(islandGroup);
    islands.push(islandGroup);
  });

  // Create clouds (reduced count for performance)
  for (let i = 0; i < 8; i++) {
    const cloud = new Mesh(cloudGeometry.clone(), cloudMaterial),
      scale = 0.8 + Math.random() * 1.5;

    cloud.position.set(
      (Math.random() - 0.5) * 40,
      5 + Math.random() * 8,
      (Math.random() - 0.5) * 40
    );
    cloud.scale.set(scale, scale * 0.6, scale);
    gameScene.add(cloud);
  }

  // Create player
  playerEntity = await createPlayerModel();
  const homeIsland = ISLAND_DATA.find(({ section }) => section === "home");
  playerEntity.position.set(
    homeIsland?.position.x || 0,
    (homeIsland?.position.y || 0) + 2,
    homeIsland?.position.z || 0
  );

  gameScene.add(playerEntity);
  initIslandBobbing(islands);
  initPlayerControls();
  const CAMERA_FOV = { DEFAULT_FOV: 75, NEAR: 0.1, FAR: 1000 };

  // Setup camera
  thirdPersonCamera = new PerspectiveCamera(
    CAMERA_FOV.DEFAULT_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_FOV.NEAR,
    CAMERA_FOV.FAR
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 2, 0);

  camController = createCameraController(thirdPersonCamera, playerEntity);

  // Register camera with manager
  cameraIndex = registerCamera(
    thirdPersonCamera,
    () => cameraFollowActive && camController?.(),
    document.getElementById("main-game-canvas")?.getContext("2d"),
    {
      type: CAMERA_SECTIONS.GAME,
      elementId: "game-view",
      section: CAMERA_SECTIONS.GAME,
    },
    false
  );
}

/**
 * Update game loop
 */
export function updateGameLoop(deltaTime) {
  if (gameState.viewMode !== VIEW_MODES.GAME) return;

  // Update entities
  playerEntity && ((playerEntity.visible = true), updatePlayer(deltaTime));
  thirdPersonCamera &&
    playerEntity &&
    cameraFollowActive &&
    updateCamera(thirdPersonCamera, playerEntity, deltaTime);
  // updateIslandBobbing(deltaTime);

  // Update debug overlay if available
  // updateDebugOverlay(playerEntity?.__controls || window._playerControls);

  // Force redraw
  cameraIndex >= 0 && isCameraActive(cameraIndex) && forceRedraw(cameraIndex);

  // Apply frame capping before scheduling next frame
  // TimeManager.applyFrameCapping().then(() => {
  //   gameAnimationFrameId = requestAnimationFrame(updateGameLoop);
  // });
}

/**
 * Toggle game view
 */
export function toggleGameView(elements) {
  if (
    !elements?.body ||
    !elements?.viewToggleBtn ||
    !elements?.gameViewContainer ||
    !elements?.sidebar
  ) {
    console.error("Toggle game view failed: missing required elements");
    return false;
  }

  const viewLabel = elements.viewToggleBtn.querySelector(".view-label");
  if (!viewLabel) {
    console.error("Toggle game view failed: view-label not found");
    return false;
  }

  // Toggle state
  gameState.viewMode =
    gameState.viewMode === VIEW_MODES.GAME
      ? VIEW_MODES.SCROLL
      : VIEW_MODES.GAME;
  const isGameView = gameState.viewMode === VIEW_MODES.GAME;

  // Update camera visibility
  cameraIndex >= 0 && setCameraVisible(cameraIndex, isGameView);

  if (isGameView) {
    // Switch to game view
    elements.body.classList.add("game-mode");
    viewLabel.textContent = "Scroll View";

    const sidebarWidth = elements.sidebar.offsetWidth;
    Object.assign(elements.gameViewContainer.style, {
      position: "fixed",
      top: "0",
      left: sidebarWidth + "px",
      width: `calc(100% - ${sidebarWidth}px)`,
      height: "100%",
      zIndex: "100",
      display: "block",
    });

    updateGameViewSize(elements);

    // Ensure camera controller is working
    !camController &&
      thirdPersonCamera &&
      playerEntity &&
      (camController = createCameraController(thirdPersonCamera, playerEntity));

    cameraFollowActive = true;
    camController?.();

    // Start game loop
    gameAnimationFrameId && cancelAnimationFrame(gameAnimationFrameId);
    gameAnimationFrameId = requestAnimationFrame(updateGameLoop);
  } else {
    // Switch to scroll view
    elements.body.classList.remove("game-mode");
    viewLabel.textContent = "Game View";
    elements.gameViewContainer.style.display = "none";

    // Stop game loop
    gameAnimationFrameId &&
      (cancelAnimationFrame(gameAnimationFrameId),
      (gameAnimationFrameId = null));
  }

  handleUserInteraction();
  cameraIndex >= 0 && forceRedraw(cameraIndex);

  return isGameView;
}

/**
 * Update game view size
 */
export function updateGameViewSize(elements, width, height) {
  const canvas = elements?.mainGameCanvas;
  if (!canvas) return;

  // Calculate dimensions if not provided
  if (!width || !height) {
    const sidebarWidth = elements?.sidebar?.offsetWidth || 0;
    width = window.innerWidth - sidebarWidth || 1;
    height = window.innerHeight || 1;
  }

  // Only update if changed
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gameState.lastCanvasWidth = width;
    gameState.lastCanvasHeight = height;

    thirdPersonCamera &&
      ((thirdPersonCamera.aspect = width / height),
      thirdPersonCamera.updateProjectionMatrix());

    cameraIndex >= 0 && forceRedraw(cameraIndex);
  }
}

/**
 * Initialize game module
 */
export async function initGame() {
  if (gameState.isInitialized) return;

  // Get required DOM elements
  const elements = {
    viewToggleBtn: document.getElementById("view-toggle-btn"),
    mainGameCanvas: document.getElementById("main-game-canvas"),
    gameViewContainer: document.getElementById("game-view-container"),
    sidebar: document.querySelector(".sidebar"),
    body: document.body,
  };

  // Validate elements
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

  // Initialize game
  await initGameScene();
  elements.gameViewContainer.style.display = "none";

  // Set up event listeners
  elements.viewToggleBtn.addEventListener("click", () =>
    toggleGameView(elements)
  );

  // Set up resize handling
  updateGameViewSize(elements);
  window.addEventListener(
    "resize",
    debounce(() => {
      gameState.viewMode === VIEW_MODES.GAME && updateGameViewSize(elements);
    }, 200)
  );

  gameState.isInitialized = true;
}

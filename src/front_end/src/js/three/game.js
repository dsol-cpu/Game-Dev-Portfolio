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
import { initCamController, updateCamera } from "./camera-follow.js";
import {
  createPlayerModel,
  initPlayerControls,
  updatePlayer,
} from "./player.js";
import {
  getScene,
  registerCamera,
  getAllCameras,
  renderFrame,
} from "./threejs-manager.js";
import { initGameUI, updateGameUI, disposeGameUI } from "./game-ui.js";

const COLORS = {
  clouds: 0xffffff,
  islandSide: 0x8b4513,
  islandTop: 0x228b22,
  shipBody: 0x3366cc,
  shipAccent: 0x66ccff,
};

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

let thirdPersonCamera,
  cameraIndex = -1,
  playerEntity,
  islands = [],
  islandAnimationData = [],
  cameraFollowActive = true;

const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  totalTime: 0,
  isInitialized: false,
};

let gameWorker = null;
let workerBusy = false;
let pendingAnimationData = [];

/**
 * Checks if the current view mode is game view
 * @returns {boolean} True if in game view, false otherwise
 */
export function isGameView() {
  return gameState.viewMode === VIEW_MODES.GAME;
}

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

export function updateIslandBobbing(deltaTime) {
  gameState.totalTime += deltaTime;

  // For small numbers of islands, you might not need a worker
  // But if you have many islands or complex animations, the worker helps
  if (islands.length > 5) {
    // If worker isn't busy, send a new calculation request
    if (!workerBusy && gameWorker) {
      workerBusy = true;

      // Prepare data for the worker
      // We only send the minimum data needed to avoid large transfers
      const islandData = islands.map((island, i) => ({
        currentY: island.position.y,
        animationData: islandAnimationData[i],
      }));

      gameWorker.postMessage({
        type: "calculateIslandAnimations",
        data: {
          islands: islandData,
          totalTime: gameState.totalTime,
          deltaTime,
        },
      });
    }
  } else {
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
}

export async function initGameScene() {
  gameState.totalTime = 0;
  const gameScene = getScene();

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

  ISLAND_DATA.forEach(({ position, section, name }) => {
    const islandGroup = new Group();
    const baseSize = 2 + Math.random() * 0.5;
    const topSize = 2 + Math.random() * 0.5;
    const base = new Mesh(islandBaseGeometry.clone(), islandBaseMaterial);
    const top = new Mesh(islandTopGeometry.clone(), islandTopMaterial);

    base.scale.set(baseSize / 2, 1, baseSize / 2);
    top.scale.set(topSize / 2, 1, topSize / 2);
    top.position.y = 1;

    islandGroup.add(base, top);
    islandGroup.position.copy(position);
    islandGroup.userData = { type: section, name };

    gameScene.add(islandGroup);
    islands.push(islandGroup);
  });

  for (let i = 0; i < 8; i++) {
    const cloud = new Mesh(cloudGeometry.clone(), cloudMaterial);
    const scale = 0.8 + Math.random() * 1.5;

    cloud.position.set(
      Math.random() * -0.5,
      5 + Math.random() * 8,
      (Math.random() * 1000 - 0.5) * 40
    );
    cloud.scale.set(scale, scale * 0.6, scale);
    gameScene.add(cloud);
  }

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
  /*  */
  thirdPersonCamera = new PerspectiveCamera(
    75, // FOV
    window.innerWidth / window.innerHeight,
    0.1, // Near
    100 // Far
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 2, 0);

  initCamController(thirdPersonCamera, playerEntity);

  // Get the canvas context
  const gameCanvas = document.getElementById("main-game-canvas");
  const gameCanvasContext = gameCanvas?.getContext("2d");

  cameraIndex = registerCamera(thirdPersonCamera, gameCanvasContext, {
    type: CAMERA_SECTIONS.GAME,
    elementId: "game-view",
    section: CAMERA_SECTIONS.GAME,
  });
}

export function updateGameLoop(deltaTime) {
  // No need to check viewMode here since main.js will handle this check
  if (playerEntity) {
    playerEntity.visible = true;
    updatePlayer(deltaTime);

    // Update the UI with player state
    updateGameUI({
      position: playerEntity.position,
      direction: playerEntity.userData?.direction || "N",
      model: playerEntity,
    });
  }

  if (thirdPersonCamera && playerEntity && cameraFollowActive) {
    updateCamera(deltaTime);
  }
}

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

  gameState.viewMode =
    gameState.viewMode === VIEW_MODES.GAME
      ? VIEW_MODES.SCROLL
      : VIEW_MODES.GAME;
  const isGameView = gameState.viewMode === VIEW_MODES.GAME;

  if (isGameView) {
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

    if (thirdPersonCamera && playerEntity) {
      initCamController(thirdPersonCamera, playerEntity);
    }

    cameraFollowActive = true;
  } else {
    elements.body.classList.remove("game-mode");
    viewLabel.textContent = "Game View";
    elements.gameViewContainer.style.display = "none";

    // Dispose UI when exiting game view
    disposeGameUI();
  }

  handleUserInteraction();
  renderFrame();

  return isGameView;
}

export function updateGameViewSize(elements, width, height) {
  const canvas = elements?.mainGameCanvas;
  if (!canvas) return;

  if (!width || !height) {
    const sidebarWidth = elements?.sidebar?.offsetWidth || 0;
    width = window.innerWidth - sidebarWidth || 1;
    height = window.innerHeight || 1;
  }

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;

    if (thirdPersonCamera) {
      thirdPersonCamera.aspect = width / height;
      thirdPersonCamera.updateProjectionMatrix();
    }

    renderFrame();
  }
}

function initGameControlsPanel() {
  document.addEventListener("DOMContentLoaded", () => {
    const controlsBox = document.querySelector(".game-controls-info");
    const closeBtn = document.querySelector(".close-btn");
    const toggleBtn = document.querySelector(".toggle-btn");
    const allKeys = document.querySelectorAll(".key[data-key]");

    if (!controlsBox || !closeBtn || !toggleBtn) {
      console.warn("Game controls panel elements not found");
      return;
    }

    // Build a map from key code to element
    const keyMap = new Map();
    allKeys.forEach((el) => {
      keyMap.set(el.dataset.key, el);
    });

    // Close panel
    closeBtn.addEventListener("click", () => {
      controlsBox.style.display = "none";
    });

    // Toggle panel
    toggleBtn.addEventListener("click", () => {
      const collapsed = controlsBox.classList.toggle("collapsed");
      toggleBtn.textContent = collapsed ? "+" : "-";
    });

    // Key event handler
    const updateKeyHighlight = (event, isPressed) => {
      let keyCode = event.code;

      // Normalize ShiftRight -> ShiftLeft (if only one visual element)
      if (keyCode === "ShiftRight" && keyMap.has("ShiftLeft")) {
        keyCode = "ShiftLeft";
      }

      const keyEl = keyMap.get(keyCode);
      if (keyEl) {
        keyEl.classList.toggle("active", isPressed);
      }
    };

    // Attach single listeners
    document.addEventListener("keydown", (e) => updateKeyHighlight(e, true));
    document.addEventListener("keyup", (e) => updateKeyHighlight(e, false));

    // Fade in controls panel
    setTimeout(() => {
      controlsBox.style.opacity = 1;
    }, 100);
  });
}

export async function initGame() {
  if (gameState.isInitialized) return;

  initGameControlsPanel();
  const elements = {
    viewToggleBtn: document.getElementById("view-toggle-btn"),
    mainGameCanvas: document.getElementById("main-game-canvas"),
    gameViewContainer: document.getElementById("game-view-container"),
    sidebar: document.querySelector(".sidebar"),
    body: document.body,
  };

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

  // Now initialize the game scene
  await initGameScene();
  elements.gameViewContainer.style.display = "none";

  elements.viewToggleBtn.addEventListener("click", () => {
    const isGameView = toggleGameView(elements);

    // Initialize UI when entering game view
    if (isGameView) {
      initGameUI(elements);
    }
  });

  updateGameViewSize(elements);
  window.addEventListener(
    "resize",
    debounce(() => {
      if (isGameView()) {
        updateGameViewSize(elements);
      }
    }, 200)
  );

  gameState.isInitialized = true;
}

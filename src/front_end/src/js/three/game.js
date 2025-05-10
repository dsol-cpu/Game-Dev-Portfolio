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
import { getScene, registerCamera, renderFrame } from "./threejs-manager.js";
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

// Audio system variables
let audioContext = null;
let musicSource = null;
let musicBuffer = null;
let gainNode = null;
let musicPlaying = false;
let audioInitialized = false;

const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  totalTime: 0,
  isInitialized: false,
  audioEnabled: true, // Default audio state
};

let gameWorker = null;
let workerBusy = false;

export const isGameView = () => gameState.viewMode === VIEW_MODES.GAME;

// Audio system initialization
function initAudioSystem() {
  if (audioInitialized) return;

  try {
    // Create audio context only when needed (lazy initialization)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0.5; // Set default volume to 50%
    gainNode.connect(audioContext.destination);

    // Load background music
    loadBackgroundMusic();
    audioInitialized = true;
  } catch (error) {
    console.error("Audio system initialization failed:", error);
  }
}

// Load background music file
function loadBackgroundMusic() {
  // Only load if not already loaded
  if (musicBuffer) return;

  // Path to your background music file
  const musicUrl = "/audio/Little Jack (Nasrad, Ixa'taka, Valua).mp3";

  fetch(musicUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => {
      // Decode asynchronously
      return audioContext.decodeAudioData(arrayBuffer);
    })
    .then((buffer) => {
      musicBuffer = buffer;
      // If in game mode and audio enabled, start playing
      if (isGameView() && gameState.audioEnabled) {
        playBackgroundMusic();
      }
    })
    .catch((error) => {
      console.error("Error loading background music:", error);
    });
}

// Play background music with loop
function playBackgroundMusic() {
  if (!audioContext || !musicBuffer || musicPlaying) return;

  // Resume audio context if suspended (needed for Chrome's autoplay policy)
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  // Create a new source node
  musicSource = audioContext.createBufferSource();
  musicSource.buffer = musicBuffer;
  musicSource.loop = true;

  // Connect to gain node for volume control
  musicSource.connect(gainNode);

  // Start playing with crossfade
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 1);
  musicSource.start(0);
  musicPlaying = true;
}

// Stop background music with fade out
function stopBackgroundMusic() {
  if (!musicSource || !musicPlaying) return;

  // Fade out
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

  // Schedule stop after fade
  setTimeout(() => {
    if (musicSource) {
      musicSource.stop();
      musicSource.disconnect();
      musicSource = null;
    }
    musicPlaying = false;
  }, 500);
}

// Toggle background music
export function toggleBackgroundMusic() {
  gameState.audioEnabled = !gameState.audioEnabled;

  // Initialize audio system if needed
  if (!audioInitialized && gameState.audioEnabled) {
    initAudioSystem();
    return; // Loading will trigger playback once complete
  }

  if (gameState.audioEnabled) {
    playBackgroundMusic();
  } else {
    stopBackgroundMusic();
  }

  // Update UI to reflect music state
  const musicToggleBtn = document.getElementById("music-toggle-btn");
  if (musicToggleBtn) {
    musicToggleBtn.classList.toggle("active", gameState.audioEnabled);
    musicToggleBtn.setAttribute(
      "aria-pressed",
      gameState.audioEnabled.toString()
    );
    musicToggleBtn.title = gameState.audioEnabled ? "Mute Music" : "Play Music";
  }

  return gameState.audioEnabled;
}

// Suspend audio context when not in use to save resources
function suspendAudioWhenInactive() {
  if (audioContext && audioContext.state === "running" && !isGameView()) {
    stopBackgroundMusic();
    audioContext.suspend();
  }
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

  if (islands.length > 5 && gameWorker && !workerBusy) {
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

  thirdPersonCamera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  thirdPersonCamera.position.set(0, 2, 5);
  thirdPersonCamera.lookAt(0, 2, 0);

  initCamController(thirdPersonCamera, playerEntity);

  const gameCanvas = document.getElementById("main-game-canvas");
  const gameCanvasContext = gameCanvas?.getContext("2d");

  cameraIndex = registerCamera(thirdPersonCamera, gameCanvasContext, {
    type: CAMERA_SECTIONS.GAME,
    elementId: "game-view",
    section: CAMERA_SECTIONS.GAME,
  });
}

export function updateGameLoop(deltaTime) {
  if (playerEntity) {
    playerEntity.visible = true;
    updatePlayer(deltaTime);
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

  const isGameViewMode = isGameView();

  if (isGameViewMode) {
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

    // Initialize audio when entering game mode
    if (!audioInitialized && gameState.audioEnabled) {
      initAudioSystem();
    } else if (audioInitialized && gameState.audioEnabled && !musicPlaying) {
      // Resume audio context if it was suspended
      if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
      }
      playBackgroundMusic();
    }
  } else {
    elements.body.classList.remove("game-mode");
    viewLabel.textContent = "Game View";
    elements.gameViewContainer.style.display = "none";
    disposeGameUI();

    // Suspend audio when exiting game mode to save resources
    suspendAudioWhenInactive();
  }

  handleUserInteraction();
  renderFrame();

  return isGameViewMode;
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

// Create music toggle button in game controls
function createMusicToggleButton(controlsBox) {
  if (!controlsBox) return;

  const musicToggleContainer = document.createElement("div");
  musicToggleContainer.className = "control-group";

  const musicToggleLabel = document.createElement("span");
  musicToggleLabel.textContent = "Music:";
  musicToggleLabel.className = "control-label";

  const musicToggleBtn = document.createElement("button");
  musicToggleBtn.id = "music-toggle-btn";
  musicToggleBtn.className =
    "control-btn" + (gameState.audioEnabled ? " active" : "");
  musicToggleBtn.innerHTML = '<span class="music-icon">♪</span>';
  musicToggleBtn.title = gameState.audioEnabled ? "Mute Music" : "Play Music";
  musicToggleBtn.setAttribute(
    "aria-pressed",
    gameState.audioEnabled.toString()
  );

  musicToggleBtn.addEventListener("click", toggleBackgroundMusic);

  musicToggleContainer.appendChild(musicToggleLabel);
  musicToggleContainer.appendChild(musicToggleBtn);

  // Add to controls box after the close button
  const closeBtn = controlsBox.querySelector(".close-btn");
  if (closeBtn && closeBtn.parentNode) {
    closeBtn.parentNode.insertBefore(
      musicToggleContainer,
      closeBtn.nextSibling
    );
  } else {
    controlsBox.appendChild(musicToggleContainer);
  }
}

function initGameControlsPanel() {
  document.addEventListener("DOMContentLoaded", () => {
    const controlsBox = document.querySelector(".game-controls-info");
    const closeBtn = document.querySelector(".close-btn");
    const toggleBtn = document.querySelector(".toggle-btn");
    const allKeys = document.querySelectorAll(".key[data-key]");

    if (!controlsBox || !closeBtn || !toggleBtn) return;

    // Add music toggle button to controls
    createMusicToggleButton(controlsBox);

    const keyMap = new Map();
    allKeys.forEach((el) => keyMap.set(el.dataset.key, el));

    closeBtn.addEventListener("click", () => {
      controlsBox.style.display = "none";
    });

    toggleBtn.addEventListener("click", () => {
      const collapsed = controlsBox.classList.toggle("collapsed");
      toggleBtn.textContent = collapsed ? "+" : "-";
    });

    const updateKeyHighlight = (event, isPressed) => {
      let keyCode = event.code;
      if (keyCode === "ShiftRight" && keyMap.has("ShiftLeft")) {
        keyCode = "ShiftLeft";
      }

      const keyEl = keyMap.get(keyCode);
      if (keyEl) {
        keyEl.classList.toggle("active", isPressed);
      }
    };

    document.addEventListener("keydown", (e) => updateKeyHighlight(e, true));
    document.addEventListener("keyup", (e) => updateKeyHighlight(e, false));

    setTimeout(() => {
      controlsBox.style.opacity = 1;
    }, 100);
  });
}

// Clean up audio resources to prevent memory leaks
export function disposeAudio() {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch (e) {
      // Ignore if already stopped
    }
    musicSource.disconnect();
    musicSource = null;
  }

  if (gainNode) {
    gainNode.disconnect();
  }

  if (audioContext) {
    audioContext.close();
  }

  musicPlaying = false;
  audioInitialized = false;
}

// Handle page visibility changes to optimize audio performance
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Suspend audio when page is not visible
    if (audioContext && audioContext.state === "running") {
      audioContext.suspend();
    }
  } else if (document.visibilityState === "visible") {
    // Resume audio when page becomes visible again (if in game mode and enabled)
    if (
      audioContext &&
      audioContext.state === "suspended" &&
      isGameView() &&
      gameState.audioEnabled
    ) {
      audioContext.resume();
      if (!musicPlaying) {
        playBackgroundMusic();
      }
    }
  }
});

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

  await initGameScene();
  elements.gameViewContainer.style.display = "none";

  elements.viewToggleBtn.addEventListener("click", () => {
    const isGameViewMode = toggleGameView(elements);
    if (isGameViewMode) {
      initGameUI(elements);
    }
  });

  updateGameViewSize(elements);
  window.addEventListener(
    "resize",
    debounce(() => {
      if (isGameView()) updateGameViewSize(elements);
    }, 200)
  );

  // Add window unload event listener to clean up resources
  window.addEventListener("beforeunload", () => {
    disposeAudio();
  });

  gameState.isInitialized = true;
}

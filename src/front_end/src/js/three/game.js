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
const MUSIC_URL = "/audio/Little Jack (Nasrad, Ixa'taka, Valua).mp3";
const TRANSITION_DURATION = 500; // ms for view transition

// Game state and references - All consolidated for faster access
const gameState = {
  viewMode: VIEW_MODES.SCROLL,
  totalTime: 0,
  isInitialized: false,
  audioEnabled: true,
  isTransitioning: false,
};

// Audio system state - Consolidated
const audioState = {
  context: null,
  musicSource: null,
  musicBuffer: null,
  gainNode: null,
  playing: false,
  initialized: false,
  startTime: 0,
  pauseTime: 0,
  pausedAt: 0,
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

function initAudioSystem() {
  if (audioState.initialized) return;

  try {
    // Create audio context and gain node once
    audioState.context = new (window.AudioContext ||
      window.webkitAudioContext)();
    audioState.gainNode = audioState.context.createGain();
    audioState.gainNode.gain.value = 0.5;
    audioState.gainNode.connect(audioState.context.destination);

    loadBackgroundMusic();
    audioState.initialized = true;
  } catch (error) {
    console.error("Audio system initialization failed:", error);
  }
}

function loadBackgroundMusic() {
  if (audioState.musicBuffer) return;

  fetch(MUSIC_URL)
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => audioState.context.decodeAudioData(arrayBuffer))
    .then((buffer) => {
      audioState.musicBuffer = buffer;
      // Auto-play if in game view and audio enabled
      if (isGameView() && gameState.audioEnabled) playBackgroundMusic();
    })
    .catch((error) => console.error("Error loading background music:", error));
}

function playBackgroundMusic(resumeFromPosition = 0) {
  // Skip if not ready or already playing
  if (!audioState.context || !audioState.musicBuffer || audioState.playing)
    return;

  // Resume suspended context first if needed
  if (audioState.context.state === "suspended") audioState.context.resume();

  // Create and connect source node
  audioState.musicSource = audioState.context.createBufferSource();
  audioState.musicSource.buffer = audioState.musicBuffer;
  audioState.musicSource.loop = true;
  audioState.musicSource.connect(audioState.gainNode);

  // Fade in for smooth transition
  audioState.gainNode.gain.setValueAtTime(0, audioState.context.currentTime);
  audioState.gainNode.gain.linearRampToValueAtTime(
    0.5,
    audioState.context.currentTime + 1
  );

  // Start playback from specified position
  audioState.musicSource.start(0, resumeFromPosition);
  audioState.startTime = audioState.context.currentTime - resumeFromPosition;
  audioState.playing = true;
}

function pauseBackgroundMusic() {
  if (!audioState.musicSource || !audioState.playing) return;

  // Calculate and store current position
  audioState.pausedAt =
    (audioState.context.currentTime - audioState.startTime) %
    audioState.musicBuffer.duration;

  // Fade out smoothly
  audioState.gainNode.gain.setValueAtTime(
    audioState.gainNode.gain.value,
    audioState.context.currentTime
  );
  audioState.gainNode.gain.linearRampToValueAtTime(
    0,
    audioState.context.currentTime + 0.5
  );

  // Stop after fade completes
  setTimeout(() => {
    if (audioState.musicSource) {
      audioState.musicSource.stop();
      audioState.musicSource.disconnect();
      audioState.musicSource = null;
    }
    audioState.playing = false;
  }, 500);
}

function stopBackgroundMusic() {
  if (!audioState.musicSource || !audioState.playing) return;

  // Fade out smoothly
  audioState.gainNode.gain.setValueAtTime(
    audioState.gainNode.gain.value,
    audioState.context.currentTime
  );
  audioState.gainNode.gain.linearRampToValueAtTime(
    0,
    audioState.context.currentTime + 0.5
  );

  // Stop after fade completes and reset position
  setTimeout(() => {
    if (audioState.musicSource) {
      audioState.musicSource.stop();
      audioState.musicSource.disconnect();
      audioState.musicSource = null;
    }
    audioState.playing = false;
    audioState.pausedAt = 0; // Reset pause position when stopping
  }, 500);
}

export function toggleBackgroundMusic() {
  gameState.audioEnabled = !gameState.audioEnabled;

  // Initialize if needed and enabled
  if (!audioState.initialized && gameState.audioEnabled) {
    initAudioSystem();
    return gameState.audioEnabled;
  }

  // Handle toggle based on new state
  if (gameState.audioEnabled) {
    if (isGameView()) {
      resumeBackgroundMusic();
    }
  } else {
    stopBackgroundMusic();
  }

  // Update UI button state
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

function resumeBackgroundMusic() {
  if (!audioState.initialized || !audioState.context || !audioState.musicBuffer)
    return;

  // Skip if already playing
  if (audioState.playing) return;

  // Set resume position (default to 0 if not paused before)
  const resumePosition = audioState.pausedAt > 0 ? audioState.pausedAt : 0;

  // Resume context first if needed, then play
  if (audioState.context.state === "suspended") {
    audioState.context.resume().then(() => {
      playBackgroundMusic(resumePosition);
    });
  } else {
    playBackgroundMusic(resumePosition);
  }
}

function suspendAudioWhenInactive() {
  // Pause when not in game view but context is running
  if (audioState.context?.state === "running" && !isGameView()) {
    pauseBackgroundMusic();
  }
}

function initIslandBobbing(islands) {
  // Pre-allocate animation data for all islands
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

  // Offload calculations to worker for large island counts
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
    return;
  }

  // Calculate island bobbing in main thread for small island counts
  const smoothingFactor = 0.05 * Math.min(1, deltaTime * 60);

  for (let i = 0; i < islands.length; i++) {
    const island = islands[i];
    const data = islandAnimationData[i];
    if (!data) continue;

    const newY =
      data.initialY +
      Math.sin(gameState.totalTime * data.frequency + data.offset) *
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
    const baseSize = 2 + Math.random() * 0.5;
    const topSize = 2 + Math.random() * 0.5;

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
    const scale = 0.8 + Math.random() * 1.5;

    cloud.position.set(
      Math.random() * -0.5,
      5 + Math.random() * 8,
      (Math.random() * 1000 - 0.5) * 40
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
    updatePlayer(deltaTime);

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

      // Handle audio for game view
      if (!audioState.initialized && gameState.audioEnabled) {
        initAudioSystem();
      } else if (
        audioState.initialized &&
        gameState.audioEnabled &&
        !audioState.playing
      ) {
        if (audioState.context?.state === "suspended") {
          audioState.context.resume();
        }
        resumeBackgroundMusic();
      }

      // Complete transition after animation finishes
      setTimeout(() => {
        gameState.viewMode = newViewMode;
        gameState.isTransitioning = false;
        gameViewContainer.style.transition = "";
        renderFrame();
      }, TRANSITION_DURATION);
    }, 50);
  } else {
    // === SWITCHING TO SCROLL VIEW ===
    gameViewContainer.style.transition = `opacity ${TRANSITION_DURATION}ms ease-out`;
    gameViewContainer.style.opacity = "0";

    // Pause audio when leaving game view
    if (audioState.playing && gameState.audioEnabled) {
      pauseBackgroundMusic();
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

    renderFrame();
  }
}

function createMusicToggleButton(controlsBox) {
  if (!controlsBox) return;

  // Create container
  const musicToggleContainer = document.createElement("div");
  musicToggleContainer.className = "control-group";

  // Create label
  const musicToggleLabel = document.createElement("span");
  musicToggleLabel.textContent = "Music:";
  musicToggleLabel.className = "control-label";

  // Create button
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

  // Assemble components
  musicToggleContainer.appendChild(musicToggleLabel);
  musicToggleContainer.appendChild(musicToggleBtn);

  // Add to controls box after the close button
  const closeBtn = controlsBox.querySelector(".close-btn");
  if (closeBtn?.parentNode) {
    closeBtn.parentNode.insertBefore(
      musicToggleContainer,
      closeBtn.nextSibling
    );
  } else {
    controlsBox.appendChild(musicToggleContainer);
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

    createMusicToggleButton(controlsBox);

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

export function disposeAudio() {
  // Stop and disconnect audio source
  if (audioState.musicSource) {
    if (audioState.playing) audioState.musicSource.stop();
    audioState.musicSource.disconnect();
    audioState.musicSource = null;
  }

  // Disconnect and close audio nodes
  if (audioState.gainNode) audioState.gainNode.disconnect();
  if (audioState.context) audioState.context.close();

  // Reset audio state
  audioState.playing = false;
  audioState.initialized = false;
  audioState.pausedAt = 0;
}

// Page visibility handling for audio optimization
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (audioState.context?.state === "running") {
      if (audioState.playing) {
        // Save position when tab becomes hidden
        audioState.pausedAt =
          (audioState.context.currentTime - audioState.startTime) %
          audioState.musicBuffer.duration;
      }
      audioState.context.suspend();
    }
  } else if (document.visibilityState === "visible") {
    if (
      audioState.context?.state === "suspended" &&
      isGameView() &&
      gameState.audioEnabled
    ) {
      audioState.context.resume();
      if (!audioState.playing) resumeBackgroundMusic();
    }
  }
});

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

  // Add CSS for transitions - do once
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
        // Reposition UI elements on resize
        if (
          document.getElementById("altitude-meter") &&
          document.getElementById("compass-rose")
        ) {
          const { altitudeCanvas, compassCanvas } = getUI();
          positionUIElements();
        }
      }
    }, 200)
  );

  // Clean up resources on page unload
  window.addEventListener("beforeunload", disposeAudio);

  gameState.isInitialized = true;
}

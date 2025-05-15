import { getCurrentHeight, getHeightLimits, getDirection } from "./player.js";
import { debounce } from "../utils/helper.js";
import { audioController, toggleBackgroundMusic } from "./audio-controller.js";

const ALTITUDE_WIDTH = 40;
const ALTITUDE_HEIGHT = 200;
const COMPASS_SIZE = 100;
const UI_PADDING = 20;
const UI_BG_ALPHA = 0.7;
const UI_FG_ALPHA = 0.9;

// Cached UI elements and states for performance
let altitudeCanvas, altitudeCtx;
let compassCanvas, compassCtx;
let volumeSlider, speakerButton;
let gameContainer;
let heightLimits = { min: -50, max: 50 };

// Pre-calculated values
const COMPASS_CENTER = COMPASS_SIZE / 2;
const COMPASS_RADIUS = COMPASS_CENTER - 10;
const COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_ANGLES = COMPASS_DIRECTIONS.map((_, i) => (i * Math.PI) / 4);

// Reusable objects for animations and rendering
const altitudeFillGradients = {
  normal: null,
  max: null,
  min: null,
};

// State tracking to prevent unnecessary redraws
let lastAltitude = null;
let lastDirection = null;
let lastRotation = null;
let isStylesAdded = false;
let resizeTimeout = null;
let uiInitialized = false;

export function getUI() {
  // Get height limits once upfront
  try {
    heightLimits = getHeightLimits();
  } catch {}

  // Create altitude meter (only if not already created)
  if (!altitudeCanvas) {
    altitudeCanvas = document.createElement("canvas");
    altitudeCanvas.width = ALTITUDE_WIDTH;
    altitudeCanvas.height = ALTITUDE_HEIGHT;
    altitudeCanvas.id = "altitude-meter";
    altitudeCanvas.classList.add("game-ui-element");
    altitudeCtx = altitudeCanvas.getContext("2d"); // Use default context with alpha
  }

  // Create compass (only if not already created)
  if (!compassCanvas) {
    compassCanvas = document.createElement("canvas");
    compassCanvas.width = compassCanvas.height = COMPASS_SIZE;
    compassCanvas.id = "compass-rose";
    compassCanvas.classList.add("game-ui-element");
    compassCtx = compassCanvas.getContext("2d"); // Use default context with alpha
  }

  // Create volume control elements
  const volumeControlContainer = createVolumeControl();

  return {
    altitudeCanvas,
    compassCanvas,
    volumeControlContainer,
  };
}

// Avoid recreating DOM elements on every call
function createVolumeControl() {
  // Reuse existing container if available
  let volumeControlContainer = document.getElementById(
    "volume-control-container"
  );

  // Only create elements if they don't exist
  if (!volumeControlContainer) {
    volumeControlContainer = document.createElement("div");
    volumeControlContainer.id = "volume-control-container";
    volumeControlContainer.classList.add("game-ui-element");

    // Create speaker button
    speakerButton = document.createElement("button");
    speakerButton.id = "speaker-button";
    speakerButton.innerHTML = audioController.audioEnabled ? "🔊" : "🔇";
    speakerButton.classList.add("volume-control-btn");
    speakerButton.title = "Mute/Unmute";

    // Use event delegation to reduce listeners
    speakerButton.addEventListener(
      "click",
      () => {
        const isEnabled = toggleBackgroundMusic(true);
        if (speakerButton) speakerButton.innerHTML = isEnabled ? "🔊" : "🔇";
      },
      { passive: true }
    ); // Mark as passive for better performance

    // Create volume slider
    volumeSlider = document.createElement("input");
    volumeSlider.type = "range";
    volumeSlider.min = "0";
    volumeSlider.max = "1";
    volumeSlider.step = "0.1";
    volumeSlider.value = audioController.getVolume
      ? audioController.getVolume().toString()
      : "0.5";
    volumeSlider.id = "volume-slider";
    volumeSlider.classList.add("volume-control-slider");

    // Use throttled input handler
    volumeSlider.addEventListener(
      "input",
      debounce((e) => {
        audioController.setVolume(parseFloat(e.target.value));
      }, 50),
      { passive: true }
    ); // Mark as passive for better performance

    // Assemble volume control
    volumeControlContainer.appendChild(speakerButton);
    volumeControlContainer.appendChild(volumeSlider);
  }

  return volumeControlContainer;
}

export function initGameUI(elements) {
  if (!elements?.gameViewContainer) {
    console.error("Game UI init failed: no container");
    return;
  }

  // Prevent duplicate initialization
  if (uiInitialized) return;
  uiInitialized = true;

  gameContainer = elements.gameViewContainer;

  // Get UI elements - only create them once
  const {
    altitudeCanvas: altitude,
    compassCanvas: compass,
    volumeControlContainer,
  } = getUI();

  // References to canvas elements
  altitudeCanvas = altitude;
  compassCanvas = compass;

  // Use fragment for better performance when adding multiple elements
  const fragment = document.createDocumentFragment();
  fragment.appendChild(altitudeCanvas);
  fragment.appendChild(compassCanvas);
  if (volumeControlContainer) {
    fragment.appendChild(volumeControlContainer);
  }
  gameContainer.appendChild(fragment);

  // Position elements once
  positionUIElements();

  // Add styles only once
  if (!isStylesAdded) {
    addGameUIStyles();
    isStylesAdded = true;
  }

  // Use passive event listener with debounce for resize
  window.addEventListener(
    "resize",
    () => {
      if (resizeTimeout) return; // Skip if already waiting
      resizeTimeout = setTimeout(() => {
        positionUIElements();
        resizeTimeout = null;
      }, 200);
    },
    { passive: true }
  );

  // Set up reusable gradients for altitude meter
  initializeGradients();

  // Initial UI sync
  syncVolumeUI();
}

// Pre-create gradients to avoid recreating them on every frame
function initializeGradients() {
  if (!altitudeCtx) return;

  // Maximum height gradient
  altitudeFillGradients.max = altitudeCtx.createLinearGradient(
    0,
    0,
    0,
    ALTITUDE_HEIGHT
  );
  altitudeFillGradients.max.addColorStop(0, "#ff9966");
  altitudeFillGradients.max.addColorStop(1, "#ff5500");

  // Minimum height gradient
  altitudeFillGradients.min = altitudeCtx.createLinearGradient(
    0,
    0,
    0,
    ALTITUDE_HEIGHT
  );
  altitudeFillGradients.min.addColorStop(0, "#ffcc66");
  altitudeFillGradients.min.addColorStop(1, "#cc9933");

  // Normal gradient - will be adjusted during render
  altitudeFillGradients.normal = altitudeCtx.createLinearGradient(
    0,
    0,
    0,
    ALTITUDE_HEIGHT
  );
  altitudeFillGradients.normal.addColorStop(0, "#66ccff");
  altitudeFillGradients.normal.addColorStop(1, "#3366cc");
}

function positionUIElements() {
  if (!gameContainer || !altitudeCanvas || !compassCanvas) return;

  const containerRect = gameContainer.getBoundingClientRect();

  // Revert to using top/right/left for positioning to maintain correct overlay
  Object.assign(altitudeCanvas.style, {
    position: "absolute",
    top: `${(containerRect.height - ALTITUDE_HEIGHT) / 2}px`,
    right: `${UI_PADDING}px`,
    width: `${ALTITUDE_WIDTH}px`,
    height: `${ALTITUDE_HEIGHT}px`,
    zIndex: "4",
    willChange: "transform", // Still add performance hint
  });

  Object.assign(compassCanvas.style, {
    position: "absolute",
    top: `${(containerRect.height - COMPASS_SIZE) / 2}px`,
    left: `${UI_PADDING}px`,
    width: `${COMPASS_SIZE}px`,
    height: `${COMPASS_SIZE}px`,
    zIndex: "4",
    willChange: "transform", // Still add performance hint
  });

  // Position volume control
  const volumeContainer = document.getElementById("volume-control-container");
  if (volumeContainer) {
    Object.assign(volumeContainer.style, {
      position: "absolute",
      top: `${UI_PADDING}px`,
      left: `${UI_PADDING}px`,
      zIndex: "10",
      display: "flex",
      alignItems: "center",
      backgroundColor: `rgba(0, 0, 0, ${UI_BG_ALPHA})`,
      padding: "10px",
      borderRadius: "5px",
      willChange: "transform",
    });
  }
}

function addGameUIStyles() {
  if (document.getElementById("game-ui-styles")) return;

  const style = document.createElement("style");
  style.id = "game-ui-styles";
  style.textContent = `
    .game-ui-element {
      pointer-events: none;
      border-radius: 5px;
      will-change: transform; /* Hint for browser optimization */
    }
    #altitude-meter {
      transition: box-shadow 0.2s ease;
    }
    #altitude-meter.at-limit {
      box-shadow: 0 0 10px rgba(255, 100, 100, 0.5);
    }
    #volume-control-container {
      pointer-events: auto;
    }
    .volume-control-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      margin-right: 10px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    .volume-control-btn:hover {
      opacity: 1;
    }
    .volume-control-slider {
      width: 100px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

export function updateAltitudeMeter(altitude) {
  if (!altitudeCtx) return;

  // Skip update if value hasn't changed significantly
  if (lastAltitude !== null && Math.abs(altitude - lastAltitude) < 0.5) return;
  lastAltitude = altitude;

  const ctx = altitudeCtx;
  const width = ALTITUDE_WIDTH;
  const height = ALTITUDE_HEIGHT;
  const { min, max } = heightLimits;

  // Use clearRect to maintain transparency
  ctx.clearRect(0, 0, width, height);

  // Draw semi-transparent background
  ctx.fillStyle = `rgba(0, 0, 0, ${UI_BG_ALPHA})`;
  ctx.fillRect(0, 0, width, height);

  const normalizedAltitude = (altitude - min) / (max - min);
  const fillHeight = normalizedAltitude * (height - 10);
  const fillY = height - 5 - fillHeight;

  const atMaxHeight = Math.abs(altitude - max) < 0.1;
  const atMinHeight = Math.abs(altitude - min) < 0.1;

  // Update gradient start point - don't recreate the gradient
  if (atMaxHeight) {
    ctx.fillStyle = altitudeFillGradients.max;
  } else if (atMinHeight) {
    ctx.fillStyle = altitudeFillGradients.min;
  } else {
    // Update normal gradient positions
    const normalGradient = ctx.createLinearGradient(0, fillY, 0, height - 5);
    normalGradient.addColorStop(0, "#66ccff");
    normalGradient.addColorStop(1, "#3366cc");
    ctx.fillStyle = normalGradient;
  }

  // Add/remove class for limit indication
  if (altitudeCanvas) {
    const hasClass = altitudeCanvas.classList.contains("at-limit");
    if ((atMaxHeight || atMinHeight) && !hasClass) {
      altitudeCanvas.classList.add("at-limit");
    } else if (!(atMaxHeight || atMinHeight) && hasClass) {
      altitudeCanvas.classList.remove("at-limit");
    }
  }

  // Draw altitude bar
  ctx.fillRect(5, fillY, width - 10, fillHeight);

  // Draw border
  ctx.strokeStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, width - 10, height - 10);

  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.textAlign = "right";
  ctx.font = "10px Arial";

  // Draw tick marks and labels (reusing calculated positions)
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const y = height - 5 - (i / tickCount) * (height - 10);
    const altValue = min + (i / tickCount) * (max - min);
    ctx.fillRect(5, y, 8, 1);
    ctx.fillText(Math.round(altValue), width - 8, y + 3);
  }

  // Draw current altitude value
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(altitude)}m`, width / 2, 20);
}

export function updateCompass(rotation) {
  if (!compassCtx) return;

  // For compass, we need smooth updates regardless of small changes
  lastRotation = rotation;
  const direction = getDirection(rotation);
  lastDirection = direction;

  const ctx = compassCtx;
  const size = COMPASS_SIZE;

  // Use clearRect for transparency
  ctx.clearRect(0, 0, size, size);

  // Draw semi-transparent compass background
  ctx.fillStyle = `rgba(0, 0, 0, ${UI_BG_ALPHA})`;
  ctx.beginPath();
  ctx.arc(COMPASS_CENTER, COMPASS_CENTER, COMPASS_RADIUS + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(COMPASS_CENTER, COMPASS_CENTER);
  ctx.rotate(-rotation);

  // Draw compass outline
  ctx.strokeStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, COMPASS_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw direction labels (using pre-calculated values)
  for (let i = 0; i < COMPASS_DIRECTIONS.length; i++) {
    const dir = COMPASS_DIRECTIONS[i];
    const angle = COMPASS_ANGLES[i];
    const x = Math.sin(angle) * (COMPASS_RADIUS - 15);
    const y = -Math.cos(angle) * (COMPASS_RADIUS - 15);

    ctx.fillStyle =
      dir === direction ? "#66ccff" : `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
    ctx.fillText(dir, x, y);

    // Draw tick mark
    const innerX = Math.sin(angle) * (COMPASS_RADIUS - 8);
    const innerY = -Math.cos(angle) * (COMPASS_RADIUS - 8);
    const outerX = Math.sin(angle) * COMPASS_RADIUS;
    const outerY = -Math.cos(angle) * COMPASS_RADIUS;

    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
  }

  // Draw pointer
  ctx.fillStyle = "#f44336";
  ctx.beginPath();
  ctx.moveTo(0, -COMPASS_RADIUS + 25);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Draw direction text
  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(direction, COMPASS_CENTER, size - 15);
}

let animFrameId = null;
let pendingPlayerState = null;

export function updateGameUI(playerState) {
  if (!playerState) return;

  // Store the latest state and schedule an update if not already pending
  pendingPlayerState = playerState;

  if (!animFrameId) {
    animFrameId = requestAnimationFrame(processGameUIUpdate);
  }
}

function processGameUIUpdate() {
  animFrameId = null;

  if (!pendingPlayerState) return;

  let altitude;
  try {
    altitude = getCurrentHeight();
  } catch {
    altitude = pendingPlayerState.position?.y || heightLimits.min;
  }

  let rotation;
  if (pendingPlayerState.model?.quaternion) {
    const { w, y } = pendingPlayerState.model.quaternion;
    rotation = 2 * Math.atan2(y, w);
  } else {
    rotation = 0;
  }

  updateAltitudeMeter(altitude);
  updateCompass(rotation);

  pendingPlayerState = null;
}

// Function to synchronize volume UI with AudioController state
export function syncVolumeUI() {
  if (!audioController.initialized) return;

  // Update volume slider value
  if (volumeSlider && audioController.getVolume) {
    const currentVol = audioController.getVolume().toString();
    if (volumeSlider.value !== currentVol) {
      volumeSlider.value = currentVol;
    }
  } else if (volumeSlider && audioController.gainNode) {
    const currentVol = audioController.gainNode.gain.value.toString();
    if (volumeSlider.value !== currentVol) {
      volumeSlider.value = currentVol;
    }
  }

  // Update speaker button icon
  if (speakerButton) {
    const buttonText = audioController.audioEnabled ? "🔊" : "🔇";
    if (speakerButton.innerHTML !== buttonText) {
      speakerButton.innerHTML = buttonText;
    }
  }
}

export function disposeGameUI() {
  // Cancel any pending animations
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // Clear any pending timeouts
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }

  // Remove DOM elements
  if (altitudeCanvas?.parentNode) {
    altitudeCanvas.parentNode.removeChild(altitudeCanvas);
  }

  if (compassCanvas?.parentNode) {
    compassCanvas.parentNode.removeChild(compassCanvas);
  }

  // Remove volume control
  const volumeContainer = document.getElementById("volume-control-container");
  if (volumeContainer?.parentNode) {
    volumeContainer.parentNode.removeChild(volumeContainer);
  }

  // Remove event listeners
  window.removeEventListener("resize", positionUIElements);

  // Reset all state
  altitudeCanvas = compassCanvas = volumeSlider = speakerButton = null;
  altitudeCtx = compassCtx = gameContainer = null;
  lastAltitude = lastDirection = lastRotation = null;
  pendingPlayerState = null;
  uiInitialized = false;
}

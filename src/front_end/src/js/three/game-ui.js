import { getCurrentHeight, getHeightLimits, getDirection } from "./player.js";
import { debounce } from "../utils/helper.js";
import { audioController, toggleBackgroundMusic } from "./audio-controller.js";

const ALTITUDE_WIDTH = 35;
const ALTITUDE_HEIGHT = 180;
const COMPASS_SIZE = 100;
const UI_PADDING = 20;
const UI_BG_ALPHA = 0.65;
const UI_FG_ALPHA = 0.95;

// Cached UI elements and states for performance
let altitudeCanvas, altitudeCtx;
let compassCanvas, compassCtx;
let volumeSlider, speakerButton;
let gameContainer;
let heightLimits = { min: -50, max: 50 };

// Pre-calculated values
const COMPASS_CENTER = COMPASS_SIZE / 2;
const COMPASS_RADIUS = COMPASS_CENTER - 10;

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

// UI theme colors in Skies of Arcadia style
const UI_THEME = {
  compass: {
    bg: "rgba(34, 51, 68, 0.75)",
    border: "rgba(155, 179, 205, 0.9)",
    accent: "#c5a45c",
    northPointer: "#e5b668",
    text: "rgba(225, 235, 245, 0.95)",
  },
  altitude: {
    bg: "rgba(34, 51, 68, 0.75)",
    border: "rgba(155, 179, 205, 0.9)",
    fill: {
      start: "#5b98bd",
      end: "#2c5a8c",
    },
    fillHigh: {
      start: "#e5b668",
      end: "#c5853c",
    },
    fillLow: {
      start: "#8cadca",
      end: "#496d8c",
    },
    text: "rgba(225, 235, 245, 0.95)",
    tickMark: "rgba(155, 179, 205, 0.8)",
  },
  controls: {
    bg: "rgba(34, 51, 68, 0.75)",
    text: "rgba(225, 235, 245, 0.95)",
    accent: "#c5a45c",
  },
};

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

  // Maximum height gradient (high altitude)
  altitudeFillGradients.max = altitudeCtx.createLinearGradient(
    0,
    0,
    0,
    ALTITUDE_HEIGHT
  );
  altitudeFillGradients.max.addColorStop(0, UI_THEME.altitude.fillHigh.start);
  altitudeFillGradients.max.addColorStop(1, UI_THEME.altitude.fillHigh.end);

  // Minimum height gradient (low altitude)
  altitudeFillGradients.min = altitudeCtx.createLinearGradient(
    0,
    0,
    0,
    ALTITUDE_HEIGHT
  );
  altitudeFillGradients.min.addColorStop(0, UI_THEME.altitude.fillLow.start);
  altitudeFillGradients.min.addColorStop(1, UI_THEME.altitude.fillLow.end);

  // Normal gradient - will be adjusted during render
  altitudeFillGradients.normal = altitudeCtx.createLinearGradient(
    0,
    0,
    0,
    ALTITUDE_HEIGHT
  );
  altitudeFillGradients.normal.addColorStop(0, UI_THEME.altitude.fill.start);
  altitudeFillGradients.normal.addColorStop(1, UI_THEME.altitude.fill.end);
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
      backgroundColor: UI_THEME.controls.bg,
      padding: "8px",
      borderRadius: "5px",
      border: `1px solid ${UI_THEME.controls.accent}`,
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
      border: 1px solid ${UI_THEME.altitude.border};
    }
    #altitude-meter.at-limit {
      box-shadow: 0 0 10px rgba(255, 180, 40, 0.6);
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
      opacity: 0.9;
      color: ${UI_THEME.controls.text};
      transition: opacity 0.2s;
    }
    .volume-control-btn:hover {
      opacity: 1;
      color: ${UI_THEME.controls.accent};
    }
    .volume-control-slider {
      width: 80px;
      cursor: pointer;
      accent-color: ${UI_THEME.controls.accent};
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

  // Draw background with rounded corners
  ctx.fillStyle = UI_THEME.altitude.bg;
  roundedRect(ctx, 0, 0, width, height, 5);
  ctx.fill();

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
    normalGradient.addColorStop(0, UI_THEME.altitude.fill.start);
    normalGradient.addColorStop(1, UI_THEME.altitude.fill.end);
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

  // Draw altitude bar with rounded corners
  roundedRect(ctx, 5, fillY, width - 10, fillHeight, 3);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = UI_THEME.altitude.border;
  ctx.lineWidth = 2;
  roundedRect(ctx, 5, 5, width - 10, height - 10, 3);
  ctx.stroke();

  // Draw current altitude indicator
  ctx.fillStyle = UI_THEME.altitude.text;
  ctx.font = "bold 12px 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(altitude)}`, width / 2, 20);

  // Draw minimal altitude tick marks
  ctx.strokeStyle = UI_THEME.altitude.tickMark;
  ctx.lineWidth = 1;

  // Only draw 3 tick marks for a cleaner look
  const tickPositions = [0.1, 0.5, 0.9]; // Bottom, middle, top

  for (const pos of tickPositions) {
    const y = height - 5 - pos * (height - 10);
    // Draw tick on left side
    ctx.beginPath();
    ctx.moveTo(5, y);
    ctx.lineTo(10, y);
    ctx.stroke();

    // Draw tick on right side
    ctx.beginPath();
    ctx.moveTo(width - 5, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();
  }
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

  // Draw semi-transparent compass background with rounded corners
  ctx.fillStyle = UI_THEME.compass.bg;
  ctx.beginPath();
  ctx.arc(COMPASS_CENTER, COMPASS_CENTER, COMPASS_RADIUS + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(COMPASS_CENTER, COMPASS_CENTER);
  ctx.rotate(-rotation);

  // Draw compass outline
  ctx.strokeStyle = UI_THEME.compass.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, COMPASS_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Draw North marker only for a cleaner look
  const northAngle = 0; // North is at 0 radians
  const northX = Math.sin(northAngle) * (COMPASS_RADIUS - 15);
  const northY = -Math.cos(northAngle) * (COMPASS_RADIUS - 15);

  ctx.font = "bold 16px 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = UI_THEME.compass.northPointer;
  ctx.fillText("N", northX, northY);

  // Draw tick marks only
  const cardinalPoints = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]; // N, E, S, W

  for (const angle of cardinalPoints) {
    const innerRadius = COMPASS_RADIUS - 10;
    const outerRadius = COMPASS_RADIUS;

    const innerX = Math.sin(angle) * innerRadius;
    const innerY = -Math.cos(angle) * innerRadius;
    const outerX = Math.sin(angle) * outerRadius;
    const outerY = -Math.cos(angle) * outerRadius;

    ctx.strokeStyle =
      angle === 0 ? UI_THEME.compass.northPointer : UI_THEME.compass.border;
    ctx.lineWidth = angle === 0 ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
  }

  // Draw intermediate tick marks (NE, SE, SW, NW)
  const intermediateAngles = [
    Math.PI / 4,
    (Math.PI * 3) / 4,
    (Math.PI * 5) / 4,
    (Math.PI * 7) / 4,
  ];

  for (const angle of intermediateAngles) {
    const innerRadius = COMPASS_RADIUS - 5;
    const outerRadius = COMPASS_RADIUS;

    const innerX = Math.sin(angle) * innerRadius;
    const innerY = -Math.cos(angle) * innerRadius;
    const outerX = Math.sin(angle) * outerRadius;
    const outerY = -Math.cos(angle) * outerRadius;

    ctx.strokeStyle = UI_THEME.compass.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
  }

  // Draw compass pointer
  ctx.fillStyle = UI_THEME.compass.accent;
  ctx.beginPath();
  ctx.moveTo(0, -COMPASS_RADIUS + 20);
  ctx.lineTo(6, -5);
  ctx.lineTo(0, 5);
  ctx.lineTo(-6, -5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = UI_THEME.compass.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // Draw current direction in center
  ctx.fillStyle = UI_THEME.compass.text;
  ctx.font = "bold 14px 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(direction, COMPASS_CENTER, COMPASS_CENTER);
}

// Helper function to draw rounded rectangles
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
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

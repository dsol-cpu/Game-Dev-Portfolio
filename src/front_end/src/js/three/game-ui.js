/**
 * @fileoverview UI Components for Game - Altitude Meter and Compass Rose
 * Adds visual indicators for player altitude and direction
 * Integrated with player controller height limits
 */

import { getCurrentHeight, getHeightLimits, getDirection } from "./player.js";
import { debounce } from "../utils/helper.js";

// Constants for UI
const ALTITUDE_WIDTH = 40;
const ALTITUDE_HEIGHT = 200;
const COMPASS_SIZE = 100;
const UI_PADDING = 20;
const UI_BACKGROUND_ALPHA = 0.7;
const UI_FOREGROUND_ALPHA = 0.9;

// UI elements
let altitudeCanvas, altitudeCtx;
let compassCanvas, compassCtx;
let gameContainer;

// Cache for height limits
let heightLimits = { min: 1, max: 50 }; // Default values before initialization

/**
 * Initialize UI components for game
 * @param {Object} elements - DOM elements
 */
export function initGameUI(elements) {
  if (!elements?.gameViewContainer) {
    console.error("Game UI initialization failed: gameViewContainer not found");
    return;
  }

  // Get height limits from player configuration
  try {
    heightLimits = getHeightLimits();
  } catch {
    console.warn("Could not get height limits from player.js, using defaults");
  }

  gameContainer = elements.gameViewContainer;

  // Create altitude meter canvas
  altitudeCanvas = document.createElement("canvas");
  altitudeCanvas.width = ALTITUDE_WIDTH;
  altitudeCanvas.height = ALTITUDE_HEIGHT;
  altitudeCanvas.id = "altitude-meter";
  altitudeCanvas.classList.add("game-ui-element");

  // Create compass rose canvas
  compassCanvas = document.createElement("canvas");
  compassCanvas.width = COMPASS_SIZE;
  compassCanvas.height = COMPASS_SIZE;
  compassCanvas.id = "compass-rose";
  compassCanvas.classList.add("game-ui-element");

  // Get contexts
  altitudeCtx = altitudeCanvas.getContext("2d");
  compassCtx = compassCanvas.getContext("2d");

  // Add canvases to container
  gameContainer.appendChild(altitudeCanvas);
  gameContainer.appendChild(compassCanvas);

  // Position UI elements
  positionUIElements();

  // Add styling
  addGameUIStyles();

  // Handle window resize
  window.addEventListener("resize", debounce(positionUIElements, 200));
}

/**
 * Position UI elements on the screen
 */
function positionUIElements() {
  if (!gameContainer || !altitudeCanvas || !compassCanvas) return;

  const containerRect = gameContainer.getBoundingClientRect();

  // Position altitude meter on right center
  Object.assign(altitudeCanvas.style, {
    position: "absolute",
    top: `${(containerRect.height - ALTITUDE_HEIGHT) / 2}px`,
    right: `${UI_PADDING}px`,
    width: `${ALTITUDE_WIDTH}px`,
    height: `${ALTITUDE_HEIGHT}px`,
    zIndex: "101",
  });

  // Position compass on left center
  Object.assign(compassCanvas.style, {
    position: "absolute",
    top: `${(containerRect.height - COMPASS_SIZE) / 2}px`,
    left: `${UI_PADDING}px`,
    width: `${COMPASS_SIZE}px`,
    height: `${COMPASS_SIZE}px`,
    zIndex: "101",
  });
}

/**
 * Add CSS styles for UI elements
 */
function addGameUIStyles() {
  // Add styles if they don't exist
  if (!document.getElementById("game-ui-styles")) {
    const styleEl = document.createElement("style");
    styleEl.id = "game-ui-styles";
    styleEl.textContent = `
      .game-ui-element {
        pointer-events: none;
        border-radius: 5px;
      }

      #altitude-meter {
        transition: background-color 0.2s ease;
      }

      #altitude-meter.at-limit {
        box-shadow: 0 0 10px rgba(255, 100, 100, 0.5);
      }
    `;
    document.head.appendChild(styleEl);
  }
}

/**
 * Update altitude meter display
 * @param {number} altitude - Current player altitude
 */
export function updateAltitudeMeter(altitude) {
  if (!altitudeCtx) return;

  const ctx = altitudeCtx;
  const width = ALTITUDE_WIDTH;
  const height = ALTITUDE_HEIGHT;
  const { min, max } = heightLimits;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw background
  ctx.fillStyle = `rgba(0, 0, 0, ${UI_BACKGROUND_ALPHA})`;
  ctx.fillRect(0, 0, width, height);

  // Calculate fill height based on altitude
  const normalizedAltitude = (altitude - min) / (max - min);
  const fillHeight = normalizedAltitude * (height - 10);
  const fillY = height - 5 - fillHeight;

  // Check if at altitude limits
  const atMaxHeight = Math.abs(altitude - max) < 0.1;
  const atMinHeight = Math.abs(altitude - min) < 0.1;

  // Visual feedback for limits
  if (altitudeCanvas) {
    if (atMaxHeight || atMinHeight) {
      altitudeCanvas.classList.add("at-limit");
    } else {
      altitudeCanvas.classList.remove("at-limit");
    }
  }

  // Draw fill gradient with appropriate colors
  let gradient;
  if (atMaxHeight) {
    gradient = ctx.createLinearGradient(0, fillY, 0, height - 5);
    gradient.addColorStop(0, "#ff9966"); // Orange-red for max height
    gradient.addColorStop(1, "#ff5500");
  } else if (atMinHeight) {
    gradient = ctx.createLinearGradient(0, fillY, 0, height - 5);
    gradient.addColorStop(0, "#ffcc66"); // Yellow-orange for min height
    gradient.addColorStop(1, "#cc9933");
  } else {
    gradient = ctx.createLinearGradient(0, fillY, 0, height - 5);
    gradient.addColorStop(0, "#66ccff"); // Standard blue gradient
    gradient.addColorStop(1, "#3366cc");
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(5, fillY, width - 10, fillHeight);

  // Draw border
  ctx.strokeStyle = `rgba(255, 255, 255, ${UI_FOREGROUND_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, width - 10, height - 10);

  // Draw ticks and labels
  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FOREGROUND_ALPHA})`;
  ctx.textAlign = "right";
  ctx.font = "10px Arial";

  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const y = height - 5 - (i / tickCount) * (height - 10);
    const altValue = min + (i / tickCount) * (max - min);

    // Draw tick
    ctx.fillRect(5, y, 8, 1);

    // Draw label
    ctx.fillText(Math.round(altValue), width - 8, y + 3);
  }

  // Draw altitude value
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(altitude)}m`, width / 2, 20);
}

/**
 * Update compass rose display
 * @param {number} rotation - Player rotation in radians
 */
export function updateCompass(rotation) {
  if (!compassCtx) return;

  // Use player's getDirection function to get current cardinal direction
  const direction = getDirection(rotation);

  const ctx = compassCtx;
  const size = COMPASS_SIZE;
  const center = size / 2;
  const radius = size / 2 - 10;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Draw background
  ctx.fillStyle = `rgba(0, 0, 0, ${UI_BACKGROUND_ALPHA})`;
  ctx.beginPath();
  ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
  ctx.fill();

  // Save context for rotation
  ctx.save();
  ctx.translate(center, center);

  // Rotate opposite to player rotation so north stays at top
  ctx.rotate(-rotation);

  // Draw compass circle
  ctx.strokeStyle = `rgba(255, 255, 255, ${UI_FOREGROUND_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw cardinal directions
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FOREGROUND_ALPHA})`;

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  directions.forEach((dir, i) => {
    const angle = (i * Math.PI) / 4;
    const x = Math.sin(angle) * (radius - 15);
    const y = -Math.cos(angle) * (radius - 15);

    // Highlight current direction
    if (dir === direction) {
      ctx.fillStyle = "#66ccff";
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${UI_FOREGROUND_ALPHA})`;
    }

    ctx.fillText(dir, x, y);

    // Draw tick marks
    ctx.beginPath();
    const tickStart = radius - 8;
    const tickEnd = radius;
    ctx.moveTo(Math.sin(angle) * tickStart, -Math.cos(angle) * tickStart);
    ctx.lineTo(Math.sin(angle) * tickEnd, -Math.cos(angle) * tickEnd);
    ctx.stroke();
  });

  // Draw compass arrow
  ctx.fillStyle = "#f44336";
  ctx.beginPath();
  ctx.moveTo(0, -radius + 25);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  // Restore context
  ctx.restore();

  // Draw current direction text
  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FOREGROUND_ALPHA})`;
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(direction, center, size - 15);
}

/**
 * Update all UI elements using the player state and functions
 */
export function updateGameUI(playerState) {
  if (!playerState) return;

  // Get current altitude using the exported function
  let altitude;
  try {
    altitude = getCurrentHeight();
  } catch {
    // Fallback to position if function not available
    altitude = playerState.position?.y || heightLimits.min;
  }

  // Get rotation from player model quaternion or use player's orientation
  let rotation;
  if (playerState.model?.quaternion) {
    // Extract rotation around Y-axis from quaternion
    const w = playerState.model.quaternion.w;
    const y = playerState.model.quaternion.y;
    rotation = 2 * Math.atan2(y, w);
  } else {
    // Fallback to player's orientation if available
    rotation = 0;
  }

  // Update UI elements
  updateAltitudeMeter(altitude);
  updateCompass(rotation);
}

/**
 * Clean up UI resources
 */
export function disposeGameUI() {
  if (altitudeCanvas?.parentNode) {
    altitudeCanvas.parentNode.removeChild(altitudeCanvas);
  }

  if (compassCanvas?.parentNode) {
    compassCanvas.parentNode.removeChild(compassCanvas);
  }

  window.removeEventListener("resize", positionUIElements);

  altitudeCanvas = null;
  compassCanvas = null;
  altitudeCtx = null;
  compassCtx = null;
  gameContainer = null;
}

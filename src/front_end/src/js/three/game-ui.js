import { getCurrentHeight, getHeightLimits, getDirection } from "./player.js";
import { debounce } from "../utils/helper.js";

import { audioController, toggleBackgroundMusic } from "./audio-controller.js";

const ALTITUDE_WIDTH = 40;
const ALTITUDE_HEIGHT = 200;
const COMPASS_SIZE = 100;
const UI_PADDING = 20;
const UI_BG_ALPHA = 0.7;
const UI_FG_ALPHA = 0.9;

let altitudeCanvas, altitudeCtx;
let compassCanvas, compassCtx;
let volumeSlider, speakerButton;
let gameContainer;
let heightLimits = { min: -50, max: 50 };

export function getUI() {
  try {
    heightLimits = getHeightLimits();
  } catch {}

  // Create altitude meter
  altitudeCanvas = document.createElement("canvas");
  altitudeCanvas.width = ALTITUDE_WIDTH;
  altitudeCanvas.height = ALTITUDE_HEIGHT;
  altitudeCanvas.id = "altitude-meter";
  altitudeCanvas.classList.add("game-ui-element");
  altitudeCtx = altitudeCanvas.getContext("2d");

  // Create compass
  compassCanvas = document.createElement("canvas");
  compassCanvas.width = compassCanvas.height = COMPASS_SIZE;
  compassCanvas.id = "compass-rose";
  compassCanvas.classList.add("game-ui-element");
  compassCtx = compassCanvas.getContext("2d");

  const volumeControlContainer = createVolumeControl();

  return {
    altitudeCanvas,
    compassCanvas,
    volumeControlContainer,
  };
}

function createVolumeControl() {
  // Create volume control container
  const volumeControlContainer = document.createElement("div");
  volumeControlContainer.id = "volume-control-container";
  volumeControlContainer.classList.add("game-ui-element");

  // Create speaker button
  speakerButton = document.createElement("button");
  speakerButton.id = "speaker-button";
  speakerButton.innerHTML = audioController.audioEnabled ? "🔊" : "🔇"; // Set initial state based on AudioController
  speakerButton.classList.add("volume-control-btn");
  speakerButton.title = "Mute/Unmute";
  speakerButton.addEventListener("click", () => {
    const isEnabled = toggleBackgroundMusic();
    updateSpeakerIcon(isEnabled);
  });

  // Create volume slider
  volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "1";
  volumeSlider.step = "0.1";
  // Use the stored volume value instead of directly accessing gainNode
  volumeSlider.value = audioController.getVolume
    ? audioController.getVolume().toString()
    : "0.5";
  volumeSlider.id = "volume-slider";
  volumeSlider.classList.add("volume-control-slider");
  volumeSlider.addEventListener("input", (e) => {
    const volume = parseFloat(e.target.value);
    audioController.setVolume(volume);
  });

  // Assemble volume control
  volumeControlContainer.appendChild(speakerButton);
  volumeControlContainer.appendChild(volumeSlider);

  return volumeControlContainer;
}

function updateSpeakerIcon(isEnabled) {
  if (!speakerButton) return;
  speakerButton.innerHTML = isEnabled ? "🔊" : "🔇";
}

export function initGameUI(elements) {
  if (!elements?.gameViewContainer)
    return console.error("Game UI init failed: no container");

  gameContainer = elements.gameViewContainer;

  // Get UI elements from getUI function
  const {
    altitudeCanvas: altitude,
    compassCanvas: compass,
    volumeControlContainer,
  } = getUI();

  // Store references to the canvas elements
  altitudeCanvas = altitude;
  compassCanvas = compass;

  // Add UI elements to the container
  gameContainer.appendChild(altitudeCanvas);
  gameContainer.appendChild(compassCanvas);

  // Add volume control
  if (volumeControlContainer) {
    gameContainer.appendChild(volumeControlContainer);
  }

  positionUIElements();
  addGameUIStyles();

  window.addEventListener("resize", debounce(positionUIElements, 200));

  // Sync UI with audio controller state
  syncVolumeUI();
}

function positionUIElements() {
  if (!gameContainer || !altitudeCanvas || !compassCanvas) return;

  const containerRect = gameContainer.getBoundingClientRect();

  Object.assign(altitudeCanvas.style, {
    position: "absolute",
    top: `${(containerRect.height - ALTITUDE_HEIGHT) / 2}px`,
    right: `${UI_PADDING}px`,
    width: `${ALTITUDE_WIDTH}px`,
    height: `${ALTITUDE_HEIGHT}px`,
    zIndex: "4",
  });

  Object.assign(compassCanvas.style, {
    position: "absolute",
    top: `${(containerRect.height - COMPASS_SIZE) / 2}px`,
    left: `${UI_PADDING}px`,
    width: `${COMPASS_SIZE}px`,
    height: `${COMPASS_SIZE}px`,
    zIndex: "4",
  });

  // Position volume control at top-left
  const volumeContainer = document.getElementById("volume-control-container");
  if (volumeContainer) {
    Object.assign(volumeContainer.style, {
      position: "absolute",
      top: `${UI_PADDING}px`,
      left: `${UI_PADDING}px`,
      zIndex: "102", // Ensure visibility
      display: "flex",
      alignItems: "center",
      backgroundColor: `rgba(0, 0, 0, ${UI_BG_ALPHA})`,
      padding: "10px",
      borderRadius: "5px",
    });
  }
}

function addGameUIStyles() {
  if (!document.getElementById("game-ui-styles")) {
    const style = document.createElement("style");
    style.id = "game-ui-styles";
    style.textContent = `
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
}

export function updateAltitudeMeter(altitude) {
  if (!altitudeCtx) return;

  const ctx = altitudeCtx;
  const width = ALTITUDE_WIDTH;
  const height = ALTITUDE_HEIGHT;
  const { min, max } = heightLimits;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = `rgba(0, 0, 0, ${UI_BG_ALPHA})`;
  ctx.fillRect(0, 0, width, height);

  const normalizedAltitude = (altitude - min) / (max - min);
  const fillHeight = normalizedAltitude * (height - 10);
  const fillY = height - 5 - fillHeight;

  const atMaxHeight = Math.abs(altitude - max) < 0.1;
  const atMinHeight = Math.abs(altitude - min) < 0.1;

  if (altitudeCanvas) {
    altitudeCanvas.classList[atMaxHeight || atMinHeight ? "add" : "remove"](
      "at-limit"
    );
  }

  let gradient = ctx.createLinearGradient(0, fillY, 0, height - 5);
  if (atMaxHeight) {
    gradient.addColorStop(0, "#ff9966");
    gradient.addColorStop(1, "#ff5500");
  } else if (atMinHeight) {
    gradient.addColorStop(0, "#ffcc66");
    gradient.addColorStop(1, "#cc9933");
  } else {
    gradient.addColorStop(0, "#66ccff");
    gradient.addColorStop(1, "#3366cc");
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(5, fillY, width - 10, fillHeight);

  ctx.strokeStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, width - 10, height - 10);

  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.textAlign = "right";
  ctx.font = "10px Arial";

  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const y = height - 5 - (i / tickCount) * (height - 10);
    const altValue = min + (i / tickCount) * (max - min);
    ctx.fillRect(5, y, 8, 1);
    ctx.fillText(Math.round(altValue), width - 8, y + 3);
  }

  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(altitude)}m`, width / 2, 20);
}

export function updateCompass(rotation) {
  if (!compassCtx) return;

  const direction = getDirection(rotation);
  const ctx = compassCtx;
  const size = COMPASS_SIZE;
  const center = size / 2;
  const radius = center - 10;

  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = `rgba(0, 0, 0, ${UI_BG_ALPHA})`;
  ctx.beginPath();
  ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(-rotation);

  ctx.strokeStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  directions.forEach((dir, i) => {
    const angle = (i * Math.PI) / 4;
    const x = Math.sin(angle) * (radius - 15);
    const y = -Math.cos(angle) * (radius - 15);

    ctx.fillStyle =
      dir === direction ? "#66ccff" : `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
    ctx.fillText(dir, x, y);

    ctx.beginPath();
    ctx.moveTo(Math.sin(angle) * (radius - 8), -Math.cos(angle) * (radius - 8));
    ctx.lineTo(Math.sin(angle) * radius, -Math.cos(angle) * radius);
    ctx.stroke();
  });

  ctx.fillStyle = "#f44336";
  ctx.beginPath();
  ctx.moveTo(0, -radius + 25);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  ctx.fillStyle = `rgba(255, 255, 255, ${UI_FG_ALPHA})`;
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(direction, center, size - 15);
}

export function updateGameUI(playerState) {
  if (!playerState) return;

  let altitude;
  try {
    altitude = getCurrentHeight();
  } catch {
    altitude = playerState.position?.y || heightLimits.min;
  }

  let rotation;
  if (playerState.model?.quaternion) {
    const { w, y } = playerState.model.quaternion;
    rotation = 2 * Math.atan2(y, w);
  } else {
    rotation = 0;
  }

  updateAltitudeMeter(altitude);
  updateCompass(rotation);
}

// Function to synchronize volume UI with AudioController state
export function syncVolumeUI() {
  if (!audioController.initialized) return;

  // Update volume slider value with the stored volume, not the actual gain value
  if (volumeSlider && audioController.getVolume) {
    volumeSlider.value = audioController.getVolume().toString();
  } else if (volumeSlider && audioController.gainNode) {
    // Fallback to the old way
    volumeSlider.value = audioController.gainNode.gain.value.toString();
  }

  // Update speaker button icon
  if (speakerButton) {
    updateSpeakerIcon(audioController.audioEnabled);
  }
}

export function disposeGameUI() {
  if (altitudeCanvas?.parentNode)
    altitudeCanvas.parentNode.removeChild(altitudeCanvas);
  if (compassCanvas?.parentNode)
    compassCanvas.parentNode.removeChild(compassCanvas);

  // Remove volume control
  const volumeContainer = document.getElementById("volume-control-container");
  if (volumeContainer?.parentNode)
    volumeContainer.parentNode.removeChild(volumeContainer);

  window.removeEventListener("resize", positionUIElements);

  altitudeCanvas =
    compassCanvas =
    volumeSlider =
    speakerButton =
    altitudeCtx =
    compassCtx =
    gameContainer =
      null;
}

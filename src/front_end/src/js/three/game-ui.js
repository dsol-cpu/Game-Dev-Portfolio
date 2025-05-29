import { getCurrentHeight, getHeightLimits, getDirection } from "./player.js";
import { debounce } from "../utils/helper.js";
import { initMusicPlayer, syncMusicPlayer } from "./music-player-ui.js";
import {
  initGameControlsUI,
  cleanupGameControlsUI,
} from "./game-controls-ui.js";

// Constants
const UI_CONFIG = {
  altitude: { width: 35, height: 180 },
  compass: { size: 100 },
  padding: 20,
  alpha: { bg: 0.65, fg: 0.95 },
};

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
    fill: { start: "#5b98bd", end: "#2c5a8c" },
    fillHigh: { start: "#e5b668", end: "#c5853c" },
    fillLow: { start: "#8cadca", end: "#496d8c" },
    text: "rgba(225, 235, 245, 0.95)",
    tickMark: "rgba(155, 179, 205, 0.8)",
  },
  controls: {
    bg: "rgba(34, 51, 68, 0.75)",
    text: "rgba(225, 235, 245, 0.95)",
    accent: "#c5a45c",
  },
};

// Store cleanup functions
let cleanupFunctions = [];

// Pure functions for canvas creation
const createCanvas = (id, width, height, className = "game-ui-element") => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas, { id, width, height, className });
  return canvas;
};

const createAltitudeCanvas = () =>
  createCanvas(
    "altitude-meter",
    UI_CONFIG.altitude.width,
    UI_CONFIG.altitude.height
  );

const createCompassCanvas = () =>
  createCanvas("compass-rose", UI_CONFIG.compass.size, UI_CONFIG.compass.size);

// Pure functions for DOM element creation
const createElement = (tag, props = {}, children = []) => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  Object.assign(el.style, props.style || {});
  children.forEach((child) => el.appendChild(child));
  return el;
};

// Pure positioning functions
const calculatePosition = (
  containerRect,
  elementSize,
  side,
  offset = UI_CONFIG.padding
) => ({
  position: "absolute",
  top: `${(containerRect.height - elementSize.height) / 2}px`,
  [side]: `${offset}px`,
  width: `${elementSize.width}px`,
  height: `${elementSize.height}px`,
  zIndex: "4",
  willChange: "transform",
});

const positionElements = (container, elements) => {
  const rect = container.getBoundingClientRect();

  const positions = {
    altitude: calculatePosition(rect, UI_CONFIG.altitude, "right"),
    compass: calculatePosition(
      rect,
      { width: UI_CONFIG.compass.size, height: UI_CONFIG.compass.size },
      "left"
    ),
  };

  Object.entries(positions).forEach(([key, style]) => {
    if (elements[key]) Object.assign(elements[key].style, style);
  });

  // Position text labels
  ["altitude", "compass"].forEach((type) => {
    const textEl = document.getElementById(`${type}-text`);
    if (textEl) {
      const isAltitude = type === "altitude";
      const size = isAltitude
        ? UI_CONFIG.altitude
        : { width: UI_CONFIG.compass.size };
      const side = isAltitude ? "right" : "left";

      Object.assign(textEl.style, {
        position: "absolute",
        top: `${
          (rect.height -
            (isAltitude ? UI_CONFIG.altitude.height : UI_CONFIG.compass.size)) /
            2 -
          25
        }px`,
        [side]: `${UI_CONFIG.padding + size.width / 2 - 15}px`,
        width: "30px",
        textAlign: "center",
      });
    }
  });
};

// Pure canvas drawing functions
const roundedRect = (ctx, x, y, width, height, radius) => {
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
};

const createGradient = (ctx, height, colors) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors.start);
  gradient.addColorStop(1, colors.end);
  return gradient;
};

const drawAltitudeMeter = (canvas, altitude) => {
  const ctx = canvas.getContext("2d");
  const { width, height } = UI_CONFIG.altitude;
  const limits = getHeightLimits();

  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = UI_THEME.altitude.bg;
  roundedRect(ctx, 0, 0, width, height, 5);
  ctx.fill();

  // Calculate fill
  const normalizedAltitude =
    (altitude - limits.min) / (limits.max - limits.min);
  const fillHeight = normalizedAltitude * (height - 10);
  const fillY = height - 5 - fillHeight;

  // Determine fill color based on altitude
  const atMax = Math.abs(altitude - limits.max) < 0.1;
  const atMin = Math.abs(altitude - limits.min) < 0.1;

  const fillColors = atMax
    ? UI_THEME.altitude.fillHigh
    : atMin
    ? UI_THEME.altitude.fillLow
    : UI_THEME.altitude.fill;

  ctx.fillStyle = createGradient(ctx, height, fillColors);
  roundedRect(ctx, 5, fillY, width - 10, fillHeight, 3);
  ctx.fill();

  // Border
  ctx.strokeStyle = UI_THEME.altitude.border;
  ctx.lineWidth = 2;
  roundedRect(ctx, 5, 5, width - 10, height - 10, 3);
  ctx.stroke();

  // Tick marks
  ctx.strokeStyle = UI_THEME.altitude.tickMark;
  ctx.lineWidth = 1;

  [0.1, 0.5, 0.9].forEach((pos) => {
    const y = height - 5 - pos * (height - 10);
    [
      [5, 10],
      [width - 5, width - 10],
    ].forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.lineTo(end, y);
      ctx.stroke();
    });
  });

  // Update canvas class for limit indication
  const hasLimitClass = canvas.classList.contains("at-limit");
  if ((atMax || atMin) && !hasLimitClass) {
    canvas.classList.add("at-limit");
  } else if (!(atMax || atMin) && hasLimitClass) {
    canvas.classList.remove("at-limit");
  }
};

const drawCompass = (canvas, rotation) => {
  const ctx = canvas.getContext("2d");
  const size = UI_CONFIG.compass.size;
  const center = size / 2;
  const radius = center - 10;

  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = UI_THEME.compass.bg;
  ctx.beginPath();
  ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
  ctx.fill();

  // Compass ring (static)
  ctx.strokeStyle = UI_THEME.compass.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(center, center);

  // Draw static tick marks and labels (these don't rotate)
  const cardinalAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  const cardinalLabels = ["N", "E", "S", "W"];

  cardinalAngles.forEach((angle, i) => {
    const innerRadius = radius - 10;
    const outerRadius = radius;
    const isNorth = i === 0;

    const innerX = Math.sin(angle) * innerRadius;
    const innerY = -Math.cos(angle) * innerRadius;
    const outerX = Math.sin(angle) * outerRadius;
    const outerY = -Math.cos(angle) * outerRadius;

    // Tick mark
    ctx.strokeStyle = isNorth
      ? UI_THEME.compass.northPointer
      : UI_THEME.compass.border;
    ctx.lineWidth = isNorth ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();

    // Label
    if (isNorth) {
      ctx.font = "bold 16px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = UI_THEME.compass.northPointer;
      ctx.fillText(cardinalLabels[i], innerX * 0.8, innerY * 0.8);
    }
  });

  // Intermediate tick marks
  [
    Math.PI / 4,
    (Math.PI * 3) / 4,
    (Math.PI * 5) / 4,
    (Math.PI * 7) / 4,
  ].forEach((angle) => {
    const innerRadius = radius - 5;
    const outerRadius = radius;

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
  });

  // Rotate for the compass needle (only the needle rotates)
  ctx.rotate(-rotation);

  // Draw compass needle (this rotates with the player)
  ctx.fillStyle = UI_THEME.compass.accent;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 20);
  ctx.lineTo(6, -5);
  ctx.lineTo(0, 5);
  ctx.lineTo(-6, -5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = UI_THEME.compass.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
};

// Pure text label creation
const createTextLabel = (id, className = "ui-text-label") =>
  createElement("div", {
    id,
    className,
    style: {
      fontSize: "14px",
      fontWeight: "bold",
      backgroundColor: UI_THEME.altitude.bg,
      padding: "2px 4px",
      borderRadius: "3px",
      border: `1px solid ${UI_THEME.altitude.border}`,
      zIndex: "5",
      pointerEvents: "none",
      color: UI_THEME.altitude.text,
    },
  });

// Pure styles creation
const createStyles = () => {
  if (document.getElementById("game-ui-styles")) return;

  const style = createElement("style", {
    id: "game-ui-styles",
    textContent: `
      .game-ui-element {
        pointer-events: none;
        border-radius: 5px;
        will-change: transform;
      }
      #altitude-meter {
        transition: box-shadow 0.2s ease;
        border: 1px solid ${UI_THEME.altitude.border};
      }
      #altitude-meter.at-limit {
        box-shadow: 0 0 10px rgba(255, 180, 40, 0.6);
      }

    `,
  });

  document.head.appendChild(style);
};

// Main API functions
export const getUI = () => ({
  altitudeCanvas: createAltitudeCanvas(),
  compassCanvas: createCompassCanvas(),
});

export const initGameUI = (elements) => {
  if (!elements?.gameViewContainer) {
    console.error("Game UI init failed: no container");
    return;
  }

  const container = elements.gameViewContainer;
  const ui = getUI();

  // Add elements to container
  const fragment = document.createDocumentFragment();
  Object.values(ui).forEach((el) => fragment.appendChild(el));
  container.appendChild(fragment);

  // Create text labels
  const altitudeText = createTextLabel("altitude-text");
  const compassText = createTextLabel("compass-text");
  container.appendChild(altitudeText);
  container.appendChild(compassText);

  // Position elements
  const elements_map = {
    altitude: ui.altitudeCanvas,
    compass: ui.compassCanvas,
  };

  positionElements(container, elements_map);

  // Add styles
  createStyles();

  // Initialize game controls UI
  initGameControlsUI();

  // Store cleanup function for game controls
  cleanupFunctions.push(() => cleanupGameControlsUI());

  // Initialize media player
  const mediaPlayerCleanup = initMusicPlayer(container, [
    "/audio/Little Jack (Nasrad, Ixa'taka, Valua).mp3",
  ]);
  if (mediaPlayerCleanup) {
    cleanupFunctions.push(mediaPlayerCleanup);
  }

  // Handle resize
  const debouncedResize = debounce(
    () => positionElements(container, elements_map),
    200
  );
  window.addEventListener("resize", debouncedResize, { passive: true });

  // Store resize cleanup
  cleanupFunctions.push(() =>
    window.removeEventListener("resize", debouncedResize)
  );

  // Return cleanup function
  return () => {
    // Clean up all stored cleanup functions
    cleanupFunctions.forEach((cleanup) => cleanup());
    cleanupFunctions = [];

    // Remove UI elements
    Object.values(ui).forEach((el) => el.remove());
    altitudeText.remove();
    compassText.remove();
  };
};

export const updateGameUI = (playerState) => {
  if (!playerState) return;

  const altitude = (() => {
    try {
      return getCurrentHeight();
    } catch {
      return playerState.position?.y || getHeightLimits().min;
    }
  })();

  const rotation = (() => {
    if (playerState.model?.quaternion) {
      const { w, y } = playerState.model.quaternion;
      return 2 * Math.atan2(y, w);
    }
    return 0;
  })();

  // Update canvases
  const altitudeCanvas = document.getElementById("altitude-meter");
  const compassCanvas = document.getElementById("compass-rose");

  if (altitudeCanvas) drawAltitudeMeter(altitudeCanvas, altitude);
  if (compassCanvas) drawCompass(compassCanvas, rotation);

  // Update text labels
  const altitudeText = document.getElementById("altitude-text");
  const compassText = document.getElementById("compass-text");

  if (altitudeText) altitudeText.textContent = Math.round(altitude).toString();
  if (compassText) compassText.textContent = getDirection(rotation);

  // Sync media player state
  syncMusicPlayer();
};

export const disposeGameUI = () => {
  // Clean up all stored cleanup functions first
  cleanupFunctions.forEach((cleanup) => cleanup());
  cleanupFunctions = [];

  // Remove UI elements
  ["altitude-meter", "compass-rose", "altitude-text", "compass-text"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  );

  const styles = document.getElementById("game-ui-styles");
  if (styles) styles.remove();
};

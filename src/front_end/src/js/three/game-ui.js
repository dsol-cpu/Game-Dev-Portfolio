import { getCurrentHeight, getHeightLimits, getDirection } from "./player.js";
import { debounce } from "../utils/helper.js";
import {
  initMusicPlayer,
  syncMusicPlayer,
  hideMusicPlayer,
  showMusicPlayer,
} from "./music-player-ui.js";
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

// Store cleanup functions - separate music player from others
let cleanupFunctions = [];
let musicPlayerInitialized = false;

// Cache for expensive operations
const cache = {
  heightLimits: null,
  lastAltitude: null,
  lastRotation: null,
  lastDirection: null,
  gradients: new Map(),
  paths: new Map(),
  lastLimitState: null,
};

// Pre-computed constants for performance
const ALTITUDE_CONSTANTS = {
  fillRadius: 3,
  borderRadius: 3,
  tickPositions: [0.1, 0.5, 0.9],
  tickCoords: [
    [5, 10],
    [UI_CONFIG.altitude.width - 5, UI_CONFIG.altitude.width - 10],
  ],
};

const COMPASS_CONSTANTS = {
  cardinalAngles: [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2],
  cardinalLabels: ["N", "E", "S", "W"],
  intermediateAngles: [
    Math.PI / 4,
    (Math.PI * 3) / 4,
    (Math.PI * 5) / 4,
    (Math.PI * 7) / 4,
  ],
  center: UI_CONFIG.compass.size / 2,
  radius: UI_CONFIG.compass.size / 2 - 10,
};

// Optimized canvas creation with better memory management
const createCanvas = (id, width, height, className = "game-ui-element") => {
  const canvas = document.createElement("canvas");
  canvas.id = id;
  canvas.width = width;
  canvas.height = height;
  canvas.className = className;

  // Enable hardware acceleration and optimize rendering
  const ctx = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });

  // Set initial optimizations
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  return canvas;
};

// Cached gradient creation
const getGradient = (ctx, height, colorKey) => {
  const cacheKey = `${height}-${colorKey}`;
  if (cache.gradients.has(cacheKey)) {
    return cache.gradients.get(cacheKey);
  }

  const colors = UI_THEME.altitude[colorKey];
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors.start);
  gradient.addColorStop(1, colors.end);

  cache.gradients.set(cacheKey, gradient);
  return gradient;
};

// Optimized rounded rectangle using cached Path2D
const getRoundedRectPath = (x, y, width, height, radius) => {
  const cacheKey = `${x}-${y}-${width}-${height}-${radius}`;
  if (cache.paths.has(cacheKey)) {
    return cache.paths.get(cacheKey);
  }

  const path = new Path2D();
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
  path.closePath();

  cache.paths.set(cacheKey, path);
  return path;
};

// Throttled direction calculation
const getDirectionThrottled = (rotation) => {
  const roundedRotation = Math.round(rotation * 100) / 100; // Round to 2 decimal places
  if (cache.lastRotation === roundedRotation && cache.lastDirection) {
    return cache.lastDirection;
  }

  cache.lastRotation = roundedRotation;
  cache.lastDirection = getDirection(rotation);
  return cache.lastDirection;
};

// Optimized altitude meter drawing with minimal redraws
const drawAltitudeMeter = (canvas, altitude) => {
  // Skip if altitude hasn't changed significantly
  if (
    cache.lastAltitude !== null &&
    Math.abs(altitude - cache.lastAltitude) < 0.1
  ) {
    return;
  }
  cache.lastAltitude = altitude;

  const ctx = canvas.getContext("2d");
  const { width, height } = UI_CONFIG.altitude;

  // Cache height limits
  if (!cache.heightLimits) {
    cache.heightLimits = getHeightLimits();
  }
  const limits = cache.heightLimits;

  // Use requestAnimationFrame for smooth updates
  const draw = () => {
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = UI_THEME.altitude.bg;
    const bgPath = getRoundedRectPath(0, 0, width, height, 5);
    ctx.fill(bgPath);

    // Calculate fill parameters
    const normalizedAltitude =
      (altitude - limits.min) / (limits.max - limits.min);
    const fillHeight = normalizedAltitude * (height - 10);
    const fillY = height - 5 - fillHeight;

    // Determine fill color based on altitude
    const atMax = Math.abs(altitude - limits.max) < 0.1;
    const atMin = Math.abs(altitude - limits.min) < 0.1;
    const currentLimitState = atMax ? "max" : atMin ? "min" : "normal";

    const fillColorKey = atMax ? "fillHigh" : atMin ? "fillLow" : "fill";
    ctx.fillStyle = getGradient(ctx, height, fillColorKey);

    const fillPath = getRoundedRectPath(
      5,
      fillY,
      width - 10,
      fillHeight,
      ALTITUDE_CONSTANTS.fillRadius
    );
    ctx.fill(fillPath);

    // Border
    ctx.strokeStyle = UI_THEME.altitude.border;
    ctx.lineWidth = 2;
    const borderPath = getRoundedRectPath(
      5,
      5,
      width - 10,
      height - 10,
      ALTITUDE_CONSTANTS.borderRadius
    );
    ctx.stroke(borderPath);

    // Tick marks (batch draw for better performance)
    ctx.strokeStyle = UI_THEME.altitude.tickMark;
    ctx.lineWidth = 1;
    ctx.beginPath();

    ALTITUDE_CONSTANTS.tickPositions.forEach((pos) => {
      const y = height - 5 - pos * (height - 10);
      ALTITUDE_CONSTANTS.tickCoords.forEach(([start, end]) => {
        ctx.moveTo(start, y);
        ctx.lineTo(end, y);
      });
    });
    ctx.stroke();

    // Update canvas class for limit indication (only if changed)
    if (cache.lastLimitState !== currentLimitState) {
      canvas.classList.toggle("at-limit", currentLimitState !== "normal");
      cache.lastLimitState = currentLimitState;
    }
  };

  // Use RAF for smooth animation
  requestAnimationFrame(draw);
};

// Optimized compass drawing with static element caching
const drawCompass = (() => {
  let staticElementsDrawn = false;
  let staticCanvas = null;

  return (canvas, rotation) => {
    const ctx = canvas.getContext("2d");
    const { size } = UI_CONFIG.compass;
    const { center, radius } = COMPASS_CONSTANTS;

    // Create static elements canvas once
    if (!staticElementsDrawn || !staticCanvas) {
      staticCanvas = document.createElement("canvas");
      staticCanvas.width = size;
      staticCanvas.height = size;
      const staticCtx = staticCanvas.getContext("2d");

      // Draw static elements (background, ring, ticks, labels)
      staticCtx.fillStyle = UI_THEME.compass.bg;
      staticCtx.beginPath();
      staticCtx.arc(center, center, radius + 5, 0, Math.PI * 2);
      staticCtx.fill();

      // Compass ring
      staticCtx.strokeStyle = UI_THEME.compass.border;
      staticCtx.lineWidth = 2;
      staticCtx.beginPath();
      staticCtx.arc(center, center, radius, 0, Math.PI * 2);
      staticCtx.stroke();

      staticCtx.save();
      staticCtx.translate(center, center);

      // Draw cardinal directions
      COMPASS_CONSTANTS.cardinalAngles.forEach((angle, i) => {
        const innerRadius = radius - 10;
        const outerRadius = radius;
        const isNorth = i === 0;

        const innerX = Math.sin(angle) * innerRadius;
        const innerY = -Math.cos(angle) * innerRadius;
        const outerX = Math.sin(angle) * outerRadius;
        const outerY = -Math.cos(angle) * outerRadius;

        // Tick mark
        staticCtx.strokeStyle = isNorth
          ? UI_THEME.compass.northPointer
          : UI_THEME.compass.border;
        staticCtx.lineWidth = isNorth ? 2 : 1.5;
        staticCtx.beginPath();
        staticCtx.moveTo(innerX, innerY);
        staticCtx.lineTo(outerX, outerY);
        staticCtx.stroke();

        // North label
        if (isNorth) {
          staticCtx.font = "bold 16px Arial, sans-serif";
          staticCtx.textAlign = "center";
          staticCtx.textBaseline = "middle";
          staticCtx.fillStyle = UI_THEME.compass.northPointer;
          staticCtx.fillText(
            COMPASS_CONSTANTS.cardinalLabels[i],
            innerX * 0.8,
            innerY * 0.8
          );
        }
      });

      // Intermediate tick marks
      staticCtx.strokeStyle = UI_THEME.compass.border;
      staticCtx.lineWidth = 1;
      staticCtx.beginPath();
      COMPASS_CONSTANTS.intermediateAngles.forEach((angle) => {
        const innerRadius = radius - 5;
        const outerRadius = radius;
        const innerX = Math.sin(angle) * innerRadius;
        const innerY = -Math.cos(angle) * innerRadius;
        const outerX = Math.sin(angle) * outerRadius;
        const outerY = -Math.cos(angle) * outerRadius;

        staticCtx.moveTo(innerX, innerY);
        staticCtx.lineTo(outerX, outerY);
      });
      staticCtx.stroke();

      staticCtx.restore();
      staticElementsDrawn = true;
    }

    // Clear and draw static elements
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(staticCanvas, 0, 0);

    // Draw rotating needle
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-rotation);

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
})();

// Batch DOM updates to prevent layout thrashing
const batchDOMUpdates = (updates) => {
  requestAnimationFrame(() => {
    updates.forEach((update) => update());
  });
};

// Optimized element positioning with caching
const positionElements = (() => {
  let lastRect = null;
  let lastPositions = null;

  return (container, elements) => {
    const rect = container.getBoundingClientRect();

    // Skip if container hasn't changed
    if (
      lastRect &&
      lastRect.width === rect.width &&
      lastRect.height === rect.height
    ) {
      return;
    }
    lastRect = { width: rect.width, height: rect.height };

    const positions = {
      altitude: {
        position: "absolute",
        top: `${(rect.height - UI_CONFIG.altitude.height) / 2}px`,
        right: `${UI_CONFIG.padding}px`,
        width: `${UI_CONFIG.altitude.width}px`,
        height: `${UI_CONFIG.altitude.height}px`,
        zIndex: "4",
        willChange: "transform",
      },
      compass: {
        position: "absolute",
        top: `${(rect.height - UI_CONFIG.compass.size) / 2}px`,
        left: `${UI_CONFIG.padding}px`,
        width: `${UI_CONFIG.compass.size}px`,
        height: `${UI_CONFIG.compass.size}px`,
        zIndex: "4",
        willChange: "transform",
      },
    };

    // Batch style updates
    const styleUpdates = [];
    Object.entries(positions).forEach(([key, style]) => {
      if (elements[key]) {
        styleUpdates.push(() => Object.assign(elements[key].style, style));
      }
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

        styleUpdates.push(() => {
          Object.assign(textEl.style, {
            position: "absolute",
            top: `${
              (rect.height -
                (isAltitude
                  ? UI_CONFIG.altitude.height
                  : UI_CONFIG.compass.size)) /
                2 -
              25
            }px`,
            [side]: `${UI_CONFIG.padding + size.width / 2 - 15}px`,
            width: "30px",
            textAlign: "center",
          });
        });
      }
    });

    batchDOMUpdates(styleUpdates);
    lastPositions = positions;
  };
})();

// Pure functions remain the same
const createAltitudeCanvas = () =>
  createCanvas(
    "altitude-meter",
    UI_CONFIG.altitude.width,
    UI_CONFIG.altitude.height
  );

const createCompassCanvas = () =>
  createCanvas("compass-rose", UI_CONFIG.compass.size, UI_CONFIG.compass.size);

const createElement = (tag, props = {}, children = []) => {
  const el = document.createElement(tag);
  Object.assign(el, props);
  Object.assign(el.style, props.style || {});
  children.forEach((child) => el.appendChild(child));
  return el;
};

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

const createStyles = () => {
  if (document.getElementById("game-ui-styles")) return;

  const style = createElement("style", {
    id: "game-ui-styles",
    textContent: `
      .game-ui-element {
        pointer-events: none;
        border-radius: 5px;
        will-change: transform;
        transform: translateZ(0); /* Force hardware acceleration */
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

  // Add elements to container using document fragment for better performance
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
  createStyles();
  initGameControlsUI();
  cleanupFunctions.push(() => cleanupGameControlsUI());

  // Initialize or show music player (but don't add to cleanup functions)
  if (!musicPlayerInitialized) {
    initMusicPlayer(container, [
      "/audio/Little Jack (Nasrad, Ixa'taka, Valua).mp3",
    ]);
    musicPlayerInitialized = true;
  } else {
    showMusicPlayer();
  }

  // Optimized resize handler
  const debouncedResize = debounce(() => {
    // Clear position cache on resize
    positionElements.lastRect = null;
    positionElements(container, elements_map);
  }, 200);

  window.addEventListener("resize", debouncedResize, { passive: true });
  cleanupFunctions.push(() =>
    window.removeEventListener("resize", debouncedResize)
  );

  // Return cleanup function that hides music player instead of disposing
  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
    cleanupFunctions = [];
    Object.values(ui).forEach((el) => el.remove());
    altitudeText.remove();
    compassText.remove();

    // Hide music player instead of disposing it
    hideMusicPlayer();

    // Clear caches
    cache.gradients.clear();
    cache.paths.clear();
    cache.heightLimits = null;
    cache.lastAltitude = null;
    cache.lastRotation = null;
    cache.lastDirection = null;
    cache.lastLimitState = null;
  };
};

// Optimized update function with minimal redraws
export const updateGameUI = (() => {
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE = 16; // ~60fps

  return (playerState) => {
    if (!playerState) return;

    const now = performance.now();
    if (now - lastUpdateTime < UPDATE_THROTTLE) return;
    lastUpdateTime = now;

    const altitude = (() => {
      try {
        return getCurrentHeight();
      } catch {
        return playerState.position?.y || (cache.heightLimits?.min ?? 0);
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

    // Batch text updates
    const textUpdates = [];
    const altitudeText = document.getElementById("altitude-text");
    const compassText = document.getElementById("compass-text");

    if (altitudeText) {
      const roundedAltitude = Math.round(altitude).toString();
      if (altitudeText.textContent !== roundedAltitude) {
        textUpdates.push(() => (altitudeText.textContent = roundedAltitude));
      }
    }

    if (compassText) {
      const direction = getDirectionThrottled(rotation);
      if (compassText.textContent !== direction) {
        textUpdates.push(() => (compassText.textContent = direction));
      }
    }

    if (textUpdates.length > 0) {
      batchDOMUpdates(textUpdates);
    }

    // Sync media player state
    syncMusicPlayer();
  };
})();

export const disposeGameUI = () => {
  cleanupFunctions.forEach((cleanup) => cleanup());
  cleanupFunctions = [];

  ["altitude-meter", "compass-rose", "altitude-text", "compass-text"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  );

  const styles = document.getElementById("game-ui-styles");
  if (styles) styles.remove();

  // Hide music player instead of disposing it
  hideMusicPlayer();

  // Clear all caches
  cache.gradients.clear();
  cache.paths.clear();
  cache.heightLimits = null;
  cache.lastAltitude = null;
  cache.lastRotation = null;
  cache.lastDirection = null;
  cache.lastLimitState = null;
};

// Add new function to completely dispose everything (call this only on page unload)
export const completelyDisposeGameUI = () => {
  disposeGameUI();

  // Import and call the complete disposal function
  import("./music-player-ui.js").then(({ disposeMusicPlayer }) => {
    disposeMusicPlayer();
    musicPlayerInitialized = false;
  });
};

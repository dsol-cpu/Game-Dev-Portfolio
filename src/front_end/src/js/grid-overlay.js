/**
 * @fileoverview Grid overlay module that creates a "swiss cheese" effect between project cards
 * Adds a responsive overlay layer that fills spaces between cards while keeping card spaces transparent
 */

import { TWO_PI } from "./constants/constants.js";
import { debounce } from "./utils/helper.js";

// Configuration
const CONFIG = {
  overlayClass: "grid-overlay",
  cardSelector: ".project-card",
  canvasSelector: ".portfolio-canvas",
  gridSelector: ".project-card-grid",
  sectionSelector: ".portfolio-section, #portfolio, .portfolio",
  debounceTime: 150,
  patterns: [
    // Different fill patterns that rotate based on card count
    {
      backgroundColor: "rgba(20, 20, 30, 0.7)",
      backgroundImage:
        "radial-gradient(circle at 25px 25px, rgba(40, 45, 70, 0.5) 2px, transparent 0)",
    },
    {
      backgroundColor: "rgba(25, 25, 35, 0.65)",
      backgroundImage:
        "linear-gradient(45deg, rgba(50, 55, 80, 0.4) 25%, transparent 25%, transparent 75%, rgba(50, 55, 80, 0.4) 75%)",
    },
    {
      backgroundColor: "rgba(20, 20, 30, 0.7)",
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(40, 45, 70, 0.5) 0, rgba(40, 45, 70, 0.5) 1px, transparent 1px, transparent 5px)",
    },
  ],
  holeGrow: 5, // Amount to grow the holes (padding around cards in px)
  zIndex: 2, // Between canvas (1) and cards (3)
};

// Module state
const state = {
  overlay: null,
  ctx: null,
  observer: null,
  resizeHandler: null,
  cards: [],
  isInitialized: false,
  patternIndex: 0,
};

/**
 * Initialize the grid overlay
 */
export function initGridOverlay() {
  if (state.isInitialized) return;

  const section = document.querySelector(CONFIG.sectionSelector);
  const grid = document.querySelector(CONFIG.gridSelector);

  if (!section || !grid) {
    console.warn("Grid overlay: Could not find portfolio section or grid");
    return;
  }

  createOverlay(section);
  refreshOverlay();
  setupObserver();
  setupResizeListener();

  state.isInitialized = true;
}

/**
 * Creates the overlay canvas element
 */
function createOverlay(container) {
  // Create overlay canvas
  const overlay = document.createElement("canvas");
  overlay.className = CONFIG.overlayClass;

  // Set initial styling
  Object.assign(overlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: CONFIG.zIndex,
    pointerEvents: "none", // Let clicks pass through
  });

  // Set initial dimensions
  overlay.width = container.clientWidth;
  overlay.height = container.clientHeight;

  // Add to container
  container.appendChild(overlay);

  // Store in state
  state.overlay = overlay;
  state.ctx = overlay.getContext("2d");
}

/**
 * Refreshes the overlay by recalculating card positions and redrawing
 */
function refreshOverlay() {
  if (!state.overlay || !state.ctx) return;

  const overlay = state.overlay;
  const ctx = state.ctx;

  // Update canvas dimensions
  const container = overlay.parentElement;
  if (container) {
    overlay.width = container.clientWidth;
    overlay.height = container.clientHeight;
  }

  // Clear the canvas
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  // Get all visible cards
  const cards = Array.from(document.querySelectorAll(CONFIG.cardSelector));
  state.cards = cards;

  // No cards? Just return
  if (cards.length === 0) return;

  // Select pattern based on card count
  state.patternIndex = cards.length % CONFIG.patterns.length;
  const pattern = CONFIG.patterns[state.patternIndex];

  // Create overlay base
  createOverlayBase(ctx, overlay.width, overlay.height, pattern);

  // Cut holes for cards
  cutCardHoles(ctx, cards, overlay);
}

/**
 * Creates the base overlay with the current pattern
 */
function createOverlayBase(ctx, width, height, pattern) {
  // Fill with background color
  ctx.fillStyle = pattern.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Add pattern if specified
  if (pattern.backgroundImage) {
    // Create off-screen canvas for pattern
    const patternCanvas = document.createElement("canvas");
    const patternSize = 50; // Size of the pattern tile
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;

    const patternCtx = patternCanvas.getContext("2d");

    // Parse pattern type from backgroundImage
    if (pattern.backgroundImage.includes("radial-gradient")) {
      // Draw radial pattern
      drawRadialPattern(patternCtx, patternSize);
    } else if (pattern.backgroundImage.includes("linear-gradient")) {
      if (pattern.backgroundImage.includes("repeating")) {
        // Draw repeating lines
        drawRepeatingLines(patternCtx, patternSize);
      } else {
        // Draw checkered pattern
        drawCheckerPattern(patternCtx, patternSize);
      }
    }

    // Create pattern from the off-screen canvas
    const bgPattern = ctx.createPattern(patternCanvas, "repeat");
    ctx.fillStyle = bgPattern;
    ctx.globalAlpha = 0.6; // Subtle pattern overlay
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Draws a radial dot pattern on the provided context
 */
function drawRadialPattern(ctx, size) {
  ctx.fillStyle = "rgba(40, 45, 70, 0.5)";

  // Create dots in a grid
  for (let x = 0; x < size; x += 10) {
    for (let y = 0; y < size; y += 10) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, TWO_PI);
      ctx.fill();
    }
  }
}

/**
 * Draws a checker pattern on the provided context
 */
function drawCheckerPattern(ctx, size) {
  ctx.fillStyle = "rgba(50, 55, 80, 0.4)";

  // Quarter size for checker
  const half = size / 2;

  // Draw two rectangles to create checker pattern
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
}

/**
 * Draws repeating lines on the provided context
 */
function drawRepeatingLines(ctx, size) {
  ctx.strokeStyle = "rgba(40, 45, 70, 0.5)";
  ctx.lineWidth = 1;

  // Draw diagonal lines
  for (let i = 0; i < size * 2; i += 5) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(i, 0);
    ctx.stroke();
  }
}

/**
 * Cuts holes in the overlay for each card
 */
function cutCardHoles(ctx, cards, overlay) {
  const canvasRect = overlay.getBoundingClientRect();

  // Use composite operation to "cut out" the card areas
  ctx.globalCompositeOperation = "destination-out";

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();

    // Calculate card position relative to canvas
    const x = rect.left - canvasRect.left - CONFIG.holeGrow;
    const y = rect.top - canvasRect.top - CONFIG.holeGrow;
    const width = rect.width + CONFIG.holeGrow * 2;
    const height = rect.height + CONFIG.holeGrow * 2;

    // Cut hole for the card with rounded corners
    const radius = 10; // Rounded corner radius

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();

    ctx.fill();
  });

  // Reset composite operation
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Sets up mutation observer to monitor card changes
 */
function setupObserver() {
  if (window.MutationObserver) {
    state.observer = new MutationObserver(
      debounce(() => {
        refreshOverlay();
      }, CONFIG.debounceTime)
    );

    const grid = document.querySelector(CONFIG.gridSelector);
    if (grid) {
      state.observer.observe(grid, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
  }
}

/**
 * Sets up resize event listener
 */
function setupResizeListener() {
  state.resizeHandler = debounce(() => {
    refreshOverlay();
  }, CONFIG.debounceTime);

  window.addEventListener("resize", state.resizeHandler);
}

/**
 * Updates the overlay when cards change state (e.g., expand/collapse)
 */
export function updateOverlay() {
  refreshOverlay();
}

/**
 * Updates the overlay with animation effects when cards are added/moved
 */
export function animateOverlayTransition() {
  // First do a quick refresh
  refreshOverlay();

  // Then animate the holes growing
  const originalGrow = CONFIG.holeGrow;
  const frames = 10;
  let frame = 0;

  const animate = () => {
    if (frame <= frames) {
      CONFIG.holeGrow = originalGrow * (frame / frames);
      refreshOverlay();
      frame++;
      requestAnimationFrame(animate);
    } else {
      CONFIG.holeGrow = originalGrow;
      refreshOverlay();
    }
  };

  animate();
}

/**
 * Changes the pattern used for the overlay
 * @param {number} index Pattern index to use (or cycles to next if undefined)
 */
export function changeOverlayPattern(index) {
  if (index !== undefined) {
    state.patternIndex = index % CONFIG.patterns.length;
  } else {
    state.patternIndex = (state.patternIndex + 1) % CONFIG.patterns.length;
  }

  refreshOverlay();
}

/**
 * Clean up event handlers and observers
 */
export function destroyGridOverlay() {
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }

  if (state.resizeHandler) {
    window.removeEventListener("resize", state.resizeHandler);
    state.resizeHandler = null;
  }

  if (state.overlay && state.overlay.parentElement) {
    state.overlay.parentElement.removeChild(state.overlay);
    state.overlay = null;
    state.ctx = null;
  }

  state.isInitialized = false;
}

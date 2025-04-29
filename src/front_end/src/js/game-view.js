/**
 * @fileoverview Handles game view mode and canvas setup
 */

import { debounce } from "./utils/helper.js";

let isGameViewActive = false;
let resizeObserver = null;
let lastWidth = 0;
let lastHeight = 0;

/**
 * Toggle between scroll view and game view
 */
function toggleGameView() {
  const body = document.body;
  const toggleBtn = document.getElementById("view-toggle-btn");
  const viewLabel = toggleBtn.querySelector(".view-label");

  isGameViewActive = !isGameViewActive;

  if (isGameViewActive) {
    body.classList.add("game-mode");
    viewLabel.textContent = "Game View";

    // Force an immediate resize when entering game mode
    const container = document.getElementById("game-view-container");
    const mainGameCanvas = document.getElementById("main-game-canvas");
    if (container && mainGameCanvas) {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      mainGameCanvas.width = width;
      mainGameCanvas.height = height;
      lastWidth = width;
      lastHeight = height;

      if (window.updateGameViewSize) {
        window.updateGameViewSize(width, height);
      }
    }

    if (window.startGameRendering) {
      window.startGameRendering();
    }
  } else {
    body.classList.remove("game-mode");
    viewLabel.textContent = "Scroll View";
    if (window.stopGameRendering) {
      window.stopGameRendering();
    }
  }

  // Call the user interaction handler if available
  if (window.handleUserInteraction) {
    window.handleUserInteraction();
  }

  return isGameViewActive;
}

/**
 * Resize the game canvas using ResizeObserver
 */
function setupGameCanvasResize() {
  const mainGameCanvas = document.getElementById("main-game-canvas");
  if (!mainGameCanvas) return;

  // Clean up existing observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  const container = document.getElementById("game-view-container");

  // Set initial size
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;
  mainGameCanvas.width = width;
  mainGameCanvas.height = height;
  lastWidth = width;
  lastHeight = height;

  const handleResize = debounce(() => {
    if (!isGameViewActive) return;

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    // Only update if dimensions have actually changed
    if (Math.abs(lastWidth - width) > 1 || Math.abs(lastHeight - height) > 1) {
      console.log(
        `Resizing canvas from ${lastWidth}x${lastHeight} to ${width}x${height}`
      );
      mainGameCanvas.width = width;
      mainGameCanvas.height = height;
      lastWidth = width;
      lastHeight = height;

      // Notify renderer if available
      if (window.updateGameViewSize) {
        window.updateGameViewSize(width, height);
      }
    }
  }, 200);

  resizeObserver = new ResizeObserver((entries) => {
    handleResize();
  });

  resizeObserver.observe(container);
}

/**
 * Initialize game view
 */
function initGameView() {
  const viewToggleBtn = document.getElementById("view-toggle-btn");
  const mainGameCanvas = document.getElementById("main-game-canvas");

  if (viewToggleBtn && mainGameCanvas) {
    setupGameCanvasResize();
    viewToggleBtn.addEventListener("click", toggleGameView);
  }

  // Add window resize listener as a fallback
  window.addEventListener(
    "resize",
    debounce(() => {
      if (isGameViewActive) {
        setupGameCanvasResize(); // Re-setup on window resize to catch any edge cases
      }
    }, 300)
  );

  return {
    isGameViewActive: () => isGameViewActive,
    toggleGameView,
  };
}

export { initGameView, toggleGameView };

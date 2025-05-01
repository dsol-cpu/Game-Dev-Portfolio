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
  const mainContent = document.querySelector(".main-content");
  const sidebar = document.querySelector(".sidebar");
  const gameViewContainer = document.getElementById("game-view-container");

  isGameViewActive = !isGameViewActive;

  if (isGameViewActive) {
    body.classList.add("game-mode");
    viewLabel.textContent = "Scroll View";

    // Position game view container next to sidebar, over main content
    const sidebarWidth = sidebar.offsetWidth;
    gameViewContainer.style.position = "fixed";
    gameViewContainer.style.top = "0";
    gameViewContainer.style.left = sidebarWidth + "px";
    gameViewContainer.style.width = `calc(100% - ${sidebarWidth}px)`;
    gameViewContainer.style.height = "100%";
    gameViewContainer.style.zIndex = "100";
    gameViewContainer.style.display = "block";

    // Force an immediate resize when entering game mode
    const mainGameCanvas = document.getElementById("main-game-canvas");
    if (gameViewContainer && mainGameCanvas) {
      const width = window.innerWidth - sidebarWidth || 1;
      const height = window.innerHeight || 1;
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
    viewLabel.textContent = "Game View";

    // Reset game view container styles
    gameViewContainer.style.position = "";
    gameViewContainer.style.top = "";
    gameViewContainer.style.left = "";
    gameViewContainer.style.width = "";
    gameViewContainer.style.height = "";
    gameViewContainer.style.zIndex = "";
    gameViewContainer.style.display = "none";

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
  const sidebar = document.querySelector(".sidebar");
  if (!mainGameCanvas || !sidebar) return;

  // Clean up existing observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  const sidebarWidth = sidebar.offsetWidth;

  // Set initial size to dimensions next to sidebar
  const width = window.innerWidth - sidebarWidth || 1;
  const height = window.innerHeight || 1;
  mainGameCanvas.width = width;
  mainGameCanvas.height = height;
  lastWidth = width;
  lastHeight = height;

  const handleResize = debounce(() => {
    if (!isGameViewActive) return;

    const sidebarWidth = sidebar.offsetWidth;
    const width = window.innerWidth - sidebarWidth || 1;
    const height = window.innerHeight || 1;

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

  // Observe window resize events
  window.addEventListener("resize", handleResize);
}

/**
 * Initialize game view
 */
function initGameView() {
  const viewToggleBtn = document.getElementById("view-toggle-btn");
  const mainGameCanvas = document.getElementById("main-game-canvas");
  const gameViewContainer = document.getElementById("game-view-container");

  // Hide game view container initially
  if (gameViewContainer) {
    gameViewContainer.style.display = "none";
  }

  if (viewToggleBtn && mainGameCanvas) {
    setupGameCanvasResize();
    viewToggleBtn.addEventListener("click", toggleGameView);
  }

  return {
    isGameViewActive: () => isGameViewActive,
    toggleGameView,
  };
}

export { initGameView, toggleGameView };

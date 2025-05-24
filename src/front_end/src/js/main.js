/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles bootstrapping and coordination between modules.
 */
import { initBlogPosts } from "./blog.js";
import { initNavigation } from "./navigation.js";
import { initPortfolioFilters } from "./portfolio-filters.js";

import { createDeltaTimeMetricsOverlay } from "./three/delta-time-metrics.js";
import {
  initGame,
  isGameView,
  updateGameLoop,
  updateIslandBobbing,
} from "./three/game.js";
import { preloadModels } from "./three/model.js";
import {
  initProjectCardScene,
  initProjectCards,
} from "./three/project-card-system.js";
import {
  hasActiveCamera,
  initThreeJSManager,
  renderFrame,
} from "./three/threejs-manager.js";
import { PerspectiveCamera } from "./extern/three/three.core.min.js";
import {
  getDeltaTime,
  startFrameCappedLoop,
  stopFrameCappedLoop,
} from "./three/time.js";
import { initUserInteraction, isIdle } from "./user-interaction.js";
import { isLowPoweredDevice } from "./utils/device.js";

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Main initialization function
 */
async function initializeApp() {
  initUserInteraction();
  initNavigation();
  initProjectCards();
  initPortfolioFilters();
  initBlogPosts();

  // initGridOverlay();
  // Only initialize the ThreeJS scenes and models if you don't have a doodoo computer
  if (isLowPoweredDevice()) {
    document.getElementById("view-toggle-btn").style.display = "none";
  } else {
    await preloadModels(["babyTurtle", "portfolioShip", "globe"]);
    await initThreeJSManager();
    initAboutCanvas();
    initProjectCardScene();

    await initGame();
    if (import.meta.env.DEV) {
      createDeltaTimeMetricsOverlay();
    }
    // Start the frame-capped main loop instead of calling mainLoop directly
    startFrameCappedLoop(frameUpdateCallback);
  }
}

function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const canvas = aboutSection.querySelector(".about-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;
  canvas.width = width;
  canvas.height = height;

  // Create and register camera
  const camera = new PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);

  registerCamera(camera, ctx);
  console.info("initialized about canvas and registered its camera! ");
}

/**
 * Frame update callback function - called by the frame capping system
 * @param {number} timestamp - The timestamp from requestAnimationFrame
 */
function frameUpdateCallback(timestamp) {
  if (isIdle() || !hasActiveCamera()) return;

  // Get the frame-capped deltaTime
  const deltaTime = getDeltaTime();

  if (isGameView()) {
    updateIslandBobbing(deltaTime);
    updateGameLoop(deltaTime);
  }
  // General engine operations for all registered physics bodies and cameras
  renderFrame();
}

function cleanup() {
  stopFrameCappedLoop();
}

window.addEventListener("beforeunload", cleanup);

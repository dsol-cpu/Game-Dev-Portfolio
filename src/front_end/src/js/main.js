/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles bootstrapping and coordination between modules.
 */
import { initBlogPosts } from "./blog.js";
import { initNavigation } from "./navigation.js";
import { initPortfolioFilters } from "./portfolio-filters.js";
import { initProjectCards, setupBackdropListener } from "./project-card.js";
import {
  initPortfolioCanvases,
  initProjectCardScene,
} from "./three/project-cards.js";
import { initThreeJSManager, renderFrame } from "./three/threejs-manager.js";
import { initUserInteraction } from "./user-interaction.js";
import { isLowPoweredDevice } from "./utils/device.js";
import { initGame, updateIslandBobbing, updateGameLoop } from "./three/game.js";
import { updateTime } from "./three/time-manager.js";
import { preloadModels } from "./three/model-manager.js";
import { createDeltaTimeMetricsOverlay } from "./three/delta-time-metrics.js";
// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initializeApp);
let deltaTime = 0;
/**
 * Main initialization function
 */
async function initializeApp() {
  // Init user interaction tracking
  initUserInteraction();

  // Initialize navigation
  initNavigation();

  initAboutCanvas();
  initProjectCards();

  // Only initialize the ThreeJS scenes and models if you don't have a doodoo computer
  if (isLowPoweredDevice()) {
    document.getElementById("view-toggle-btn").style.display = "none";
  } else {
    preloadModels(["babyTurtle", "portfolioShip"]);
    initThreeJSManager();
    initPortfolioCanvases();
    initProjectCardScene();
    initGame();
    if (import.meta.env.DEV) {
      createDeltaTimeMetricsOverlay();
    }
  }

  initPortfolioFilters();
  setupBackdropListener();
  initBlogPosts();

  mainLoop();
}

function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const canvas = aboutSection.querySelector(".about-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  // Set canvas dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;
  canvas.width = width;
  canvas.height = height;

  // Create and register camera
  const camera = new PerspectiveCamera(60, width / height, C.NEAR, C.FAR);
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);

  registerCamera(
    camera,
    null,
    ctx,
    {
      type: CAMERA_SECTIONS.ABOUT,
      elementId: aboutSection.id || CAMERA_SECTIONS.ABOUT,
      section: CAMERA_SECTIONS.ABOUT,
    },
    true
  );
  console.info(
    "initialized about canvas and registered its camera! ",
    getCamerasByCategory(CAMERA_SECTIONS.ABOUT)
  );
}

function mainLoop() {
  // Update deltaTime var instead of a const to avoid recreating variables
  deltaTime = updateTime();

  if (deltaTime !== null) {
    //Game scene rendering and logic
    updateIslandBobbing(deltaTime);
    updateGameLoop(deltaTime);

    //General engine operations for all registered physics bodies and cameras
    //TODO: physicsLoop(deltaTime); ???
    renderFrame(deltaTime);
  }
  //Singular recursive loop to request next frame
  requestAnimationFrame(mainLoop);
}

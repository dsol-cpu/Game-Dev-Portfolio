/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles bootstrapping and coordination between modules.
 */
import { createDeltaTimeMetricsOverlay } from "./three/delta-time-metrics.js";
import { initBlogPosts } from "./blog.js";
import { initNavigation } from "./navigation.js";
import { initPortfolioFilters } from "./portfolio-filters.js";
import { initProjectCards, setupBackdropListener } from "./project-card.js";
import {
  initPortfolioCanvases,
  initProjectCardScene,
} from "./three/project-cards.js";
import { initThreeJSManager } from "./three/threejs-manager.js";
import {
  initUserInteraction,
  isIdle,
  onIdleStateChange,
} from "./user-interaction.js";
import { isLowPoweredDevice } from "./utils/device.js";
import { initGame } from "./three/game.js";
import { TimeManager } from "./three/time-manager.js";

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Main initialization function
 */
function initializeApp() {
  // Set up TimeManager
  setupTimeManager();

  // Init user interaction tracking
  initUserInteraction();

  // Initialize navigation
  initNavigation();

  initProjectCards();
  // Only initialize the ThreeJS scenes and models if you don't have a doodoo computer
  if (!isLowPoweredDevice()) {
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
}

/**
 * Set up the TimeManager for the application
 * Integrates with user-interaction.js for idle tracking
 */
function setupTimeManager() {
  // Configure TimeManager with app-specific settings
  TimeManager.configure({
    fixedDeltaTime: 16.667, // ~60fps in ms
    maxDeltaTime: 33.33, // Cap at ~30 FPS equivalent
    idleThrottle: 250, // Throttle to 4fps when idle
    timeScale: 1.0, // Normal time scale
  });

  // Integrate with user-interaction.js
  TimeManager.setupUserInteractionIntegration(isIdle, onIdleStateChange);

  console.log("TimeManager initialized with user-interaction integration");
}

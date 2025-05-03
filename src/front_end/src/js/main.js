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
import { initThreeJSManager } from "./three/threejs-manager.js";
import { initUserInteraction } from "./user-interaction.js";
import { isLowPoweredDevice } from "./utils/device.js";
import { initGame } from "./three/game.js";

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Main initialization function
 */
function initializeApp() {
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
  }

  initPortfolioFilters();
  setupBackdropListener();
  initBlogPosts();
}

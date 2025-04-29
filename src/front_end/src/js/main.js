/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles bootstrapping and coordination between modules.
 * @author David Solinsky
 * @version 2.1.0
 */

import { initBlogPosts } from "./blog.js";
import { initProjectCards, setupBackdropListener } from "./project-card.js";
import { initThreeJS } from "./three/threejs-manager.js";
import { initNavigation } from "./navigation.js";
import { initPortfolioFilters } from "./portfolio-filters.js";
import { initGameView } from "./game-view.js";
import {
  initUserInteraction,
  handleUserInteraction,
} from "./user-interaction.js";
import { isElementInViewport, updateFPS } from "./utils/helper.js";
import { detectLowEndDevice } from "./utils/device.js";

// Export functions to window for cross-module access
// This approach allows modules to communicate without direct dependencies
window.handleUserInteraction = handleUserInteraction;
window.isElementInViewport = isElementInViewport;
window.updateFPS = updateFPS;

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
  if (!detectLowEndDevice()) initThreeJS();
  initPortfolioFilters();
  setupBackdropListener();

  // Delay less critical initializations
  requestIdleCallback(() => {
    initBlogPosts();
    initGameView();
  });
}

/**
 * @fileoverview Main JavaScript for portfolio site.
 * Handles bootstrapping and coordination between modules.

 */

import { initBlogPosts } from "./blog.js";
import { initProjectCards, setupBackdropListener } from "./project-card.js";
import { initNavigation } from "./navigation.js";
import { initPortfolioFilters } from "./portfolio-filters.js";
import { initGameView } from "./game-view.js";
import { initUserInteraction } from "./user-interaction.js";
import { detectLowEndDevice } from "./utils/device.js";

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
  if (!detectLowEndDevice()) {
    requestIdleCallback(() => {
      import("./three/threejs-manager.js").then(({ initThreeJS }) => {
        initThreeJS();
      });
    });
  }
  initPortfolioFilters();
  setupBackdropListener();

  // Delay less critical initializations
  requestIdleCallback(() => {
    initBlogPosts();
    initGameView();
  });
}

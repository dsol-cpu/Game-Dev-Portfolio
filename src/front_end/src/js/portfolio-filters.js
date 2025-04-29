/**
 * @fileoverview Handles portfolio item filtering
 */

import { isElementInViewport } from "./utils/helper";

let filterButtons;
let portfolioItems;

/**
 * Initialize portfolio filters with performance optimizations
 */
function initPortfolioFilters() {
  filterButtons = document.querySelectorAll(".filter-button");
  portfolioItems = document.querySelectorAll(".portfolio-item");

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const filter = this.getAttribute("data-filter");

      // Call the user interaction handler if available
      if (window.handleUserInteraction) {
        window.handleUserInteraction();
      }

      // Update active button
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      // Get visible indices based on filter
      const visibleIndices = [];
      portfolioItems.forEach((item, index) => {
        const categories = item.getAttribute("data-category");
        const match = filter === "all" || categories.includes(filter);

        // Update display only if necessary
        const currentDisplay = item.style.display;
        if (
          (match && currentDisplay === "none") ||
          (!match && currentDisplay !== "none")
        ) {
          item.style.display = match ? "block" : "none";
        }

        if (match) visibleIndices.push(index);
      });

      // Batch DOM updates
      requestAnimationFrame(() => {
        // Update active cameras with visible indices
        if (window.setActiveCamerasBySection) {
          window.setActiveCamerasBySection("portfolio", visibleIndices);
        }

        // Free memory for hidden models
        if (window.cleanupHiddenModels) {
          window.cleanupHiddenModels();
        }
      });
    });
  });

  return {
    getFilteredItems: () =>
      Array.from(portfolioItems).filter(
        (item) => item.style.display !== "none"
      ),
    getAllItems: () => portfolioItems,
  };
}

export { initPortfolioFilters };

// Constants
const ALL = "all",
  NONE = "none",
  BLOCK = "block";

const state = {
  buttons: null,
  items: null,
  filter: ALL,
  customFilter: null,
};

/**
 * Initialize portfolio filters
 * @returns {Object} API
 */
function initPortfolioFilters() {
  state.buttons = document.querySelectorAll(".filter-button");
  state.items = document.querySelectorAll(".project-card");

  state.buttons.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const expandedCard = document.querySelector(".project-card.expanded");
      if (expandedCard) {
        return;
      }

      const filter = btn.getAttribute("data-filter");
      if (filter === state.filter && !state.customFilter) return;

      window.handleUserInteraction?.();
      state.buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter(filter);
    })
  );

  // Monitor for card expansion/collapse to update button states
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class" &&
        mutation.target.classList.contains("project-card")
      ) {
        updateFilterButtonStates();
      }
    });
  });

  // Start observing card state changes
  state.items.forEach((item) => {
    observer.observe(item, { attributes: true, attributeFilter: ["class"] });
  });

  const init = window.location.hash.substring(1) || ALL;
  if (init !== ALL) {
    const btn = Array.from(state.buttons).find(
      (b) => b.getAttribute("data-filter") === init
    );
    if (btn) {
      btn.classList.add("active");
      applyFilter(init);
    }
  }

  // Initial button state check
  updateFilterButtonStates();

  return {
    getFilteredItems: () =>
      Array.from(state.items).filter((i) => i.style.display !== NONE),
    getAllItems: () => state.items,
    applyFilter,
    applyCustomFilter: (fn) => {
      state.customFilter = fn;
      applyFilter(state.filter);
    },
    resetCustomFilter: () => {
      state.customFilter = null;
      applyFilter(state.filter);
    },
    getActiveFilter: () => state.filter,
    updateFilterButtonStates, // Expose this function for manual updates if needed
  };
}

/**
 * Apply filter to portfolio items
 * @param {string} filter - Filter to apply
 */
function applyFilter(filter) {
  if (filter === state.filter && !state.customFilter) return;
  state.filter = filter;

  console.log(`Applying filter: ${filter}`);

  const visible = [],
    visibleIds = new Set(),
    hiddenIds = new Set();

  // Process all items to determine visibility
  state.items.forEach((item, i) => {
    const id = item.getAttribute("id") || `project-card-${i}`;
    let match =
      filter === ALL ||
      (item.getAttribute("data-category") || "").includes(filter);
    if (state.customFilter && match) match = state.customFilter(item);

    const newDisplay = match ? BLOCK : NONE;
    if (item.style.display !== newDisplay) {
      item.style.display = newDisplay;
    }

    if (match) {
      visible.push(item);
      visibleIds.add(id);
    } else {
      hiddenIds.add(id);
    }
  });

  // Update portfolio filter state
  window.portfolioFilterState = {
    visibleItems: visible,
    visibleItemIds: visibleIds,
    hiddenItemIds: hiddenIds,
  };
}

/**
 * Update filter button states based on expanded card status
 */
function updateFilterButtonStates() {
  const expandedCard = document.querySelector(".project-card.expanded");
  const isDisabled = !!expandedCard;

  state.buttons.forEach((btn) => {
    if (isDisabled) {
      btn.classList.add("disabled");
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.classList.remove("disabled");
      btn.style.opacity = "";
      btn.style.cursor = "";
    }
  });
}

export { initPortfolioFilters };

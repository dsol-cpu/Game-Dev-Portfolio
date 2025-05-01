import { isLowPoweredDevice } from "./utils/device.js";
import {
  initializeProjectCameras,
  updateCameras,
} from "./utils/camera-init.js";
import {
  getCamerasByElementId,
  enableCameras,
  disableCameras,
  getCamerasForElements,
  getCameraRegistry,
  countActiveCameras,
} from "./three/camera-registry.js";

// Constants & state
const ALL = "all",
  NONE = "none",
  BLOCK = "block";

const state = {
  buttons: null,
  items: null,
  filter: ALL,
  customFilter: null,
  lastFilteredCameras: new Set(), // Track previously filtered cameras
};

/**
 * Initialize portfolio filters
 * @returns {Object} API
 */
function initPortfolioFilters() {
  state.buttons = document.querySelectorAll(".filter-button");
  state.items = document.querySelectorAll(".portfolio-item");

  // Initialize lastFilteredCameras with all project cameras if this is the first run
  if (state.lastFilteredCameras.size === 0 && !isLowPoweredDevice()) {
    // If we're showing all cameras initially (ALL filter), pre-populate the set
    const visibleIds = new Set();
    state.items.forEach((item, i) => {
      const id = item.getAttribute("id") || `portfolio-item-${i}`;
      visibleIds.add(id);

      // Get all cameras for this element
      const cameras = getCamerasByElementId(id);
      cameras.forEach((cameraIndex) => {
        state.lastFilteredCameras.add(cameraIndex);
      });
    });

    console.log(
      `Initialized lastFilteredCameras with ${state.lastFilteredCameras.size} cameras`
    );
  }

  state.buttons.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const filter = btn.getAttribute("data-filter");
      if (filter === state.filter && !state.customFilter) return;

      window.handleUserInteraction?.();
      state.buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter(filter);
    })
  );

  const init = window.location.hash.substring(1) || ALL;
  if (init !== ALL) {
    const btn = Array.from(state.buttons).find(
      (b) => b.getAttribute("data-filter") === init
    );
    if (btn) {
      btn.classList.add("active");
      applyFilter(init);
    }
  } else if (!isLowPoweredDevice()) {
    initializeProjectCameras();
  }

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
    getCameraStatus: () => ({
      totalCameras: getCameraRegistry().count,
      activeCameras: countActiveCameras(),
    }),
  };
}

/**
 * Apply filter and update cameras
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
    const id = item.getAttribute("id") || `portfolio-item-${i}`;
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
    needsCameraUpdate: true,
  };

  // Update camera visibility based on portfolio item visibility
  updateCamerasForFilter(visibleIds, hiddenIds);

  // Additional cleanup actions
  window.cleanupHiddenModels?.();
  updateCameras(filter, state.items);
}

/**
 * Update camera visibility based on visible and hidden portfolio items
 * @param {Set<string>} visibleIds - Set of visible portfolio item IDs
 * @param {Set<string>} hiddenIds - Set of hidden portfolio item IDs
 */
function updateCamerasForFilter(visibleIds, hiddenIds) {
  const startTime = performance.now();

  const allPortfolioElementIds = new Set([...visibleIds, ...hiddenIds]);
  const portfolioCameras = new Set(); // All cameras related to this portfolio section

  state.items.forEach((item, i) => {
    const id = item.getAttribute("id") || `portfolio-item-${i}`;
    if (allPortfolioElementIds.has(id)) {
      const cameras = getCamerasByElementId(id);
      cameras.forEach((cameraIndex) => portfolioCameras.add(cameraIndex));
    }
  });

  const camerasToEnable = getCamerasForElements(visibleIds);

  console.log(`Portfolio section has ${portfolioCameras.size} total cameras`);
  console.log(`Cameras to enable in current filter: ${camerasToEnable.size}`);

  const camerasToDisable = new Set();
  portfolioCameras.forEach((cameraIndex) => {
    if (!camerasToEnable.has(cameraIndex)) {
      camerasToDisable.add(cameraIndex);
    }
  });

  console.log(`Cameras to disable: ${camerasToDisable.size}`);

  if (camerasToDisable.size > 0) {
    const disabledCount = disableCameras(camerasToDisable);
    console.log(`Disabled ${disabledCount} cameras`);
  }

  if (camerasToEnable.size > 0) {
    const enabledCount = enableCameras(camerasToEnable);
    console.log(`Enabled ${enabledCount} cameras`);
  }

  // Update tracking state
  state.lastFilteredCameras = new Set([...camerasToEnable]);

  console.log(`After updates - Active cameras: ${countActiveCameras()}`);

  const endTime = performance.now();
  console.log(
    `Camera update completed in ${(endTime - startTime).toFixed(2)}ms`
  );
}

/**
 * Improved refreshAllCameras that is scoped to just portfolio items
 */
function refreshAllCameras() {
  const visibleIds = new Set();
  const hiddenIds = new Set();

  state.items.forEach((item, i) => {
    const id = item.getAttribute("id") || `portfolio-item-${i}`;
    if (item.style.display !== NONE) {
      visibleIds.add(id);
    } else {
      hiddenIds.add(id);
    }
  });

  // Use the scoped camera update function
  updateCamerasForFilter(visibleIds, hiddenIds);
}

export { initPortfolioFilters, refreshAllCameras };

/**
 * @fileoverview Project card scene and canvas management
 * Optimized ThreeJS implementation leveraging threejs-manager
 */

import { C } from "../constants/constants.js";
import { OrbitControls } from "../extern/three/OrbitControls.js";
import { PerspectiveCamera } from "../extern/three/three.module.min.js";
import { handleUserInteraction } from "../user-interaction.js";
import { isElementInViewport } from "../utils/helper.js";
import {
  calculateModelPositions,
  FALLBACK_CUBE_NAME,
  getFallbackCube,
  getModel,
  getModelPosition,
} from "./model-manager.js";
import {
  orbitControlsConfig,
  patchOrbitControls,
} from "./orbit-controls-helper.js";
import { forceRedraw, getScene, registerCamera } from "./threejs-manager.js";

// Scene reference
let scene = null;

/**
 * Initialize project card scene
 */
export function initProjectCardScene() {
  // Initialize the optimized ThreeJS manager
  scene = getScene();

  // Calculate model positions
  const modelNames = Array.from(document.querySelectorAll(".portfolio-item"))
    .map((item) => item.getAttribute("data-model"))
    .filter(Boolean);

  calculateModelPositions(modelNames);
}

/**
 * Initialize portfolio canvases
 */
export function initPortfolioCanvases() {
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  if (portfolioItems.length) setupProjectCameras(portfolioItems);
}

/**
 * Setup project cameras for portfolio items
 * Leverages the threejs-manager's intersection observer
 */
export function setupProjectCameras(portfolioItems) {
  if (!portfolioItems.length) return;

  // Setup priority items first
  const setupPromises = [];
  const maxVisible = C.VISIBLE_PRIORITY_COUNT;
  let visibleCount = 0;

  portfolioItems.forEach((item, index) => {
    // Set index for camera angle calculation
    item.dataset.index = index;

    // Setup priority items immediately
    const isPriority = isElementInViewport(item) && visibleCount < maxVisible;

    if (isPriority) {
      setupPromises.push(
        setupProjectCamera(item).then((cameraIndex) => {
          if (cameraIndex !== null) {
            item.dataset.cameraIndex = cameraIndex;
            // No need to manually set camera visible - intersection observer will handle this
          }
          return cameraIndex;
        })
      );
      visibleCount++;
    } else {
      // Setup intersection observer for non-priority items
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;

          if (entry.isIntersecting && !item.dataset.cameraIndex) {
            setupProjectCamera(item).then((cameraIndex) => {
              if (cameraIndex !== null) {
                item.dataset.cameraIndex = cameraIndex;
                // Camera visibility will be handled by threejs-manager's observer
                handleUserInteraction();
              }
              observer.disconnect(); // Only need to observe until camera is created
            });
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(item);

      // Handle click events for immediate setup
      item.addEventListener(
        "click",
        () => {
          if (!item.dataset.cameraIndex) {
            setupProjectCamera(item).then((cameraIndex) => {
              if (cameraIndex !== null) {
                item.dataset.cameraIndex = cameraIndex;
                // Force redraw on click for immediate feedback
                forceRedraw(cameraIndex);
                handleUserInteraction();
              }
            });
          } else {
            // Camera already exists, just force a redraw
            const cameraIndex = parseInt(item.dataset.cameraIndex);
            if (!isNaN(cameraIndex)) {
              forceRedraw(cameraIndex);
              handleUserInteraction();
            }
          }
        },
        { passive: true }
      );
    }
  });

  Promise.all(setupPromises).catch((err) =>
    console.warn("Priority camera setup error:", err)
  );
}

/**
 * Ensure model is loaded and added to scene
 */
export async function ensureModelInScene(modelName) {
  if (!modelName) return getFallbackCube();

  try {
    const model = await getModel(modelName);

    if (!model.parent) scene.add(model);

    const position = getModelPosition(modelName);
    model.position.set(position.x, position.y + 0.1, position.z);
    model.visible = true;

    if (model.scale.x < 0.5 || model.scale.x > 2) {
      model.scale.set(1, 1, 1);
    }

    // Optimize matrix updates
    model.updateMatrix();
    model.updateMatrixWorld(true);
    model.matrixAutoUpdate = false; // Static models don't need updates

    return model;
  } catch (error) {
    console.error(`Failed to add model ${modelName}`, error);
    const fallback = getFallbackCube();
    if (!fallback.parent) scene.add(fallback);
    return fallback;
  }
}

/**
 * Set up camera and controls for a project card
 */
export async function setupProjectCamera(item) {
  if (!item) return null;

  // Get canvas element
  const canvas = item.querySelector(".threejs-canvas");
  if (!canvas || canvas._processed) return null;

  // Mark as processed
  canvas._processed = true;

  // Get context
  let ctx;
  try {
    ctx = canvas.getContext("2d", { alpha: true });
  } catch (error) {
    console.error("Canvas context error:", error);
    return null;
  }

  if (!ctx) return null;

  // Set GPU acceleration hint
  canvas.style.transform = "translateZ(0)";
  canvas.style.willChange = "transform"; // Signal GPU compositing

  // Set dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;

  canvas.width = width;
  canvas.height = height;

  // Get model
  const modelName = item.getAttribute("data-model") || FALLBACK_CUBE_NAME;
  const model = await ensureModelInScene(modelName);
  const target = model.position.clone();

  // Create camera
  const camera = new PerspectiveCamera(
    C.DEFAULT_FOV,
    width / height,
    C.NEAR,
    C.FAR
  );

  // Determine camera position based on item's data attributes or a calculated angle
  const index = parseInt(item.dataset.index || "0");
  const angle = (index % 8) * (Math.PI / 4);
  const cameraDistance = C.CAMERA_DISTANCE;

  camera.position.set(
    target.x + Math.sin(angle) * cameraDistance,
    target.y + 1.0,
    target.z + Math.cos(angle) * cameraDistance
  );
  camera.lookAt(target);

  // Create controls
  let controls = null;

  try {
    patchOrbitControls();
    controls = new OrbitControls(camera, canvas);
    Object.assign(controls, orbitControlsConfig);
    controls.target.copy(target);

    const usePassive = { passive: true };

    controls.addEventListener(
      "start",
      () => {
        canvas.style.cursor = "grabbing";
        handleUserInteraction();
      },
      usePassive
    );

    controls.addEventListener(
      "end",
      () => {
        canvas.style.cursor = "grab";
      },
      usePassive
    );

    controls.update();
  } catch (e) {
    console.warn("OrbitControls init failed:", e);
  }

  try {
    // Register with threejs-manager, which will handle visibility and rendering
    const metadata = { modelName, itemId: item.id };
    // Pass true to mark as initially active
    const cameraIndex = registerCamera(camera, controls, ctx, metadata, true);
    canvas._cameraIndex = cameraIndex;

    // Store reference to original parent item for isolation
    if (camera) {
      camera.userData = camera.userData || {};
      camera.userData.parentElement = item;
    }

    // Add event listeners to handle details expansion
    const detailsButton = item.querySelector(
      '.details-button, .show-details, [data-action="show-details"]'
    );
    if (detailsButton) {
      detailsButton.addEventListener(
        "click",
        () => {
          // Force redraw of only this camera
          forceRedraw(cameraIndex);
          handleUserInteraction();
        },
        { passive: true }
      );
    }

    // Return camera index for reference
    return cameraIndex;
  } catch (e) {
    console.error("Camera registration error:", e);
    return null;
  }
}

/**
 * Get models from visible project cards - utility for prefetching
 */
export function getVisibleProjectModels() {
  const visibleModels = [];
  const portfolioItems = document.querySelectorAll(".portfolio-item");

  // Add models visible in viewport
  portfolioItems.forEach((item) => {
    if (isElementInViewport(item)) {
      const modelName = item.getAttribute("data-model");
      if (modelName && !visibleModels.includes(modelName)) {
        visibleModels.push(modelName);
      }
    }
  });

  // Add priority models
  for (
    let i = 0;
    i < Math.min(C.VISIBLE_PRIORITY_COUNT, portfolioItems.length);
    i++
  ) {
    const modelName = portfolioItems[i]?.getAttribute("data-model");
    if (modelName && !visibleModels.includes(modelName)) {
      visibleModels.push(modelName);
    }
  }

  return visibleModels;
}

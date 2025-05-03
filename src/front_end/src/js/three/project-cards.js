/**
 * @fileoverview Project card scene and canvas management
 * Optimized ThreeJS implementation
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
  markModelUnused,
} from "./model-manager.js";
import {
  orbitControlsConfig,
  patchOrbitControls,
} from "./orbit-controls-helper.js";
import {
  setCameraVisible,
  getScene,
  registerCamera,
} from "./threejs-manager.js";

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
 * Get models from visible project cards
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

/**
 * Initialize portfolio canvases
 */
export function initPortfolioCanvases() {
  const portfolioItems = document.querySelectorAll(".portfolio-item");
  if (portfolioItems.length) setupVisibleProjectCameras(portfolioItems);
}

/**
 * Setup visible project cameras with intersection observer
 */
export function setupVisibleProjectCameras(portfolioItems) {
  if (!portfolioItems.length) return;

  // Create intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = entry.target;
        const cameraIndex = parseInt(item.dataset.cameraIndex);

        if (entry.isIntersecting) {
          // Item is visible
          if (!isNaN(cameraIndex)) {
            // Camera exists, enable it
            setCameraVisible(cameraIndex, true);
            handleUserInteraction();
          } else {
            // Create camera directly - no need for idle scheduling
            setupProjectCamera(item).then((newCameraIndex) => {
              if (newCameraIndex !== null) {
                item.dataset.cameraIndex = newCameraIndex;
                setCameraVisible(newCameraIndex, true);
                handleUserInteraction();
              }
            });
          }
        } else {
          // Item not visible, disable camera
          if (!isNaN(cameraIndex)) {
            setCameraVisible(cameraIndex, false);
          }

          // Mark model as unused
          const modelName = item.getAttribute("data-model");
          if (modelName) {
            markModelUnused(modelName);
          }
        }
      });
    },
    {
      threshold: C.INTERSECTION_THRESHOLD,
      rootMargin: C.INTERSECTION_MARGIN,
    }
  );

  // Setup priority items first
  let visibleCount = 0;
  const setupPromises = [];
  const maxVisible = C.VISIBLE_PRIORITY_COUNT;

  portfolioItems.forEach((item) => {
    if (isElementInViewport(item) && visibleCount < maxVisible) {
      setupPromises.push(
        setupProjectCamera(item).then((cameraIndex) => {
          if (cameraIndex !== null) {
            item.dataset.cameraIndex = cameraIndex;
            setCameraVisible(cameraIndex, true);
          }
          return cameraIndex;
        })
      );
      visibleCount++;
    }
    observer.observe(item);
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

  // Create camera directly - no initProjectCameras dependency
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
    // Register camera directly with threejs-manager
    const cameraIndex = registerCamera(camera, controls, ctx, true);
    canvas._cameraIndex = cameraIndex;
    return cameraIndex;
  } catch (e) {
    console.error("Camera registration error:", e);
    return null;
  }
}

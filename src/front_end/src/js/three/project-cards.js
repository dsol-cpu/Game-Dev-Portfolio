/**
 * @fileoverview Project card scene and canvas management
 */

import { Scene, PerspectiveCamera } from "../extern/three/three.module.min.js";
import { OrbitControls } from "../extern/three/OrbitControls.js";
import {
  getClonedLight,
  sharedCanvasContextOptions,
  getRenderer,
} from "./renderer-core.js";
import {
  registerCamera,
  enableCamera,
  disableCamera,
  getCamerasBySection,
  getCameraRegistry,
  createSimpleAutorotation,
} from "./camera-registry.js";
import {
  getFallbackCube,
  getModel,
  markModelUnused,
  calculateModelPositions,
  getModelPosition,
  FALLBACK_CUBE_NAME,
} from "./model-manager.js";
import { CAMERA_SECTIONS } from "../data/sections.js";
import { isElementInViewport } from "../utils/helper.js";
import {
  patchOrbitControls,
  orbitControlsConfig,
} from "./orbit-controls-helper.js";
import { handleUserInteraction } from "../user-interaction.js";
import { C } from "../constants/constants.js";
import { initProjectCameras } from "../utils/camera-init.js";
// Scene for project cards
let projectCardScene = null;

/**
 * Initialize project card scene
 */
export function initProjectCardScene() {
  initProjectCameras();
  projectCardScene = new Scene();

  // Add lights with custom intensities
  projectCardScene.add(getClonedLight("ambientLight", { intensity: 0.8 }));
  projectCardScene.add(getClonedLight("directionalLight1", { intensity: 0.6 }));
  projectCardScene.add(getClonedLight("directionalLight2"));
  projectCardScene.add(getFallbackCube());

  // Calculate model positions
  const modelNames = Array.from(document.querySelectorAll(".portfolio-item"))
    .map((item) => item.getAttribute("data-model"))
    .filter(Boolean);

  calculateModelPositions(modelNames);

  return projectCardScene;
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

  // Schedule work when browser is idle
  const scheduleIdleWork = (callback) =>
    "requestIdleCallback" in window
      ? requestIdleCallback(callback)
      : setTimeout(callback, 1);

  // Create intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const item = entry.target;
        const cameraIndex = parseInt(item.dataset.cameraIndex);
        const index = Array.from(portfolioItems).indexOf(item);
        const sectionId =
          item.closest("section")?.id || CAMERA_SECTIONS.PROJECT;

        if (entry.isIntersecting) {
          // Item is visible
          if (!isNaN(cameraIndex)) {
            // Camera exists, enable it
            enableCamera(cameraIndex);
            handleUserInteraction();
          } else {
            // Check for existing cameras in section
            const existingCameras = getCamerasBySection(sectionId);
            const hasExistingCamera = existingCameras.some((camIndex) => {
              const registry = getCameraRegistry();
              return registry.cameraData[camIndex]?.index === index;
            });

            if (!hasExistingCamera) {
              // Create new camera when idle
              scheduleIdleWork(() => {
                setupProjectCamera(item, index).then((newCameraIndex) => {
                  if (newCameraIndex !== null) {
                    item.dataset.cameraIndex = newCameraIndex;
                    enableCamera(newCameraIndex);
                    handleUserInteraction();
                  }
                });
              });
            }
          }
        } else {
          // Item not visible, disable camera
          if (!isNaN(cameraIndex)) {
            disableCamera(cameraIndex);
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

  portfolioItems.forEach((item, index) => {
    if (isElementInViewport(item) && visibleCount < maxVisible) {
      setupPromises.push(
        setupProjectCamera(item, index).then((cameraIndex) => {
          if (cameraIndex !== null) {
            item.dataset.cameraIndex = cameraIndex;
            enableCamera(cameraIndex);
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
export async function ensureModelInScene(modelName, scene) {
  if (!modelName || !scene) return getFallbackCube();

  try {
    const model = await getModel(modelName);

    if (!model.parent) scene.add(model);

    const position = getModelPosition(modelName);
    model.position.set(position.x, position.y + 0.1, position.z);
    model.visible = true;

    if (model.scale.x < 0.5 || model.scale.x > 2) {
      model.scale.set(1, 1, 1);
    }

    model.updateMatrix();
    model.updateMatrixWorld(true);

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
export async function setupProjectCamera(item, index) {
  if (!item) return null;

  // Get canvas element
  const canvas = item.querySelector(".threejs-canvas");
  if (!canvas || canvas._processed) return null;

  // Mark as processed
  canvas._processed = true;

  // Get context (attempt offscreen if available)
  let ctx,
    offscreenCanvas = null;

  try {
    if (!("transferControlToOffscreen" in canvas))
      ctx = canvas.getContext("2d", sharedCanvasContextOptions);
    try {
      offscreenCanvas = canvas.transferControlToOffscreen();
      ctx = offscreenCanvas.getContext("2d", sharedCanvasContextOptions);
      canvas._offscreenTransferred = true;
      canvas._offscreen = offscreenCanvas;
    } catch {
      ctx = canvas.getContext("2d", sharedCanvasContextOptions);
    }
  } catch {
    // Fallback
    try {
      ctx = canvas.getContext("2d", { alpha: true });
    } catch (error) {
      console.error("Canvas context error:", error);
      return null;
    }
  }

  if (!ctx) return null;

  // Set GPU acceleration hint
  canvas.style.transform = "translateZ(0)";

  // Set dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;

  if (offscreenCanvas) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  } else if (!canvas._offscreenTransferred) {
    canvas.width = width;
    canvas.height = height;
  }

  // Get model
  const modelName = item.getAttribute("data-model") || FALLBACK_CUBE_NAME;
  const model = await ensureModelInScene(modelName, projectCardScene);
  const target = model.position.clone();

  // Create camera
  const camera = new PerspectiveCamera(
    C.DEFAULT_FOV,
    width / height,
    C.NEAR,
    C.FAR
  );
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
    const safeAddEvent = (type, handler) => {
      controls.addEventListener(type, handler, usePassive);
    };

    safeAddEvent("start", () => {
      canvas.style.cursor = "grabbing";
      handleUserInteraction();
    });

    safeAddEvent("end", () => {
      canvas.style.cursor = "grab";
    });

    controls.update();
  } catch {
    controls = createSimpleAutorotation(camera, target, cameraDistance, index);
  }

  // Get section details
  const sectionId = item.closest("section")?.id || CAMERA_SECTIONS.PROJECT;
  const elementId = item.id || `portfolio-item-${index}`;
  const isVisible = isElementInViewport(item);

  // Register camera
  try {
    const cameraIndex = registerCamera(
      camera,
      controls,
      ctx,
      {
        type: CAMERA_SECTIONS.PROJECT,
        section: sectionId,
        modelName,
        elementId,
        index,
        visible: isVisible,
      },
      isVisible
    );

    // Initial render if visible
    const renderer = getRenderer();
    if (renderer && isVisible) {
      renderer.setSize(width, height, false);
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.scissorTest = true;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.clear();
      renderer.render(projectCardScene, camera);

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        renderer.domElement,
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
        0,
        0,
        width,
        height
      );
    }

    return cameraIndex;
  } catch (e) {
    console.error("Camera registration error:", e);
    return null;
  }
}

export function getProjectCardScene() {
  return projectCardScene;
}

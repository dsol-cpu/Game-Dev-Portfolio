/**
 * @fileoverview Global camera registry with bitmask-based activation.
 * @version 2.0.0
 */

import {
  createBitArray,
  enableAllBits,
  isBitSet,
  setBit,
  clearBit,
} from "../utils/bit-array.js";

import { isIdle } from "../user-interaction.js";

import { Vector3 } from "../extern/three/three.core.min.js";

// Pre-allocated empty arrays for type consistency
const EMPTY_ARRAY = Object.freeze([]);

// Global camera registry with a single bitmask
const cameraRegistry = {
  cameras: EMPTY_ARRAY,
  controls: EMPTY_ARRAY,
  contexts: EMPTY_ARRAY,
  activeCamBitmask: null,
  cameraData: EMPTY_ARRAY,
  count: 0,
  maxCameras: 0,
};

/**
 * Initialize the camera registry
 * @param {number} maxCameras - Maximum number of cameras to support
 */
export function initCameraRegistry(maxCameras) {
  if (maxCameras <= 0) {
    throw new Error("maxCameras must be a positive number");
  }

  cameraRegistry.cameras = new Array(maxCameras);
  cameraRegistry.controls = new Array(maxCameras);
  cameraRegistry.contexts = new Array(maxCameras);
  cameraRegistry.cameraData = new Array(maxCameras);
  cameraRegistry.activeCamBitmask = createBitArray(maxCameras);
  cameraRegistry.count = 0;
  cameraRegistry.maxCameras = maxCameras;

  enableAllBits(cameraRegistry.activeCamBitmask);
}

/**
 * Register a new camera
 * @param {Object} camera - The camera object
 * @param {Object} controls - The controls object
 * @param {CanvasRenderingContext2D} context - Canvas rendering context
 * @param {Object} metadata - Additional data about the camera (section, etc.)
 * @param {boolean} active - Whether this camera should be active initially
 * @returns {number} Camera index
 */
export function registerCamera(
  camera,
  controls,
  context,
  metadata = {},
  active = true
) {
  if (cameraRegistry.count >= cameraRegistry.maxCameras) {
    throw new Error(`Camera registry full (max: ${cameraRegistry.maxCameras})`);
  }

  const index = cameraRegistry.count++;

  cameraRegistry.cameras[index] = camera;
  cameraRegistry.controls[index] = controls;
  cameraRegistry.contexts[index] = context;
  cameraRegistry.cameraData[index] = {
    section: metadata.section || "unknown",
    modelName: metadata.modelName || null,
    elementId: metadata.elementId || null,
    ...(metadata.hasOwnProperty("section") ? {} : metadata),
  };

  if (active) {
    setBit(cameraRegistry.activeCamBitmask, index);
  } else {
    clearBit(cameraRegistry.activeCamBitmask, index);
  }

  return index;
}

/**
 * Set specific cameras as active
 * @param {number[]} indices - Camera indices to activate
 */
export function setActiveCameras(indices) {
  if (!cameraRegistry.activeCamBitmask) return;

  const maskLength = cameraRegistry.activeCamBitmask.length;
  const newMask = createBitArray(maskLength);

  if (indices?.length) {
    indices.forEach((index) => {
      if (index >= 0 && index < cameraRegistry.maxCameras) {
        setBit(newMask, index);
      }
    });
  }

  cameraRegistry.activeCamBitmask = newMask;
}

/**
 * Add indices to active cameras without clearing others
 * @param {number[]} indices - Camera indices to activate
 */
export function addActiveCameras(indices) {
  if (!indices || indices.length === 0 || !cameraRegistry.activeCamBitmask) {
    return;
  }

  indices.forEach((index) => {
    if (index >= 0 && index < cameraRegistry.maxCameras) {
      setBit(cameraRegistry.activeCamBitmask, index);
    }
  });
}

/**
 * Remove indices from active cameras
 * @param {number[]} indices - Camera indices to deactivate
 */
export function removeActiveCameras(indices) {
  if (!indices || indices.length === 0 || !cameraRegistry.activeCamBitmask) {
    return;
  }

  indices.forEach((index) => {
    if (index >= 0 && index < cameraRegistry.maxCameras) {
      clearBit(cameraRegistry.activeCamBitmask, index);
    }
  });
}

export function createSimpleAutorotation(
  camera,
  targetPosition,
  cameraDistance,
  index
) {
  if (!camera || !targetPosition) {
    console.error("Invalid camera or target in createSimpleAutorotation");
    return {
      update: () => {},
      dispose: () => {},
    };
  }

  // Adjusted rotation speed to be more visible
  const rotationSpeed = 0.003 + (index % 5) * 0.001;
  let lastUpdate = 0;

  // Store the initial target position
  const target = new Vector3(
    targetPosition.x || 0,
    targetPosition.y || 0,
    targetPosition.z || 0
  );

  return {
    autoRotate: true,
    update: (timestamp) => {
      if (!camera) return;

      timestamp = timestamp || performance.now();

      // Skip updates during idle periods (less frequent)
      if (isIdle() && timestamp - lastUpdate < 100) return;
      lastUpdate = timestamp;

      const currentAngle = Math.atan2(
        camera.position.x - target.x,
        camera.position.z - target.z
      );
      const newAngle = currentAngle + rotationSpeed;

      camera.position.x = target.x + Math.sin(newAngle) * cameraDistance;
      camera.position.z = target.z + Math.cos(newAngle) * cameraDistance;
      camera.lookAt(target.x, target.y, target.z);

      // Force matrix update
      camera.updateMatrixWorld(true);
    },
    target: target,
    dispose: () => {
      // Clean up function
    },
  };
}

/**
 * Get camera indices by section
 * @param {string} section - Section name to filter by
 * @returns {number[]} Camera indices belonging to this section
 */
export function getCamerasBySection(section) {
  if (cameraRegistry.count === 0 || !section) return [];

  const indices = [];
  const cameraData = cameraRegistry.cameraData;

  for (let i = 0; i < cameraRegistry.count; i++) {
    const data = cameraData[i];
    if (data && data.section === section) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * Set active cameras by section
 * @param {string} section - Section to activate
 */
export function setActiveCamerasBySection(section) {
  setActiveCameras(getCamerasBySection(section));
}

/**
 * Update all active controls
 */
export function updateActiveControls(timestamp) {
  if (!cameraRegistry.activeCamBitmask) return;

  // First update any controls that are currently being dragged
  let foundActiveDrag = false;
  for (let i = 0; i < cameraRegistry.count; i++) {
    const control = cameraRegistry.controls[i];
    if (control?._dragging && isBitSet(cameraRegistry.activeCamBitmask, i)) {
      control.update();
      foundActiveDrag = true;
    }
  }

  // In idle mode, only update auto-rotating controls at a lower rate
  const updateNonDragging = !isIdle() || timestamp % 3 === 0; // Every 3rd frame in idle

  if (!updateNonDragging) return;

  // Then update the rest
  for (let i = 0; i < cameraRegistry.count; i++) {
    const control = cameraRegistry.controls[i];
    if (
      control &&
      !control._dragging &&
      isBitSet(cameraRegistry.activeCamBitmask, i)
    ) {
      // Update less frequently if we already found an active drag
      if (!foundActiveDrag || control.autoRotate) {
        control.update();
      }
    }
  }
}

/**
 * Set all cameras as active
 */
export function activateAllCameras() {
  if (!cameraRegistry.activeCamBitmask) return;

  // Enable all bits in the bitmask
  enableAllBits(cameraRegistry.activeCamBitmask);
  console.log("Activated all cameras");
}

/**
 * Optimized rendering of active cameras
 * @param {WebGLRenderer} renderer - Three.js renderer
 * @param {Scene} scene - The scene to render
 */
export function renderActiveCameras(renderer, scene) {
  if (!renderer || !scene || !cameraRegistry.activeCamBitmask) return;

  const domElement = renderer.domElement;
  const { cameras, contexts, controls, activeCamBitmask } = cameraRegistry;

  // Sort cameras to prioritize the actively dragged one first
  const activeCameras = [];
  for (let i = 0; i < cameraRegistry.count; i++) {
    if (isBitSet(activeCamBitmask, i)) {
      const control = cameraRegistry.controls[i];
      const priority = control?._dragging ? 1 : 0;
      activeCameras.push({ index: i, priority });
    }
  }

  // Sort by priority (dragging cameras first)
  activeCameras.sort((a, b) => b.priority - a.priority);

  // Setup renderer once
  const originalScissorTest = renderer.scissorTest;
  renderer.scissorTest = true;

  // Process cameras in priority order
  for (const { index } of activeCameras) {
    const camera = cameras[index];
    const ctx = contexts[index];
    const control = controls[index];

    if (!camera || !ctx?.canvas) continue;

    try {
      // Get width and height from the appropriate canvas
      const canvas = ctx.canvas;
      const width = canvas.width || 300;
      const height = canvas.height || 200;

      if (width <= 0 || height <= 0) continue;

      // Update camera aspect ratio if needed
      if (camera.isPerspectiveCamera && camera.aspect !== width / height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      // Resize only when needed
      renderer.setSize(width, height, false);

      // Set viewport and scissor to match canvas dimensions
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);

      // Clear the canvas before rendering
      renderer.clear();

      // Ensure controls are up to date
      if (control && typeof control.update === "function") {
        control.update();
      }

      // Render to this camera's canvas
      renderer.render(scene, camera);

      // Draw to 2D context with proper dimensions
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        domElement,
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
        0,
        0,
        width,
        height
      );
    } catch (error) {
      console.error(`Error rendering camera ${index}:`, error);
      // Don't disable the camera on error, just log it
    }
  }

  // Restore renderer state
  renderer.scissorTest = originalScissorTest;
}

/**
 * Get the registry state
 * @returns {Object} The camera registry object
 */
export function getCameraRegistry() {
  return cameraRegistry;
}

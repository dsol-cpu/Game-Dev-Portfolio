/**
 * @fileoverview Optimized global camera registry with 32-bit bitmask-based activation.
 */

import {
  createBitArray,
  enableAllBits,
  isBitSet,
  enableBit,
  disableBit,
} from "../utils/bit-array.js";
import { isIdle } from "../user-interaction.js";
import { Vector3 } from "../extern/three/three.core.min.js";
import { CAMERA_SECTIONS } from "../data/sections.js";

// Configuration constants
const MAX_CAMERAS = 32;
const DEFAULT_ROTATION_SPEED = 0.003;
const ROTATION_SPEED_VARIANCE = 0.001;
const IDLE_UPDATE_MODULO = 3;
const MIN_UPDATE_INTERVAL = 100;
const DEFAULT_CAMERA_TYPE = CAMERA_SECTIONS.PROJECT;
const HIGH_PRIORITY = 1;
const NORMAL_PRIORITY = 0;
const MAX_ROTATION_INDEX = 5;

// Global registry - single instance for performance
const registry = {
  cameras: Array(MAX_CAMERAS).fill(null),
  controls: Array(MAX_CAMERAS).fill(null),
  contexts: Array(MAX_CAMERAS).fill(null),
  data: Array(MAX_CAMERAS).fill(null),
  mask: null,
  count: 0,
};

/**
 * Initialize the camera registry
 */
export function initCameraRegistry() {
  registry.count = 0;
  registry.mask = createBitArray(MAX_CAMERAS);
  enableAllBits(registry.mask);
}

/**
 * Register a new camera
 */
export function registerCamera(
  camera,
  controls,
  context,
  metadata = {},
  active = true
) {
  if (registry.count >= MAX_CAMERAS) {
    throw new Error(`Camera registry full (max: ${MAX_CAMERAS})`);
  }

  const index = registry.count++;
  registry.cameras[index] = camera;
  registry.controls[index] = controls;
  registry.contexts[index] = context;

  // Simplified data object
  registry.data[index] = {
    type: metadata.type || DEFAULT_CAMERA_TYPE,
    elementId: metadata.elementId || null,
    modelName: metadata.modelName || null,
    ...(metadata.type ? {} : metadata),
  };

  // Set activity state
  if (!active) disableBit(registry.mask, index);

  return index;
}

/**
 * Find camera indices matching a predicate function
 */
function getCamerasByPredicate(predicate) {
  if (registry.count === 0) return [];

  const indices = [];
  for (let i = 0; i < registry.count; i++) {
    if (predicate(registry.data[i])) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Get camera indices by data property value
 * @param {string} property - Property name to match (type, elementId, etc.)
 * @param {any} value - Value to match
 * @returns {number[]} - Array of matching camera indices
 */
export function getCamerasByProperty(property, value) {
  if (!property || value === undefined) return [];
  return getCamerasByPredicate((data) => data?.[property] === value);
}

/**
 * Get camera indices by type (using the generic property function)
 */
export function getCamerasByType(type) {
  return getCamerasByProperty("type", type);
}

/**
 * Get camera indices by element ID (using the generic property function)
 */
export function getCamerasByElementId(elementId) {
  return getCamerasByProperty("elementId", elementId);
}

/**
 * Get camera indices by section ID (alias for element ID)
 */
export function getCamerasBySection(sectionId) {
  return getCamerasByElementId(sectionId);
}

/**
 * Get cameras by data category
 */
export function getCamerasByCategory(category) {
  if (!category || registry.count === 0) return [];

  return getCamerasByPredicate((data) => data?.categories?.includes(category));
}

/**
 * Set specific cameras as active
 */
export function setActiveCameras(indices) {
  if (!registry.mask || !indices?.length) return;

  const newMask = createBitArray(MAX_CAMERAS);

  for (const index of indices) {
    if (index >= 0 && index < MAX_CAMERAS) {
      enableBit(newMask, index);
    }
  }

  registry.mask = newMask;
}

/**
 * Set active cameras by property value
 */
export function setActiveCamerasByProperty(property, value) {
  setActiveCameras(getCamerasByProperty(property, value));
}

/**
 * Set active cameras by type
 */
export function setActiveCamerasByType(type) {
  setActiveCamerasByProperty("type", type);
}

/**
 * Modify camera activation state in batch
 * @param {Set<number>|Array<number>} indices - Camera indices to modify
 * @param {Function} action - Function to apply (enableBit or disableBit)
 * @returns {number} - Count of cameras affected
 */
function modifyCamerasActivation(indices, action) {
  if (!registry.mask || !indices) return 0;

  const indexArray = Array.isArray(indices) ? indices : Array.from(indices);
  let count = 0;

  for (const index of indexArray) {
    if (index >= 0 && index < MAX_CAMERAS) {
      action(registry.mask, index);
      count++;
    }
  }

  return count;
}

/**
 * Add indices to active cameras without clearing others
 */
export function addActiveCameras(indices) {
  return modifyCamerasActivation(indices, enableBit);
}

/**
 * Remove indices from active cameras
 */
export function removeActiveCameras(indices) {
  return modifyCamerasActivation(indices, disableBit);
}

/**
 * Batch enable a set of cameras
 */
export function enableCameras(cameraIndices) {
  return modifyCamerasActivation(cameraIndices, enableBit);
}

/**
 * Batch disable a set of cameras
 */
export function disableCameras(cameraIndices) {
  return modifyCamerasActivation(cameraIndices, disableBit);
}

/**
 * Enable a single camera
 */
export function enableCamera(index) {
  if (!registry.mask || index < 0 || index >= MAX_CAMERAS) return false;
  enableBit(registry.mask, index);
  return true;
}

/**
 * Disable a single camera
 */
export function disableCamera(index) {
  if (!registry.mask || index < 0 || index >= MAX_CAMERAS) return false;
  disableBit(registry.mask, index);
  return false;
}

/**
 * Check if a camera is enabled
 */
export function isCameraEnabled(index) {
  if (!registry.mask || index < 0 || index >= MAX_CAMERAS) return false;
  return isBitSet(registry.mask, index);
}

/**
 * Toggle a camera's enabled state
 */
export function toggleCamera(index) {
  if (!registry.mask || index < 0 || index >= MAX_CAMERAS) return false;

  const newState = !isBitSet(registry.mask, index);
  if (newState) {
    enableBit(registry.mask, index);
  } else {
    disableBit(registry.mask, index);
  }

  return newState;
}

/**
 * Count active cameras based on bitmask
 */
export function countActiveCameras() {
  if (!registry.mask) return 0;

  let count = 0;
  for (let i = 0; i < registry.count; i++) {
    if (isBitSet(registry.mask, i)) count++;
  }
  return count;
}

/**
 * Set all cameras as active
 */
export function activateAllCameras() {
  if (registry.mask) {
    enableAllBits(registry.mask);
  }
}

/**
 * Creates a simple auto-rotation controller for a camera
 */
export function createSimpleAutorotation(
  camera,
  targetPosition,
  cameraDistance,
  index
) {
  if (!camera || !targetPosition) return null;

  const rotationSpeed =
    DEFAULT_ROTATION_SPEED +
    (index % MAX_ROTATION_INDEX) * ROTATION_SPEED_VARIANCE;

  let lastUpdate = 0;
  const target = new Vector3(
    targetPosition.x || 0,
    targetPosition.y || 0,
    targetPosition.z || 0
  );

  // Create minimal controller object with required properties
  return {
    autoRotate: true,
    target,
    _listeners: {},

    // Simplified event handling
    addEventListener: function (type, listener) {
      (this._listeners[type] = this._listeners[type] || []).push(listener);
    },

    hasEventListener: function (type, listener) {
      return this._listeners[type]?.includes(listener) || false;
    },

    removeEventListener: function (type, listener) {
      const listeners = this._listeners[type];
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      }
    },

    dispatchEvent: function (event) {
      const listeners = this._listeners[event.type];
      if (!listeners) return;

      event.target = this;
      listeners.slice().forEach((listener) => listener.call(this, event));
    },

    update: (timestamp = performance.now()) => {
      if (!camera) return;

      // Throttle updates in idle mode
      if (isIdle() && timestamp - lastUpdate < MIN_UPDATE_INTERVAL) return;
      lastUpdate = timestamp;

      const currentAngle = Math.atan2(
        camera.position.x - target.x,
        camera.position.z - target.z
      );
      const newAngle = currentAngle + rotationSpeed;

      camera.position.x = target.x + Math.sin(newAngle) * cameraDistance;
      camera.position.z = target.z + Math.cos(newAngle) * cameraDistance;
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
    },

    dispose: () => {},
  };
}

/**
 * Get cameras for the specified element IDs
 */
export function getCamerasForElements(elementIds) {
  if (!elementIds?.size || registry.count === 0) return new Set();

  const cameraIndices = new Set();

  for (let i = 0; i < registry.count; i++) {
    const data = registry.data[i];
    if (data?.elementId && elementIds.has(data.elementId)) {
      cameraIndices.add(i);
    }
  }

  return cameraIndices;
}

/**
 * Get active cameras sorted by priority
 */
function getActiveCamerasWithPriority() {
  if (!registry.mask) return [];

  const activeCameras = [];

  for (let i = 0; i < registry.count; i++) {
    if (isBitSet(registry.mask, i)) {
      const control = registry.controls[i];
      activeCameras.push({
        index: i,
        priority: control?._dragging ? HIGH_PRIORITY : NORMAL_PRIORITY,
      });
    }
  }

  // Sort by priority (highest first)
  return activeCameras.sort((a, b) => b.priority - a.priority);
}

/**
 * Update all active controls with priority handling
 */
export function updateActiveControls(timestamp) {
  if (!registry.mask) return;

  // Process dragging controls first (highest priority)
  let foundActiveDrag = false;

  for (let i = 0; i < registry.count; i++) {
    if (!isBitSet(registry.mask, i)) continue;

    const control = registry.controls[i];
    if (control?._dragging) {
      control.update();
      foundActiveDrag = true;
    }
  }

  // Only update non-dragging controls when not idle or at reduced rate
  const updateNonDragging = !isIdle() || timestamp % IDLE_UPDATE_MODULO === 0;
  if (!updateNonDragging) return;

  // Then update the rest
  for (let i = 0; i < registry.count; i++) {
    if (!isBitSet(registry.mask, i)) continue;

    const control = registry.controls[i];
    if (!control?._dragging && (!foundActiveDrag || control.autoRotate)) {
      control.update();
    }
  }
}

/**
 * Render a single camera with minimal error handling
 */
function renderSingleCamera(index, renderer, scene, domElement) {
  if (index < 0 || index >= registry.count) return;

  const camera = registry.cameras[index];
  const ctx = registry.contexts[index];
  const control = registry.controls[index];

  // Quick validation
  if (!camera || !ctx?.canvas) return;

  try {
    const canvas = ctx.canvas;
    const width = canvas.width || 300;
    const height = canvas.height || 200;

    if (width <= 0 || height <= 0) return;

    // Update camera aspect ratio if needed
    if (camera.isPerspectiveCamera && camera.aspect !== width / height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    // Setup renderer
    renderer.setSize(width, height, false);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.clear();

    // Update control
    if (control?.update) control.update();

    // Render scene
    renderer.render(scene, camera);

    // Draw to 2D context
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(
      domElement,
      0,
      0,
      domElement.width,
      domElement.height,
      0,
      0,
      width,
      height
    );
  } catch {}
}

/**
 * Rendering of active cameras
 */
export function renderActiveCameras(renderer, scene) {
  if (!renderer || !scene || !registry.mask) return;

  try {
    const activeCameras = getActiveCamerasWithPriority();
    if (activeCameras.length === 0) return;

    // Setup renderer once
    const originalScissorTest = renderer.scissorTest;
    renderer.scissorTest = true;
    const domElement = renderer.domElement;

    // Process cameras in priority order
    for (const { index } of activeCameras) {
      renderSingleCamera(index, renderer, scene, domElement);
    }

    renderer.scissorTest = originalScissorTest;
  } catch (error) {
    // Minimal error handling in production
    console.error("Error in renderActiveCameras: ", error);
  }
}

/**
 * Get the registry state (for debugging/testing)
 */
export function getCameraRegistry() {
  return registry;
}

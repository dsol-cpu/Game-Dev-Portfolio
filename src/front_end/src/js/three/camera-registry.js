/**
 * @fileoverview Global camera registry with 32-bit bitmask-based activation.
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

// Constants
export const CAMERA_TYPES = Object.freeze({
  ABOUT: "about",
  GAME: "game",
  PROJECT: "project",
});

// Configuration constants
const EMPTY_ARRAY = Object.freeze([]);
const MAX_SUPPORTED_CAMERAS = 32;
const DEFAULT_ROTATION_SPEED = 0.003;
const ROTATION_SPEED_VARIANCE = 0.001;
const IDLE_UPDATE_MODULO = 3;
const MIN_UPDATE_INTERVAL = 100;
const DEFAULT_CANVAS_WIDTH = 300;
const DEFAULT_CANVAS_HEIGHT = 200;
const DEFAULT_CAMERA_TYPE = CAMERA_TYPES.PROJECT;
const HIGH_PRIORITY = 1;
const NORMAL_PRIORITY = 0;
const MAX_ROTATION_INDEX = 5;
const VALID_INDEX_MIN = 0;

// Error messages
const ERROR_CAMERA_FULL = (maxCameras) =>
  `Camera registry full (max: ${maxCameras})`;
const ERROR_MAX_POSITIVE = "maxCameras must be positive";
const ERROR_INVALID_CAM_TARGET =
  "Invalid camera or target in createSimpleAutorotation";
const ERROR_RENDERING = (index) => `Error rendering camera ${index}:`;

// Warning messages
const WARN_MAX_CAMERAS = (max) =>
  `Camera registry limited to ${max} cameras, truncating`;

// Global camera registry with a single 32-bit bitmask
const cameraRegistry = {
  cameras: EMPTY_ARRAY,
  controls: EMPTY_ARRAY,
  contexts: EMPTY_ARRAY,
  activeCamBitmask: null,
  cameraData: EMPTY_ARRAY,
  count: 0,
  maxCameras: 0,
  MAX_SUPPORTED_CAMERAS,
};

/**
 * Initialize the camera registry
 * @param {number} maxCameras - Maximum number of cameras to support (max 32)
 */
export function initCameraRegistry(maxCameras = MAX_SUPPORTED_CAMERAS) {
  if (maxCameras <= 0) throw new Error(ERROR_MAX_POSITIVE);

  if (maxCameras > MAX_SUPPORTED_CAMERAS) {
    console.warn(WARN_MAX_CAMERAS(MAX_SUPPORTED_CAMERAS));
    maxCameras = MAX_SUPPORTED_CAMERAS;
  }

  cameraRegistry.maxCameras = maxCameras;
  cameraRegistry.count = 0;
  cameraRegistry.activeCamBitmask = createBitArray(maxCameras);

  // Initialize arrays with nulls
  cameraRegistry.cameras = new Array(maxCameras).fill(null);
  cameraRegistry.controls = new Array(maxCameras).fill(null);
  cameraRegistry.contexts = new Array(maxCameras).fill(null);
  cameraRegistry.cameraData = new Array(maxCameras).fill(null);

  // All cameras active by default
  enableAllBits(cameraRegistry.activeCamBitmask);
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
  if (cameraRegistry.count >= cameraRegistry.maxCameras) {
    throw new Error(ERROR_CAMERA_FULL(cameraRegistry.maxCameras));
  }

  const index = cameraRegistry.count++;
  cameraRegistry.cameras[index] = camera;
  cameraRegistry.controls[index] = controls;
  cameraRegistry.contexts[index] = context;

  // Create camera data with defaults
  cameraRegistry.cameraData[index] = {
    type: metadata.type || DEFAULT_CAMERA_TYPE,
    elementId: metadata.elementId || null,
    modelName: metadata.modelName || null,
    ...(metadata.hasOwnProperty("type") ? {} : metadata),
  };

  // Set activity state
  const bitFunc = active ? enableBit : disableBit;
  bitFunc(cameraRegistry.activeCamBitmask, index);

  return index;
}

/**
 * Set specific cameras as active
 */
export function setActiveCameras(indices) {
  if (!cameraRegistry.activeCamBitmask || !indices?.length) return;

  const newMask = createBitArray(cameraRegistry.maxCameras);

  for (const index of indices) {
    if (isValidIndex(index)) {
      enableBit(newMask, index);
    }
  }

  cameraRegistry.activeCamBitmask = newMask;
}

/**
 * Check if index is valid for the camera registry
 * @private
 */
function isValidIndex(index) {
  return index >= VALID_INDEX_MIN && index < cameraRegistry.maxCameras;
}

/**
 * Add indices to active cameras without clearing others
 */
export function addActiveCameras(indices) {
  if (!indices?.length || !cameraRegistry.activeCamBitmask) return;

  for (const index of indices) {
    if (isValidIndex(index)) {
      enableBit(cameraRegistry.activeCamBitmask, index);
    }
  }
}

/**
 * Remove indices from active cameras
 */
export function removeActiveCameras(indices) {
  if (!indices?.length || !cameraRegistry.activeCamBitmask) return;

  for (const index of indices) {
    if (isValidIndex(index)) {
      disableBit(cameraRegistry.activeCamBitmask, index);
    }
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
  if (!camera || !targetPosition) {
    console.error(ERROR_INVALID_CAM_TARGET);
    return createEmptyController();
  }

  const rotationSpeed =
    DEFAULT_ROTATION_SPEED +
    (index % MAX_ROTATION_INDEX) * ROTATION_SPEED_VARIANCE;
  let lastUpdate = 0;
  const target = new Vector3(
    targetPosition.x || 0,
    targetPosition.y || 0,
    targetPosition.z || 0
  );

  return {
    autoRotate: true,
    target,
    update: (timestamp = performance.now()) => {
      if (!camera) return;

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
 * Create an empty controller with no-op methods
 * @private
 */
function createEmptyController() {
  return { update: () => {}, dispose: () => {} };
}

/**
 * Find camera indices matching a predicate function
 * @private
 */
function getCamerasByPredicate(predicate) {
  if (cameraRegistry.count === 0 || !cameraRegistry.cameraData)
    return EMPTY_ARRAY;

  const indices = [];
  for (let i = 0; i < cameraRegistry.count; i++) {
    if (predicate(cameraRegistry.cameraData[i])) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Get camera indices by type
 */
export function getCamerasByType(type) {
  if (!type) return EMPTY_ARRAY;
  return getCamerasByPredicate((data) => data?.type === type);
}

/**
 * Get camera indices by element ID
 */
export function getCamerasByElementId(elementId) {
  if (!elementId) return EMPTY_ARRAY;
  return getCamerasByPredicate((data) => data?.elementId === elementId);
}

/**
 * Get camera indices by section ID (alias for element ID)
 */
export function getCamerasBySection(sectionId) {
  return getCamerasByElementId(sectionId);
}

/**
 * Set active cameras by type
 */
export function setActiveCamerasByType(type) {
  setActiveCameras(getCamerasByType(type));
}

/**
 * Update all active controls
 */
export function updateActiveControls(timestamp) {
  if (!cameraRegistry.activeCamBitmask) return;

  // First update any controls that are currently being dragged
  let foundActiveDrag = false;

  for (let i = 0; i < cameraRegistry.count; i++) {
    if (!isBitSet(cameraRegistry.activeCamBitmask, i)) continue;

    const control = cameraRegistry.controls[i];
    if (control?._dragging) {
      control.update();
      foundActiveDrag = true;
    }
  }

  // In idle mode, only update auto-rotating controls at a lower rate
  const updateNonDragging = !isIdle() || timestamp % IDLE_UPDATE_MODULO === 0;
  if (!updateNonDragging) return;

  // Then update the rest
  for (let i = 0; i < cameraRegistry.count; i++) {
    if (!isBitSet(cameraRegistry.activeCamBitmask, i)) continue;

    const control = cameraRegistry.controls[i];
    if (
      control &&
      !control._dragging &&
      (!foundActiveDrag || control.autoRotate)
    ) {
      control.update();
    }
  }
}

/**
 * Set all cameras as active
 */
export function activateAllCameras() {
  if (cameraRegistry.activeCamBitmask) {
    enableAllBits(cameraRegistry.activeCamBitmask);
  }
}

/**
 * Optimized rendering of active cameras
 */
export function renderActiveCameras(renderer, scene) {
  if (!renderer || !scene || !cameraRegistry.activeCamBitmask) return;

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
}

/**
 * Get active cameras with priority sorting
 * @private
 */
function getActiveCamerasWithPriority() {
  const activeCameras = [];

  for (let i = 0; i < cameraRegistry.count; i++) {
    if (isBitSet(cameraRegistry.activeCamBitmask, i)) {
      const control = cameraRegistry.controls[i];
      activeCameras.push({
        index: i,
        priority: control?._dragging ? HIGH_PRIORITY : NORMAL_PRIORITY,
      });
    }
  }

  return activeCameras.sort((a, b) => b.priority - a.priority);
}

/**
 * Render a single camera
 * @private
 */
function renderSingleCamera(index, renderer, scene, domElement) {
  const camera = cameraRegistry.cameras[index];
  const ctx = cameraRegistry.contexts[index];
  const control = cameraRegistry.controls[index];

  if (!camera || !ctx?.canvas) return;

  try {
    // Get dimensions from the canvas
    const canvas = ctx.canvas;
    const width = canvas.width || DEFAULT_CANVAS_WIDTH;
    const height = canvas.height || DEFAULT_CANVAS_HEIGHT;

    if (width <= 0 || height <= 0) return;

    // Update camera aspect ratio if needed
    if (camera.isPerspectiveCamera && camera.aspect !== width / height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    setupRendererForCamera(renderer, width, height);
    if (control?.update) control.update();

    renderer.render(scene, camera);
    drawToContext(ctx, domElement, width, height);
  } catch (error) {
    console.error(ERROR_RENDERING(index), error);
  }
}

/**
 * Setup renderer for a specific camera
 * @private
 */
function setupRendererForCamera(renderer, width, height) {
  renderer.setSize(width, height, false);
  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
  renderer.clear();
}

/**
 * Draw rendered content to context
 * @private
 */
function drawToContext(ctx, domElement, width, height) {
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
}

/**
 * Get the registry state
 */
export function getCameraRegistry() {
  return cameraRegistry;
}

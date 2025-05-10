/**
 * @fileoverview Streamlined camera follow system that keeps camera at a fixed point behind player
 */

import {
  Vector3,
  MathUtils,
  Raycaster,
} from "../extern/three/three.module.min.js";

// Simple configuration with only necessary values
const CONFIG = Object.freeze({
  DISTANCE: Object.freeze({
    MIN: 3,
    MAX: 15,
    DEFAULT: 8,
  }),
  HEIGHT: Object.freeze({
    TARGET_OFFSET: 0.8, // Look at point offset
    CAMERA_OFFSET: 1.5, // Camera height offset
  }),
  COLLISION: Object.freeze({
    ENABLED: true,
    LAYERS: 1,
    BUFFER: 0.15, // Buffer to reduce clipping
  }),
});

// Pre-allocated vectors to avoid garbage collection
const _targetPosition = new Vector3();
const _cameraPosition = new Vector3();
const _cameraOffset = new Vector3();
const _rayDirection = new Vector3();
const _lookAtPosition = new Vector3();

// Pre-allocated arrays for calculations
const _sin = new Float32Array(1);
const _cos = new Float32Array(1);

// Collision detection
const _raycaster = new Raycaster();
_raycaster.layers.mask = CONFIG.COLLISION.LAYERS;

// State variables
let currentDistance = CONFIG.DISTANCE.DEFAULT;
let collisionEnabled = CONFIG.COLLISION.ENABLED;

let playerCamera, playerTarget, worldScene;

/**
 * Create and initialize the camera controller with options
 * @param {THREE.Camera} camera - The camera to control
 * @param {THREE.Object3D} target - The target to follow
 * @param {Object} options - Optional configuration parameters
 * @returns {Object} Controller API
 */
export function initCamController(camera, target, options = {}) {
  playerCamera = camera;
  playerTarget = target;
  worldScene = options.scene || null;

  // Apply options
  if (options.distance !== undefined) {
    currentDistance = MathUtils.clamp(
      options.distance,
      CONFIG.DISTANCE.MIN,
      CONFIG.DISTANCE.MAX
    );
  }

  if (options.collisionDetection !== undefined) {
    collisionEnabled = options.collisionDetection;
  }

  // Set up zoom wheel handler
  document.addEventListener("wheel", handleWheel, { passive: true });

  // Return API for controller
  return {
    reset: () => {
      currentDistance = CONFIG.DISTANCE.DEFAULT;
    },
    setDistance: (dist) => {
      currentDistance = MathUtils.clamp(
        dist,
        CONFIG.DISTANCE.MIN,
        CONFIG.DISTANCE.MAX
      );
    },
    setCollisionDetection: (enabled) => {
      collisionEnabled = enabled;
    },
    getState: () => ({
      distance: currentDistance,
      collisionDetection: collisionEnabled,
    }),
  };
}

/**
 * Wheel handler for zoom functionality
 * @param {WheelEvent} event
 */
function handleWheel(event) {
  // Apply zoom based on wheel direction
  const zoomFactor = Math.sign(event.deltaY) * 0.5;
  currentDistance = MathUtils.clamp(
    currentDistance + zoomFactor,
    CONFIG.DISTANCE.MIN,
    CONFIG.DISTANCE.MAX
  );
}

/**
 * Check for collisions between camera and world objects
 * @returns {boolean} Whether a collision was detected
 */
function handleCameraCollision() {
  // Fast exit if disabled or no scene
  if (!collisionEnabled || !worldScene) return false;

  // Calculate ray direction from target to camera
  _rayDirection.copy(_cameraPosition).sub(_targetPosition).normalize();
  const rayLength = currentDistance;

  // Set up raycaster
  _raycaster.set(_targetPosition, _rayDirection);
  _raycaster.far = rayLength;

  // Cast ray against scene objects
  const intersects = _raycaster.intersectObjects(worldScene.children, true);

  if (intersects.length > 0) {
    // Apply collision correction with buffer
    const collisionDistance =
      intersects[0].distance * (1 - CONFIG.COLLISION.BUFFER);

    // Set camera position to avoid clipping
    _cameraPosition
      .copy(_targetPosition)
      .add(_rayDirection.multiplyScalar(collisionDistance));

    return true;
  }

  return false;
}

/**
 * Update camera position to fixed point behind player
 */
export function updateCamera() {
  if (!playerCamera || !playerTarget) return;

  // Get target position
  _targetPosition.copy(playerTarget.position);

  // Extract player rotation angle from quaternion
  const playerQuat = playerTarget.quaternion;
  const angle = Math.atan2(
    2 * (playerQuat.y * playerQuat.w + playerQuat.x * playerQuat.z),
    1 - 2 * (playerQuat.z * playerQuat.z + playerQuat.y * playerQuat.y)
  );

  // Calculate sine and cosine of angle
  _sin[0] = Math.sin(angle);
  _cos[0] = Math.cos(angle);

  // Calculate camera offset based on player orientation
  _cameraOffset.x = _sin[0] * currentDistance;
  _cameraOffset.y = CONFIG.HEIGHT.CAMERA_OFFSET;
  _cameraOffset.z = _cos[0] * currentDistance;

  // Position camera directly behind player
  _cameraPosition.copy(_targetPosition).add(_cameraOffset);

  // Check for collisions
  const hasCollision = handleCameraCollision();

  // Set camera position (directly, no smoothing)
  if (!hasCollision) {
    playerCamera.position.copy(_cameraPosition);
  } else {
    // Collision position already set in _cameraPosition
    playerCamera.position.copy(_cameraPosition);
  }

  // Set camera look at position
  _lookAtPosition.copy(_targetPosition);
  _lookAtPosition.y += CONFIG.HEIGHT.TARGET_OFFSET;
  playerCamera.lookAt(_lookAtPosition);
}

/**
 * Force camera position update - identical to updateCamera in this version
 * since we're not using smoothing
 */
export function snapCameraToTarget() {
  updateCamera();
}

/**
 * Clean up event listeners and resources
 */
export function disposeCameraController() {
  document.removeEventListener("wheel", handleWheel);
  playerCamera = null;
  playerTarget = null;
  worldScene = null;
}

/**
 * Get current camera state - useful for debugging
 */
export function getCameraState() {
  return {
    distance: currentDistance,
    collisionDetection: collisionEnabled,
    targetPosition: playerTarget
      ? new Vector3().copy(playerTarget.position)
      : null,
    cameraPosition: playerCamera
      ? new Vector3().copy(playerCamera.position)
      : null,
  };
}

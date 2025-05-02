/**
 * @fileoverview Camera follow system for player model with fixed orientation
 */

import {
  Vector3,
  Quaternion,
  Spherical,
} from "../extern/three/three.module.min.js";

// Camera settings
const ORBIT = {
  MIN_DISTANCE: 3, // Minimum distance from player
  MAX_DISTANCE: 15, // Maximum distance from player
  DEFAULT_DISTANCE: 8, // Default follow distance
  HEIGHT_OFFSET: 1.5, // Height offset above player
  ZOOM_SPEED: 0.1, // Mouse wheel zoom sensitivity
  SMOOTHING: 0.1, // Camera movement smoothing factor
  LOOK_AHEAD_FACTOR: 1.5, // How far ahead the camera looks when moving
};

// Camera state
let cameraState = null;

// Temp vectors for calculations
const tempTargetPosition = new Vector3();
const tempCameraPosition = new Vector3();
const tempPlayerDirection = new Vector3();
const tempCameraOffset = new Vector3();
const tempUp = new Vector3(0, 1, 0);

/**
 * Create orbit controller for the camera
 * @param {PerspectiveCamera} camera - The camera to control
 * @param {Group} target - The target to follow (player)
 * @returns {Function} Update function for the controller
 */
export function createOrbitController(camera, target) {
  // Initialize camera state with fixed offset from player
  cameraState = {
    targetPosition: new Vector3(),
    currentDistance: ORBIT.DEFAULT_DISTANCE,
    // Fixed offset behind and above the player
    offset: new Vector3(0, ORBIT.HEIGHT_OFFSET, ORBIT.DEFAULT_DISTANCE),
  };

  // Set up mouse wheel for zoom only
  setupMouseControls();

  // Return update function
  return () => updateOrbitCamera(camera, target);
}

/**
 * Update camera position to follow target
 * @param {PerspectiveCamera} camera - The camera to update
 * @param {Group} target - The target to follow
 */
export function updateOrbitCamera(camera, target) {
  if (!camera || !target || !cameraState) return;

  // Get player position and rotation
  const playerPosition = target.position;
  const playerQuaternion = target.quaternion;

  // Calculate fixed offset position behind the player based on player's orientation
  tempCameraOffset.copy(cameraState.offset);
  tempCameraOffset.applyQuaternion(playerQuaternion);

  // Calculate camera position by adding offset to player position
  tempCameraPosition.copy(playerPosition).add(tempCameraOffset);

  // Apply zoom distance scaling to the offset position
  const zoomFactor = cameraState.currentDistance / ORBIT.DEFAULT_DISTANCE;
  tempCameraPosition
    .sub(playerPosition)
    .multiplyScalar(zoomFactor)
    .add(playerPosition);

  // Smoothly move camera to calculated position
  camera.position.lerp(tempCameraPosition, ORBIT.SMOOTHING);

  // Calculate target position slightly ahead of player based on direction
  tempPlayerDirection.set(0, 0, -1).applyQuaternion(playerQuaternion);
  tempTargetPosition
    .copy(playerPosition)
    .add(tempPlayerDirection.multiplyScalar(ORBIT.LOOK_AHEAD_FACTOR));
  tempTargetPosition.y += ORBIT.HEIGHT_OFFSET;

  // Make camera look at target
  camera.lookAt(tempTargetPosition);
}

/**
 * Set up mouse controls for zoom only
 */
function setupMouseControls() {
  // Mouse wheel handler for zoom
  const onMouseWheel = (event) => {
    // Adjust distance based on wheel direction
    cameraState.currentDistance += event.deltaY * ORBIT.ZOOM_SPEED * 0.01;

    // Clamp distance between min and max
    cameraState.currentDistance = Math.max(
      ORBIT.MIN_DISTANCE,
      Math.min(ORBIT.MAX_DISTANCE, cameraState.currentDistance)
    );
  };

  // Add event listeners
  document.addEventListener("wheel", onMouseWheel, { passive: false });

  // Clean up when the page is unloaded
  window.addEventListener("beforeunload", () => {
    document.removeEventListener("wheel", onMouseWheel, { passive: false });
  });
}

/**
 * @fileoverview Camera follow system that exactly matches player's left/right rotation
 */

import {
  Vector3,
  Quaternion,
  Euler,
} from "../extern/three/three.module.min.js";

// Camera settings
const CAMERA = {
  MIN_DISTANCE: 3, // Minimum distance from player
  MAX_DISTANCE: 15, // Maximum distance from player
  DEFAULT_DISTANCE: 8, // Default follow distance
  HEIGHT_OFFSET: 1.5, // Height offset above player
  ZOOM_SPEED: 0.1, // Mouse wheel zoom sensitivity
  SMOOTHING: 0.25, // Camera movement smoothing factor
};

// Camera state
let cameraState = null;

// Temp vectors and objects for calculations
const tempTargetPosition = new Vector3();
const tempCameraPosition = new Vector3();
const tempPlayerEuler = new Euler();
const tempPlayerQuaternion = new Quaternion();

/**
 * Create camera controller that exactly matches player's left/right rotation
 * @param {PerspectiveCamera} camera - The camera to control
 * @param {Group} target - The target to follow (player)
 * @returns {Function} Update function for the controller
 */
export function createCameraController(camera, target) {
  // Initialize camera state
  cameraState = {
    targetPosition: new Vector3(),
    currentDistance: CAMERA.DEFAULT_DISTANCE,
  };

  // Set up mouse wheel for zoom
  setupMouseControls();

  // Return update function
  return () => updateCamera(camera, target);
}

/**
 * Update camera position to exactly follow target's left/right rotation
 * @param {PerspectiveCamera} camera - The camera to update
 * @param {Group} target - The target to follow
 */
export function updateCamera(camera, target) {
  if (!camera || !target || !cameraState) return;

  // Get player position
  const playerPosition = target.position;

  // Extract just the Y-axis rotation (yaw) from the player's quaternion
  tempPlayerQuaternion.copy(target.quaternion);
  tempPlayerEuler.setFromQuaternion(tempPlayerQuaternion, "YXZ");
  const playerYaw = tempPlayerEuler.y;

  // The forward vector of the player would be:
  // forward = (-sin(yaw), 0, -cos(yaw))
  // So for the camera to be behind, we want:
  // cameraPos = playerPos + distance * (sin(yaw), 0, cos(yaw))

  // Calculate camera position - positioned directly behind the player
  tempCameraPosition.set(
    Math.sin(playerYaw) * cameraState.currentDistance,
    CAMERA.HEIGHT_OFFSET * 1.2, // Raised camera height for better viewing angle
    Math.cos(playerYaw) * cameraState.currentDistance
  );

  // Add to player position
  tempCameraPosition.add(playerPosition);

  // Smoothly move camera to calculated position
  camera.position.lerp(tempCameraPosition, CAMERA.SMOOTHING);

  // Calculate target position at the player position plus height offset
  // Ensure we're looking at the player's head level, not just the origin
  tempTargetPosition.copy(playerPosition);
  tempTargetPosition.y += CAMERA.HEIGHT_OFFSET * 0.8;

  // Make camera look at target
  camera.lookAt(tempTargetPosition);
}

/**
 * Set up mouse controls for zoom
 */
function setupMouseControls() {
  // Mouse wheel handler for zoom
  const onMouseWheel = (event) => {
    // Adjust distance based on wheel direction
    cameraState.currentDistance += event.deltaY * CAMERA.ZOOM_SPEED * 0.01;

    // Clamp distance between min and max
    cameraState.currentDistance = Math.max(
      CAMERA.MIN_DISTANCE,
      Math.min(CAMERA.MAX_DISTANCE, cameraState.currentDistance)
    );
  };

  // Add event listeners
  document.addEventListener("wheel", onMouseWheel, { passive: false });

  // Clean up when the page is unloaded
  window.addEventListener("beforeunload", () => {
    document.removeEventListener("wheel", onMouseWheel, { passive: false });
  });
}

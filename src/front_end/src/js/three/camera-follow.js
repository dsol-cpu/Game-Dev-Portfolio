/**
 * @fileoverview Simplified camera follow system that matches player rotation
 */

import { Vector3, Euler } from "../extern/three/three.module.min.js";

// Camera configuration
const CONFIG = {
  DISTANCE: {
    MIN: 3,
    MAX: 15,
    DEFAULT: 8,
  },
  HEIGHT_OFFSET: 1.5,
  ZOOM_SPEED: 0.001,
  SMOOTHING: 0.25,
};

// Reusable calculation objects
const targetPosition = new Vector3();
const cameraPosition = new Vector3();
const playerRotation = new Euler();

const state = {
  distance: CONFIG.DISTANCE.DEFAULT,
};

let playerCamera, playerTarget;

/**
 * Create and initialize the camera controller
 */
export function initCamController(camera, target) {
  playerCamera = camera;
  playerTarget = target;

  // Set up zoom control
  document.addEventListener("wheel", (event) => {
    // Update distance based on wheel direction
    state.distance += event.deltaY * CONFIG.ZOOM_SPEED;

    // Clamp to min/max range
    state.distance = Math.max(
      CONFIG.DISTANCE.MIN,
      Math.min(CONFIG.DISTANCE.MAX, state.distance)
    );
  });
}

/**
 * Update camera position to follow target
 */
export function updateCamera(deltaTime) {
  if (!playerCamera || !playerTarget) return;

  // Get player's position and rotation
  targetPosition.copy(playerTarget.position);
  playerRotation.setFromQuaternion(playerTarget.quaternion, "YXZ");

  // Calculate camera position directly behind player based on their rotation
  const offsetX = Math.sin(playerRotation.y) * state.distance;
  const offsetZ = Math.cos(playerRotation.y) * state.distance;

  cameraPosition.set(
    targetPosition.x + offsetX,
    targetPosition.y + CONFIG.HEIGHT_OFFSET * 1.2,
    targetPosition.z + offsetZ
  );

  // Apply smooth movement based on delta time
  const smoothFactor = Math.min(1.0, CONFIG.SMOOTHING * (deltaTime / (1 / 60)));
  playerCamera.position.lerp(cameraPosition, smoothFactor);

  // Look at position slightly above target
  targetPosition.y += CONFIG.HEIGHT_OFFSET * 0.8;
  playerCamera.lookAt(targetPosition);
}

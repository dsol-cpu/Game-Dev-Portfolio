/**
 * @fileoverview Player model and controls for airship (Skies of Arcadia style) - No Gravity
 */

import {
  Euler,
  MeshPhongMaterial,
  Quaternion,
  Vector3,
  Group,
} from "../extern/three/three.module.min.js";
import { handleUserInteraction } from "../user-interaction.js";
import { getModel } from "./model-manager.js";

// Player state - single shared object
const player = {
  model: null,
  height: 10,
  velocity: 0,
  verticalVelocity: 0,
  turnRate: 0,
  keys: {},
  direction: "N",
  position: new Vector3(),
  orientation: new Quaternion(),
  resetInProgress: false,
  // Properties for smooth tilting (only forward/backward like a ship)
  currentPitch: 0,
  targetPitch: 0,
};

// Reusable objects
const tempVector = new Vector3();
const tempEuler = new Euler();
const tempQuaternion = new Quaternion();

// Constants
const SPEED = {
  MAX: 12.0,
  ACCELERATION: 0.6,
  DECELERATION: 0.5,
  TURN: 3.0,
  VERTICAL_MAX: 9.0,
  VERTICAL_ACCEL: 0.5,
  VERTICAL_DECEL: 0.5, // Matches acceleration for more responsive control
  TILT_AMOUNT: Math.PI / 30, // Subtle tilt like a sailing ship
  TILT_SPEED: 3.0, // Slightly slower tilt for ship-like feel
  RESET_SPEED: 6.0,
};

const HEIGHT = { MIN: 1, MAX: 50 };
const CAMERA = { DISTANCE: 5, HEIGHT: 2, LOOK_AHEAD: 3 };
const CONTROL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ShiftLeft",
  "ShiftRight",
];

// Directions
const DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE", "S"];

// Materials
const MATERIALS = {
  BODY: new MeshPhongMaterial({
    color: 0x3366cc,
    shininess: 100,
    specular: 0x111111,
  }),
  COCKPIT: new MeshPhongMaterial({
    color: 0x66ccff,
    shininess: 120,
    opacity: 0.7,
    transparent: true,
  }),
  WINGS: new MeshPhongMaterial({ color: 0x2255aa }),
  ENGINE: new MeshPhongMaterial({ color: 0x555555 }),
  GLOW: new MeshPhongMaterial({
    color: 0xff7700,
    emissive: 0xff5500,
    transparent: true,
    opacity: 0.8,
  }),
};

export async function createPlayerModel() {
  if (player.model) return player.model;

  const ship = new Group();

  // Wait for the model to load before adding it to the group
  const shipModel = await getModel("portfolioShip");
  shipModel.quaternion.identity();
  ship.add(shipModel);
  ship.position.set(0, HEIGHT.MIN, 0);

  // Set initial orientation to face forward (negative Z direction)
  player.orientation = new Quaternion();
  player.direction = "N";

  // Apply initial orientation to the ship
  ship.quaternion.copy(player.orientation);

  player.model = ship;
  return ship;
}

/**
 * Initialize player controls
 */
export function initPlayerControls() {
  // Add event listeners
  window.addEventListener("keydown", handleKeyDown, { capture: true });
  window.addEventListener("keyup", handleKeyUp, { capture: true });

  // Make canvas focusable
  const canvas = document.getElementById("main-game-canvas");
  if (canvas) {
    canvas.tabIndex = 1;
    canvas.addEventListener("click", () => canvas.focus());
  }
}

/**
 * Calculate cardinal direction from rotation
 */
function getDirection(rotation) {
  const normalized = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return DIRECTIONS[Math.floor(((normalized * 180) / Math.PI + 22.5) / 45) % 8];
}

/**
 * Update player movement based on controls
 */
export function updatePlayer(deltaTime) {
  const ship = player.model;
  if (!ship) return;

  if (player.resetInProgress) {
    updateOrientationReset(deltaTime);
    return;
  }

  // Get ship forward direction
  tempVector.set(0, 0, -1).applyQuaternion(player.orientation).normalize();
  const forward = tempVector;

  // Movement vector for this frame
  const movement = new Vector3(0, 0, 0);
  const keys = player.keys;

  // Forward/backward movement
  const maxSpeed = SPEED.MAX * deltaTime;
  const accel = SPEED.ACCELERATION * deltaTime;
  const decel = SPEED.DECELERATION * deltaTime;

  if (keys["ArrowUp"] || keys["KeyW"]) {
    player.velocity = Math.min(maxSpeed, player.velocity + accel);
  } else if (keys["ArrowDown"] || keys["KeyS"]) {
    player.velocity = Math.max(-maxSpeed, player.velocity - accel);
  } else {
    // Decelerate
    if (Math.abs(player.velocity) < decel) {
      player.velocity = 0;
    } else if (player.velocity > 0) {
      player.velocity -= decel;
    } else {
      player.velocity += decel;
    }
  }

  // Apply forward movement
  if (player.velocity !== 0) {
    tempVector.copy(forward).multiplyScalar(player.velocity);
    movement.add(tempVector);
  }

  // Vertical movement - no gravity, only moves when keys are pressed
  const vertMaxSpeed = SPEED.VERTICAL_MAX * deltaTime;
  const vertAccel = SPEED.VERTICAL_ACCEL * deltaTime;

  if (keys["Space"] && ship.position.y < HEIGHT.MAX) {
    player.verticalVelocity = Math.min(
      vertMaxSpeed,
      player.verticalVelocity + vertAccel
    );
  } else if (
    (keys["ShiftLeft"] || keys["ShiftRight"]) &&
    ship.position.y > HEIGHT.MIN
  ) {
    player.verticalVelocity = Math.max(
      -vertMaxSpeed,
      player.verticalVelocity - vertAccel
    );
  } else {
    // Stop vertical movement completely when no keys are pressed - no gravity
    player.verticalVelocity = 0;
  }

  // Apply height limits
  if (
    (ship.position.y >= HEIGHT.MAX && player.verticalVelocity > 0) ||
    (ship.position.y <= HEIGHT.MIN && player.verticalVelocity < 0)
  ) {
    player.verticalVelocity = 0;
  }

  // Apply vertical movement
  if (player.verticalVelocity !== 0) {
    movement.y += player.verticalVelocity;
  }

  // Turning - ship-like turning (no roll/banking)
  const turnRate = SPEED.TURN * deltaTime;

  if (keys["ArrowLeft"] || keys["KeyA"]) {
    player.turnRate = turnRate;
  } else if (keys["ArrowRight"] || keys["KeyD"]) {
    player.turnRate = -turnRate;
  } else {
    player.turnRate = 0;
  }

  // Apply turning
  if (player.turnRate !== 0) {
    tempQuaternion.setFromAxisAngle(new Vector3(0, 1, 0), player.turnRate);
    player.orientation.premultiply(tempQuaternion);
    player.direction = getDirection(
      tempEuler.setFromQuaternion(player.orientation, "YXZ").y
    );
  }

  // Set target pitch based on combined movement inputs
  let targetPitch = 0;
  const pitchAmount = SPEED.TILT_AMOUNT * 1.2; // Slightly increased for more noticeable effect

  // Determine if we're moving horizontally
  const movingForward = keys["ArrowUp"] || keys["KeyW"] || player.velocity > 0;
  const movingBackward =
    keys["ArrowDown"] || keys["KeyS"] || player.velocity < 0;

  // Determine vertical input
  const goingUp = keys["Space"];
  const goingDown = keys["ShiftLeft"] || keys["ShiftRight"];

  // Calculate tilt based on combined inputs
  if (movingForward) {
    if (goingUp) {
      // Forward + Up = nose up
      targetPitch = pitchAmount;
    } else if (goingDown) {
      // Forward + Down = nose down
      targetPitch = -pitchAmount;
    } else {
      // Just forward = slight nose up
      targetPitch = pitchAmount * 0.3;
    }
  } else if (movingBackward) {
    if (goingUp) {
      // Backward + Up = nose down
      targetPitch = -pitchAmount;
    } else if (goingDown) {
      // Backward + Down = nose up
      targetPitch = pitchAmount;
    } else {
      // Just backward = slight nose down
      targetPitch = -pitchAmount * 0.3;
    }
  } else {
    // Not moving horizontally
    if (goingUp) {
      // Just up = slight nose up
      targetPitch = -pitchAmount * 0.5;
    } else if (goingDown) {
      // Just down = slight nose down
      targetPitch = pitchAmount * 0.5;
    } else {
      // No input = level
      targetPitch = 0;
    }
  }

  // Apply the calculated pitch
  player.targetPitch = targetPitch;

  // Smoothly transition current pitch toward target pitch
  const tiltLerpFactor = Math.min(1, SPEED.TILT_SPEED * deltaTime);
  player.currentPitch +=
    (player.targetPitch - player.currentPitch) * tiltLerpFactor;

  // Apply ship orientation - yaw from turning, pitch from movement
  tempEuler.setFromQuaternion(player.orientation, "YXZ");

  // Create the final quaternion for the ship model
  ship.quaternion.setFromEuler(
    new Euler(
      player.currentPitch, // X axis - pitch from acceleration/deceleration
      tempEuler.y, // Y axis - direction from turning
      0, // Z axis - no roll for ship-like movement
      "YXZ" // Apply in order Y, X, Z
    )
  );

  // Apply position change
  if (!movement.equals(new Vector3(0, 0, 0))) {
    ship.position.add(movement);
    // Enforce height limits
    ship.position.y = Math.max(
      HEIGHT.MIN,
      Math.min(HEIGHT.MAX, ship.position.y)
    );
  }

  // Apply hover effect VISUALLY only by creating a separate visual offset
  // This doesn't affect the actual ship position for physics/gameplay
  // const hoverOffset = Math.sin(performance.now() / 1000) * 0.02;

  // Store the actual position
  player.position.copy(ship.position);

  // Apply visual hover effect as a temporary visual-only offset
  // ship.position.y += hoverOffset;
}

/**
 * Reset ship orientation to level
 */
function updateOrientationReset(deltaTime) {
  const ship = player.model;
  if (!ship) return;

  const resetSpeed = SPEED.RESET_SPEED * deltaTime;

  // Get level orientation (only Y rotation)
  tempEuler.setFromQuaternion(player.orientation, "YXZ");
  tempQuaternion.setFromEuler(new Euler(0, tempEuler.y, 0, "YXZ"));

  // Smoothly interpolate to level orientation
  player.orientation.slerp(tempQuaternion, resetSpeed);
  ship.quaternion.setFromEuler(
    new Euler(player.currentPitch, tempEuler.y, 0, "YXZ")
  );

  // Reset pitch values gradually
  player.currentPitch *= 1 - resetSpeed;
  player.targetPitch = 0;

  // Check if reset is complete
  if (Math.abs(player.currentPitch) < 0.01) {
    player.resetInProgress = false;
    player.currentPitch = 0;
    ship.quaternion.setFromEuler(new Euler(0, tempEuler.y, 0, "YXZ"));
    player.direction = getDirection(tempEuler.y);
  }
}

/**
 * Start orientation reset
 */
export function resetOrientation() {
  if (!player.model) return;
  player.resetInProgress = true;
  player.turnRate = 0;
}

/**
 * Update camera to follow player
 */
export function updateCamera(camera) {
  const ship = player.model;
  if (!ship || !camera) return;

  // Get ship forward direction
  tempVector.set(0, 0, -1).applyQuaternion(player.orientation).normalize();

  // Position camera behind ship
  camera.position
    .copy(ship.position)
    .add(tempVector.clone().multiplyScalar(-CAMERA.DISTANCE))
    .add(new Vector3(0, CAMERA.HEIGHT, 0));

  // Look ahead of ship
  tempVector
    .copy(ship.position)
    .add(tempVector.multiplyScalar(CAMERA.LOOK_AHEAD));
  camera.lookAt(tempVector);
}

/**
 * Clean up player controls
 */
export function disposePlayerControls() {
  window.removeEventListener("keydown", handleKeyDown, { capture: true });
  window.removeEventListener("keyup", handleKeyUp, { capture: true });
}

function handleKeyDown(e) {
  if (CONTROL_KEYS.includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
    handleUserInteraction(e);
    player.keys[e.code] = true;
  }
}

function handleKeyUp(e) {
  if (CONTROL_KEYS.includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
    handleUserInteraction(e);
    player.keys[e.code] = false;
  }
}

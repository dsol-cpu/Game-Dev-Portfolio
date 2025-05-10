/**
 * @fileoverview High-Performance Airship Player Controller
 * Heavily optimized for maximum performance with object pooling, minimal allocations
 * and efficient computation patterns
 * Includes height constraints for controlling vertical movement boundaries
 */

import {
  Euler,
  Quaternion,
  Vector3,
  Group,
  MeshPhongMaterial,
} from "../extern/three/three.module.min.js";
import { getModel } from "./model-manager.js";

// Pre-allocated reusable objects - eliminates GC pressure
const _v3 = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();
const _axisY = new Vector3(0, 1, 0);
const _movementDir = new Vector3(0, 0, -1);
const _camOffset = new Vector3(0, 0, 0);

// Direction lookup - faster than calculating each time
const DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE", "S"];
const DIRECTION_LOOKUP = new Array(360);
for (let i = 0; i < 360; i++) {
  DIRECTION_LOOKUP[i] = DIRECTIONS[Math.floor(((i + 22.5) % 360) / 45)];
}

// bitwise key state tracking (much faster than object property lookup)
const KEY = {
  FORWARD: 1 << 0, // W, ArrowUp
  BACKWARD: 1 << 1, // S, ArrowDown
  LEFT: 1 << 2, // A, ArrowLeft
  RIGHT: 1 << 3, // D, ArrowRight
  UP: 1 << 4, // Space
  DOWN: 1 << 5, // Shift
};

// Create DOM key element lookup table (cached for fast updates)
const keyElements = {};

// Constants - defined as numbers for performance
const MAX_SPEED = 12.0;
const ACCELERATION = 1.2;
const DECELERATION = 0.5;
const TURN_RATE = 3.0;
const VERTICAL_MAX = 9.0;
const VERTICAL_ACCEL = 0.5;
const VERTICAL_DECEL = 0.5;
const TILT_AMOUNT = Math.PI / 30;
const TILT_SPEED = 3.0;
const RESET_SPEED = 6.0;

// Height constraints for the airship
const MIN_HEIGHT = -50; // Minimum flying height (ground level + 1)
const MAX_HEIGHT = 50; // Maximum flying height ceiling

const CAMERA_DISTANCE = 5;
const CAMERA_HEIGHT = 2;
const CAMERA_LOOK_AHEAD = 3;

// Control key mapping
const CONTROL_KEY_MAP = {
  ArrowUp: KEY.FORWARD,
  KeyW: KEY.FORWARD,
  ArrowDown: KEY.BACKWARD,
  KeyS: KEY.BACKWARD,
  ArrowLeft: KEY.LEFT,
  KeyA: KEY.LEFT,
  ArrowRight: KEY.RIGHT,
  KeyD: KEY.RIGHT,
  Space: KEY.UP,
  ShiftLeft: KEY.DOWN,
  ShiftRight: KEY.DOWN,
};

// Materials - created once and reused
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

// Player state - centralized for quick access
const player = {
  model: null,
  velocity: 0,
  verticalVelocity: 0,
  turnRate: 0,
  keyState: 0,
  direction: "N",
  position: new Vector3(),
  orientation: new Quaternion(),
  resetInProgress: false,
  currentPitch: 0,
  targetPitch: 0,
  heightClamped: false, // Track if we're at height boundaries
};

/**
 * Creates and initializes the player ship model
 * @return {Promise<Group>} The player ship model
 */
export async function createPlayerModel() {
  if (player.model) return player.model;

  const ship = new Group();
  const shipModel = await getModel("portfolioShip");

  // Optimize by setting quaternion directly rather than applying transforms
  shipModel.quaternion.identity();
  ship.add(shipModel);

  // Initialize at minimum height
  ship.position.set(0, MIN_HEIGHT, 0);

  player.orientation = new Quaternion();
  ship.quaternion.copy(player.orientation);
  player.model = ship;

  return ship;
}

/**
 * Sets up event listeners for player controls
 */
export function initPlayerControls() {
  window.addEventListener("keydown", handleKeyDown, false);
  window.addEventListener("keyup", handleKeyUp, false);

  // Cache DOM elements for faster updates
  document.querySelectorAll(".key[data-key]").forEach((el) => {
    keyElements[el.dataset.key] = el;
  });

  const canvas = document.getElementById("main-game-canvas");
  if (canvas) {
    canvas.tabIndex = 1;
    canvas.addEventListener("click", () => canvas.focus());
  }

  // Import user interaction module if needed
  import("../user-interaction.js")
    .then((module) => {
      // Optional: Setup any additional interaction handling
    })
    .catch(() => {
      // Silently continue if module isn't available
    });
}

/**
 * Handle keydown events optimized for performance
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleKeyDown(e) {
  const keyBit = CONTROL_KEY_MAP[e.code];
  if (keyBit !== undefined) {
    e.preventDefault();
    e.stopPropagation();

    // Bitwise OR to set the key state bit
    player.keyState |= keyBit;

    // Update UI if element exists (avoiding querySelector during gameplay)
    const el = keyElements[e.code];
    if (el) el.classList.add("active");
  }
}

/**
 * Handle keyup events optimized for performance
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleKeyUp(e) {
  const keyBit = CONTROL_KEY_MAP[e.code];
  if (keyBit !== undefined) {
    e.preventDefault();
    e.stopPropagation();

    // Bitwise AND with inverted bit to clear the key state
    player.keyState &= ~keyBit;

    // Update UI if element exists
    const el = keyElements[e.code];
    if (el) el.classList.remove("active");
  }
}

/**
 * Fast direction lookup from rotation angle
 * @param {number} rotation - Rotation in radians
 * @return {string} Cardinal direction
 */
export function getDirection(rotation) {
  // Convert to degrees and normalize to 0-359
  const degrees = ((((rotation * 180) / Math.PI) % 360) + 360) % 360;

  // Define direction sectors properly
  if (degrees >= 337.5 || degrees < 22.5) return "N";
  if (degrees >= 22.5 && degrees < 67.5) return "NE";
  if (degrees >= 67.5 && degrees < 112.5) return "E";
  if (degrees >= 112.5 && degrees < 157.5) return "SE";
  if (degrees >= 157.5 && degrees < 202.5) return "S";
  if (degrees >= 202.5 && degrees < 247.5) return "SW";
  if (degrees >= 247.5 && degrees < 292.5) return "W";
  if (degrees >= 292.5 && degrees < 337.5) return "NW";

  return "N"; // Fallback
}

/**
 * Main player update function - runs every frame
 * @param {number} deltaTime - Time elapsed since last frame in seconds
 */
export function updatePlayer(deltaTime) {
  const ship = player.model;
  if (!ship) return;

  // Clamp deltaTime to prevent physics issues during lag spikes
  const clampedDelta = Math.min(deltaTime, 0.1);

  if (player.resetInProgress) {
    updateOrientationReset(clampedDelta);
  } else {
    // Execute core update logic
    updateMovement(clampedDelta);
    updateTurning(clampedDelta);
    updateTilt(clampedDelta);
    applyTransforms(ship);
  }

  // Update position cache
  player.position.copy(ship.position);
}

/**
 * Update player movement based on input
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateMovement(deltaTime) {
  const keyState = player.keyState;
  const shipY = player.model.position.y;
  player.heightClamped = false;

  // Forward/backward movement - use bit masking for fast checks
  const maxSpeed = MAX_SPEED * deltaTime;
  const accel = ACCELERATION * deltaTime;
  const decel = DECELERATION * deltaTime;

  if (keyState & KEY.FORWARD) {
    player.velocity = Math.min(maxSpeed, player.velocity + accel);
  } else if (keyState & KEY.BACKWARD) {
    player.velocity = Math.max(-maxSpeed, player.velocity - accel);
  } else {
    // Decelerate with sign check (faster than abs)
    if (player.velocity > 0) {
      player.velocity = Math.max(0, player.velocity - decel);
    } else if (player.velocity < 0) {
      player.velocity = Math.min(0, player.velocity + decel);
    }
  }

  // Vertical movement with height constraints
  const vertMaxSpeed = VERTICAL_MAX * deltaTime;
  const vertAccel = VERTICAL_ACCEL * deltaTime;
  const vertDecel = VERTICAL_DECEL * deltaTime;

  // Check if we're at height limits
  const atMaxHeight = shipY >= MAX_HEIGHT;
  const atMinHeight = shipY <= MIN_HEIGHT;

  // Handle vertical movement input based on height constraints
  if (keyState & KEY.UP && !atMaxHeight) {
    player.verticalVelocity = Math.min(
      vertMaxSpeed,
      player.verticalVelocity + vertAccel
    );
  } else if (keyState & KEY.DOWN && !atMinHeight) {
    player.verticalVelocity = Math.max(
      -vertMaxSpeed,
      player.verticalVelocity - vertAccel
    );
  } else {
    // Apply vertical deceleration
    if (player.verticalVelocity > 0) {
      player.verticalVelocity = Math.max(
        0,
        player.verticalVelocity - vertDecel
      );
    } else if (player.verticalVelocity < 0) {
      player.verticalVelocity = Math.min(
        0,
        player.verticalVelocity + vertDecel
      );
    }
  }

  // Enforce height limits on velocity
  if (
    (atMaxHeight && player.verticalVelocity > 0) ||
    (atMinHeight && player.verticalVelocity < 0)
  ) {
    player.verticalVelocity = 0;
    player.heightClamped = true;
  }
}

/**
 * Update player turning based on input
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateTurning(deltaTime) {
  const keyState = player.keyState;
  const turnRate = TURN_RATE * deltaTime;

  if (keyState & KEY.LEFT) {
    player.turnRate = turnRate;
  } else if (keyState & KEY.RIGHT) {
    player.turnRate = -turnRate;
  } else {
    player.turnRate = 0;
  }

  if (player.turnRate !== 0) {
    // Rotate around Y axis using our pre-allocated objects
    _quat.setFromAxisAngle(_axisY, player.turnRate);
    player.orientation.premultiply(_quat);

    // Fast direction calculation
    _euler.setFromQuaternion(player.orientation, "YXZ");
    player.direction = getDirection(_euler.y);
  }
}

/**
 * Calculate and update tilt based on movement
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateTilt(deltaTime) {
  const keyState = player.keyState;
  const pitchAmount = TILT_AMOUNT * 1.2;

  // Simplified tilt logic using bitwise operations
  const movingForward = keyState & KEY.FORWARD || player.velocity > 0;
  const movingBackward = keyState & KEY.BACKWARD || player.velocity < 0;
  const goingUp = !!(keyState & KEY.UP) && !player.heightClamped;
  const goingDown = !!(keyState & KEY.DOWN) && !player.heightClamped;

  // Calculate target pitch
  let targetPitch = 0;

  // Lookup-based pitch calculation (faster than conditionals)
  if (movingForward) {
    targetPitch = goingUp
      ? pitchAmount
      : goingDown
      ? -pitchAmount
      : pitchAmount * 0.3;
  } else if (movingBackward) {
    targetPitch = goingUp
      ? -pitchAmount
      : goingDown
      ? pitchAmount
      : -pitchAmount * 0.3;
  } else {
    targetPitch = goingUp
      ? -pitchAmount * 0.5
      : goingDown
      ? pitchAmount * 0.5
      : 0;
  }

  player.targetPitch = targetPitch;

  // Smooth transition - clamped lerp factor
  const tiltLerpFactor = Math.min(1, TILT_SPEED * deltaTime);
  player.currentPitch +=
    (player.targetPitch - player.currentPitch) * tiltLerpFactor;
}

/**
 * Apply calculated transformations to the ship model
 * @param {Group} ship - The ship model
 */
function applyTransforms(ship) {
  // Apply forward movement (reuse vector)
  if (player.velocity !== 0) {
    _movementDir
      .set(0, 0, -1)
      .applyQuaternion(player.orientation)
      .normalize()
      .multiplyScalar(player.velocity);

    ship.position.add(_movementDir);
  }

  // Apply vertical movement
  if (player.verticalVelocity !== 0) {
    ship.position.y += player.verticalVelocity;
  }

  // Enforce height limits - fast min/max clamping
  ship.position.y = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, ship.position.y));

  // Apply orientation efficiently
  _euler.setFromQuaternion(player.orientation, "YXZ");
  ship.quaternion.setFromEuler(
    _euler.set(player.currentPitch, _euler.y, 0, "YXZ")
  );
}

/**
 * Smooth orientation reset animation
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateOrientationReset(deltaTime) {
  const ship = player.model;
  const resetSpeed = RESET_SPEED * deltaTime;

  // Get level orientation (only Y rotation)
  _euler.setFromQuaternion(player.orientation, "YXZ");
  _quat.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));

  // Smoothly interpolate to level orientation
  player.orientation.slerp(_quat, resetSpeed);
  ship.quaternion.setFromEuler(
    _euler.set(player.currentPitch, _euler.y, 0, "YXZ")
  );

  // Reset pitch gradually
  player.currentPitch *= 1 - resetSpeed;

  // Check if reset is complete (single comparison)
  if (Math.abs(player.currentPitch) < 0.01) {
    player.resetInProgress = false;
    player.currentPitch = 0;
    ship.quaternion.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));
    player.direction = getDirection(_euler.y);
  }
}

/**
 * Reset ship orientation to level
 */
export function resetOrientation() {
  if (!player.model) return;
  player.resetInProgress = true;
  player.turnRate = 0;
}

/**
 * Update camera position relative to player
 * @param {Camera} camera - Three.js camera
 */
export function updateCamera(camera) {
  const ship = player.model;
  if (!ship || !camera) return;

  // Get ship forward direction using pre-allocated vector
  _movementDir.set(0, 0, -1).applyQuaternion(player.orientation).normalize();

  // Position camera behind ship (reuse vectors)
  _camOffset.copy(_movementDir).multiplyScalar(-CAMERA_DISTANCE);
  camera.position
    .copy(ship.position)
    .add(_camOffset)
    .add(_v3.set(0, CAMERA_HEIGHT, 0));

  // Look ahead of ship
  _v3.copy(ship.position).add(_movementDir.multiplyScalar(CAMERA_LOOK_AHEAD));
  camera.lookAt(_v3);
}

/**
 * Get the current height of the airship
 * @return {number} Current height above ground
 */
export function getCurrentHeight() {
  return player.model ? player.model.position.y : MIN_HEIGHT;
}

/**
 * Get the height limits of the airship
 * @return {Object} Object containing min and max height values
 */
export function getHeightLimits() {
  return {
    min: MIN_HEIGHT,
    max: MAX_HEIGHT,
  };
}

/**
 * Clean up event listeners
 */
export function disposePlayerControls() {
  window.removeEventListener("keydown", handleKeyDown, false);
  window.removeEventListener("keyup", handleKeyUp, false);
}

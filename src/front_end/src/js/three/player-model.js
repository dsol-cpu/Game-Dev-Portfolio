/**
 * @fileoverview Player model and controls implementation
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshPhongMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "../extern/three/three.module.min.js";

// Control state
let playerControls = null;
let playerModel = null;
let playerHeight = 10; // Default starting height

// Player movement settings - SPEEDS DEFINED AS PER-SECOND RATES
const SHIP = {
  MAX_SPEED: 12.0, // Units per second
  ACCELERATION: 0.6, // Units per second squared
  DECELERATION: 0.5, // Units per second squared
  ROTATION_SPEED: 3.0, // Radians per second
  VERTICAL_MAX_SPEED: 9.0, // Units per second
  VERTICAL_ACCELERATION: 0.5, // Units per second squared
  VERTICAL_DECELERATION: 0.4, // Units per second squared
  TILT_AMOUNT: Math.PI / 24, // Amount of tilt for pitch adjustments
  TILT_SPEED: 6.0, // Speed of tilt transitions per second
  ORIENTATION_RESET_SPEED: 6.0, // Speed for resetting orientation per second
};

// Height constraints
const HEIGHT = {
  MIN: 1, // Minimum flying height
  MAX: 50, // Maximum flying height
};

// Control keys that should prevent default browser behavior
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
  "ControlLeft",
  "ControlRight",
];

/**
 * Create a spaceship model
 * @returns {Group} Spaceship mesh
 */
function createShipModel() {
  const shipGroup = new Group();

  // Ship body
  const bodyGeometry = new CylinderGeometry(0.2, 0.5, 2, 8);
  const bodyMaterial = new MeshPhongMaterial({
    color: 0x3366cc,
    shininess: 100,
    specular: 0x111111,
  });
  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.position.set(0, 0, 0);
  body.rotation.x = Math.PI / 2;
  shipGroup.add(body);

  // Cockpit
  const cockpitGeometry = new SphereGeometry(
    0.3,
    16,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  const cockpitMaterial = new MeshPhongMaterial({
    color: 0x66ccff,
    shininess: 120,
    opacity: 0.7,
    transparent: true,
  });
  const cockpit = new Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.set(0, 0, -0.7);
  cockpit.rotation.x = -Math.PI / 2;
  shipGroup.add(cockpit);

  // Wings
  const wingGeometry = new BoxGeometry(1.6, 0.1, 0.6);
  const wingMaterial = new MeshPhongMaterial({ color: 0x2255aa });
  const wings = new Mesh(wingGeometry, wingMaterial);
  wings.position.set(0, 0, 0.2);
  shipGroup.add(wings);

  // Engines
  const engineGeometry = new CylinderGeometry(0.15, 0.15, 0.3, 8);
  const engineMaterial = new MeshPhongMaterial({ color: 0x555555 });

  // Left engine
  const leftEngine = new Mesh(engineGeometry, engineMaterial);
  leftEngine.position.set(-0.5, 0, 0.5);
  leftEngine.rotation.x = Math.PI / 2;
  shipGroup.add(leftEngine);

  // Right engine
  const rightEngine = new Mesh(engineGeometry, engineMaterial);
  rightEngine.position.set(0.5, 0, 0.5);
  rightEngine.rotation.x = Math.PI / 2;
  shipGroup.add(rightEngine);

  // Engine glow
  const glowGeometry = new ConeGeometry(0.1, 0.4, 8);
  const glowMaterial = new MeshPhongMaterial({
    color: 0xff7700,
    emissive: 0xff5500,
    transparent: true,
    opacity: 0.8,
  });

  // Left engine glow
  const leftGlow = new Mesh(glowGeometry, glowMaterial);
  leftGlow.position.set(-0.5, 0, 0.8);
  leftGlow.rotation.x = -Math.PI / 2;
  shipGroup.add(leftGlow);

  // Right engine glow
  const rightGlow = new Mesh(glowGeometry, glowMaterial);
  rightGlow.position.set(0.5, 0, 0.8);
  rightGlow.rotation.x = -Math.PI / 2;
  shipGroup.add(rightGlow);

  // Set initial position (adjust as needed)
  shipGroup.position.set(0, HEIGHT.MIN, 0);

  return shipGroup;
}

/**
 * Create player model
 * @returns {Group} Player model group
 */
export function createPlayerModel() {
  playerModel = createShipModel();
  return playerModel;
}

/**
 * Get player model instance
 * @returns {Group} Player model
 */
export function getPlayerModel() {
  return playerModel;
}

/**
 * Set player height
 * @param {number} height - Height value to set
 */
export function setPlayerHeight(height) {
  playerHeight = Math.max(HEIGHT.MIN, Math.min(HEIGHT.MAX, height));
}

/**
 * Get player height
 * @returns {number} Current player height
 */
export function getPlayerHeight() {
  return playerHeight;
}

/**
 * Get the level orientation from a quaternion (keeping only Y rotation)
 * @param {Quaternion} quaternion - Current quaternion
 * @returns {Quaternion} Level orientation quaternion
 */
function getLevelOrientation(quaternion) {
  const euler = new Euler().setFromQuaternion(quaternion, "YXZ");
  return new Quaternion().setFromEuler(new Euler(0, euler.y, 0, "YXZ"));
}

/**
 * Calculate cardinal direction from rotation
 * @param {number} rotation - Y rotation in radians
 * @returns {string} Cardinal direction (N, NE, E, etc.)
 */
function calculateCardinalDirection(rotation) {
  // Normalize rotation to 0-2π range
  const normalized = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Convert to degrees (0-360)
  let degrees = (normalized * 180) / Math.PI;

  // Map degrees to compass directions based on Three.js coordinate system
  if (degrees >= 0 && degrees < 22.5) return "S";
  if (degrees >= 22.5 && degrees < 67.5) return "SW";
  if (degrees >= 67.5 && degrees < 112.5) return "W";
  if (degrees >= 112.5 && degrees < 157.5) return "NW";
  if (degrees >= 157.5 && degrees < 202.5) return "N";
  if (degrees >= 202.5 && degrees < 247.5) return "NE";
  if (degrees >= 247.5 && degrees < 292.5) return "E";
  if (degrees >= 292.5 && degrees < 337.5) return "SE";
  if (degrees >= 337.5 && degrees <= 360) return "S";

  return "S"; // Default fallback
}

/**
 * Initialize player controls
 */
export function initPlayerControls() {
  // Control state
  const controls = {
    keysPressed: {},
    currentVelocity: 0,
    currentVerticalVelocity: 0,
    currentTurnRate: 0,
    targetPitch: 0,
    currentPitch: 0,
    shipYawRotation: new Quaternion(),
    resetOrientationInProgress: false,
    originalOrientation: new Quaternion(),
    cardinalDirection: "N",
    lastPosition: null,
    speedMultiplier: 1.0,
    mobileMovementX: 0,
    mobileMovementY: 0,
    mobileAltitudeChange: 0,
    isArrived: false,
    lastHoverOffset: 0,
    lastTime: performance.now(), // Track time for hover effect
  };
  // Add keyboard event listeners
  const handleKeyDown = (e) => {
    if (CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();

      // Prevent browser shortcuts with modifiers
      if (
        (e.ctrlKey || e.metaKey) &&
        ["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)
      ) {
        e.stopPropagation();
        return false;
      }
    }

    controls.keysPressed[e.code] = true;
  };

  const handleKeyUp = (e) => {
    if (CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();
    }

    controls.keysPressed[e.code] = false;
  };

  const preventBrowserShortcuts = (e) => {
    if (e.type === "contextmenu") {
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  document.addEventListener("keydown", preventBrowserShortcuts, true);
  document.addEventListener("keyup", preventBrowserShortcuts, true);
  document.addEventListener("contextmenu", preventBrowserShortcuts);

  // Set up update methods
  playerControls = {
    ...controls,

    // Update methods
    update: (deltaTime) => updatePlayerMovement(deltaTime),
    updateCamera: (camera) => updateCamera(camera),
    startOrientationReset: () => startOrientationReset(),
    updateOrientationReset: (deltaTime) => updateOrientationReset(deltaTime),

    // Cleanup method
    dispose: () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("keydown", preventBrowserShortcuts, true);
      document.removeEventListener("keyup", preventBrowserShortcuts, true);
      document.removeEventListener("contextmenu", preventBrowserShortcuts);
    },
  };

  return playerControls;
}

/**
 * Update player's forward movement
 * @param {Object} controls - Player controls object
 * @param {Vector3} direction - Direction vector
 * @param {Vector3} moveVector - Movement vector to update
 * @param {number} deltaTime - Delta time in milliseconds
 */
function updateForwardMovement(controls, direction, moveVector, deltaTime) {
  const keys = controls.keysPressed;
  const speedMultiplier = controls.speedMultiplier;
  // Convert deltaTime to seconds for proper movement scale
  const deltaSeconds = deltaTime / 1000;

  // Apply rates based on deltaTime
  const maxSpeed = SHIP.MAX_SPEED * speedMultiplier * deltaSeconds;
  const acceleration = SHIP.ACCELERATION * speedMultiplier * deltaSeconds;
  const deceleration = SHIP.DECELERATION * speedMultiplier * deltaSeconds;

  const movingForward =
    keys["ArrowUp"] || keys["KeyW"] || controls.mobileMovementY > 0.2;
  const movingBackward =
    keys["ArrowDown"] || keys["KeyS"] || controls.mobileMovementY < -0.2;

  let velocity = controls.currentVelocity;

  if (movingForward) {
    const inputStrength = Math.max(
      keys["ArrowUp"] || keys["KeyW"] ? 1 : 0,
      controls.mobileMovementY > 0.2 ? controls.mobileMovementY : 0
    );
    velocity = Math.min(maxSpeed * inputStrength, velocity + acceleration);
  } else if (movingBackward) {
    const inputStrength = Math.max(
      keys["ArrowDown"] || keys["KeyS"] ? 1 : 0,
      controls.mobileMovementY < -0.2 ? -controls.mobileMovementY : 0
    );
    velocity = Math.max(-maxSpeed * inputStrength, velocity - acceleration);
  } else {
    // Apply deceleration
    velocity =
      Math.abs(velocity) < deceleration
        ? 0
        : velocity > 0
        ? velocity - deceleration
        : velocity + deceleration;
  }

  controls.currentVelocity = velocity;

  if (velocity !== 0) {
    moveVector.add(direction.clone().multiplyScalar(velocity));
  }
}
/**
 * Update player's vertical movement
 * @param {Object} controls - Player controls
 * @param {Group} shipObj - Ship object
 * @param {Vector3} moveVector - Movement vector to update
 * @param {number} deltaTime - Delta time in milliseconds
 */
function updateVerticalMovement(controls, shipObj, moveVector, deltaTime) {
  const keys = controls.keysPressed;
  const speedMultiplier = controls.speedMultiplier;
  // Convert deltaTime to seconds for proper movement scale
  const deltaSeconds = deltaTime / 1000;

  // Apply rates based on deltaTime
  const verticalMaxSpeed =
    SHIP.VERTICAL_MAX_SPEED * speedMultiplier * deltaSeconds;
  const verticalAcceleration =
    SHIP.VERTICAL_ACCELERATION * speedMultiplier * deltaSeconds;
  const verticalDeceleration =
    SHIP.VERTICAL_DECELERATION * speedMultiplier * deltaSeconds;

  const movingUp =
    (keys["Space"] || controls.mobileAltitudeChange > 0) &&
    shipObj.position.y < HEIGHT.MAX;
  const movingDown =
    (keys["ShiftLeft"] ||
      keys["ShiftRight"] ||
      controls.mobileAltitudeChange < 0) &&
    shipObj.position.y > HEIGHT.MIN;

  let verticalVelocity = controls.currentVerticalVelocity;

  if (movingUp) {
    verticalVelocity = Math.min(
      verticalMaxSpeed,
      verticalVelocity + verticalAcceleration
    );
    controls.targetPitch =
      controls.currentVelocity > 0
        ? SHIP.TILT_AMOUNT
        : controls.currentVelocity < 0
        ? -SHIP.TILT_AMOUNT
        : 0;
  } else if (movingDown) {
    verticalVelocity = Math.max(
      -verticalMaxSpeed,
      verticalVelocity - verticalAcceleration
    );
    controls.targetPitch =
      controls.currentVelocity > 0
        ? -SHIP.TILT_AMOUNT
        : controls.currentVelocity < 0
        ? SHIP.TILT_AMOUNT
        : 0;
  } else {
    verticalVelocity =
      Math.abs(verticalVelocity) < verticalDeceleration
        ? 0
        : verticalVelocity > 0
        ? verticalVelocity - verticalDeceleration
        : verticalVelocity + verticalDeceleration;
    controls.targetPitch = 0;
  }

  // Enforce height limits
  if (
    (shipObj.position.y >= HEIGHT.MAX && verticalVelocity > 0) ||
    (shipObj.position.y <= HEIGHT.MIN && verticalVelocity < 0)
  ) {
    verticalVelocity = 0;
  }

  controls.currentVerticalVelocity = verticalVelocity;

  if (verticalVelocity !== 0) {
    const nextHeight = shipObj.position.y + verticalVelocity;
    moveVector.y =
      nextHeight > HEIGHT.MAX
        ? HEIGHT.MAX - shipObj.position.y
        : nextHeight < HEIGHT.MIN
        ? HEIGHT.MIN - shipObj.position.y
        : verticalVelocity;
  }
}

/**
 * Update player rotation
 * @param {Object} controls - Player controls
 * @param {Group} shipObj - Ship object
 * @param {number} deltaTime - Delta time in milliseconds
 */
function updateRotation(controls, shipObj, deltaTime) {
  const keys = controls.keysPressed;
  const speedMultiplier = controls.speedMultiplier;
  // Convert deltaTime to seconds for proper movement scale
  const deltaSeconds = deltaTime / 1000;

  // Apply rates based on deltaTime
  const turnAcceleration = 0.15 * speedMultiplier * deltaSeconds;
  const maxTurnRate = SHIP.ROTATION_SPEED * speedMultiplier * deltaSeconds;
  const turnDeceleration = 0.15 * speedMultiplier * deltaSeconds;

  const turningLeft =
    keys["ArrowLeft"] || keys["KeyA"] || controls.mobileMovementX < -0.2;
  const turningRight =
    keys["ArrowRight"] || keys["KeyD"] || controls.mobileMovementX > 0.2;

  let turnRate = controls.currentTurnRate;

  if (turningLeft) {
    const inputStrength = Math.max(
      keys["ArrowLeft"] || keys["KeyA"] ? 1 : 0,
      controls.mobileMovementX < -0.2 ? -controls.mobileMovementX : 0
    );
    turnRate = Math.min(
      maxTurnRate * inputStrength,
      turnRate + turnAcceleration
    );
  } else if (turningRight) {
    const inputStrength = Math.max(
      keys["ArrowRight"] || keys["KeyD"] ? 1 : 0,
      controls.mobileMovementX > 0.2 ? controls.mobileMovementX : 0
    );
    turnRate = Math.max(
      -maxTurnRate * inputStrength,
      turnRate - turnAcceleration
    );
  } else {
    turnRate =
      Math.abs(turnRate) < turnDeceleration
        ? 0
        : turnRate > 0
        ? turnRate - turnDeceleration
        : turnRate + turnDeceleration;
  }

  controls.currentTurnRate = turnRate;

  if (turnRate !== 0) {
    // If we're turning, we're no longer at the destination
    if (controls.isArrived) {
      controls.isArrived = false;
    }

    const rotationY = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      turnRate
    );
    shipObj.quaternion.premultiply(rotationY);
    controls.shipYawRotation.premultiply(rotationY);

    // Update cardinal direction when rotation changes
    controls.cardinalDirection = calculateCardinalDirection(shipObj.rotation.y);
  }
}

/**
 * Update ship tilt
 * @param {Object} controls - Player controls
 * @param {Group} shipObj - Ship object
 * @param {number} deltaTime - Delta time in milliseconds
 */
function updateShipTilt(controls, shipObj, deltaTime) {
  const speedMultiplier = controls.speedMultiplier;
  // Convert deltaTime to seconds for proper movement scale
  const deltaSeconds = deltaTime / 1000;

  const tiltSpeed = SHIP.TILT_SPEED * speedMultiplier * deltaSeconds;
  const newPitch =
    controls.currentPitch +
    (controls.targetPitch - controls.currentPitch) * tiltSpeed;
  controls.currentPitch = newPitch;

  const euler = new Euler().setFromQuaternion(controls.shipYawRotation, "YXZ");
  shipObj.quaternion.copy(
    new Quaternion().setFromEuler(new Euler(newPitch, euler.y, 0, "YXZ"))
  );
}

/**
 * Check if the ship has moved significantly
 * @param {Object} controls - Player controls
 * @param {Group} shipObj - Ship object
 */
function checkMovement(controls, shipObj) {
  const current = shipObj.position.clone();
  const last = controls.lastPosition;

  if (last) {
    // Calculate distance moved
    const distance = current.distanceTo(last);

    // If moved more than threshold and at a destination, update arrived state
    if (distance > 5 && controls.isArrived) {
      controls.isArrived = false;
    }
  }

  // Update last position
  controls.lastPosition = current;
}

/**
 * Update player movement based on input
 * @param {number} deltaTime - Time elapsed since last update in ms
 */
export function updatePlayerMovement(deltaTime) {
  if (!playerModel || !playerControls) return false;

  // Ensure we have a valid deltaTime (prevent jumps with extremely high values)
  deltaTime = Math.min(deltaTime, 100); // Cap at 100ms (10fps minimum)

  // Skip if orientation reset is in progress
  if (playerControls.resetOrientationInProgress) return false;

  // Get directional vectors
  const shipForward = new Vector3(0, 0, -1)
    .applyQuaternion(playerControls.shipYawRotation)
    .normalize();

  // Check if ship has moved from its last position
  checkMovement(playerControls, playerModel);

  // Initialize movement vector
  const moveVector = new Vector3(0, 0, 0);

  // Update forward/backward movement
  updateForwardMovement(playerControls, shipForward, moveVector, deltaTime);

  // Update vertical movement
  updateVerticalMovement(playerControls, playerModel, moveVector, deltaTime);

  // Update rotation
  updateRotation(playerControls, playerModel, deltaTime);

  // Apply position and tilt
  if (!moveVector.equals(new Vector3(0, 0, 0))) {
    playerModel.position.add(moveVector);
    setPlayerHeight(playerModel.position.y);

    // Ship has moved, update arrival state
    if (playerControls.isArrived) {
      playerControls.isArrived = false;
    }
  }

  // Update ship tilt
  updateShipTilt(playerControls, playerModel, deltaTime);

  // Update cardinal direction
  playerControls.cardinalDirection = calculateCardinalDirection(
    playerModel.rotation.y
  );

  // Add subtle hovering motion using proper time-based approach with smoother interpolation
  const currentTime = performance.now() / 1000; // Get current time in seconds
  const hoverAmount = 0.03; // Amplitude of hover
  const hoverFrequency = 0.5; // Slower oscillations per second for smoother effect

  // Calculate hover offset using smoothed sine wave
  const newHoverOffset =
    Math.sin(currentTime * hoverFrequency * Math.PI * 2) * hoverAmount;

  // Get the base height without hover effect from last frame
  const baseHeight = playerModel.position.y - playerControls.lastHoverOffset;

  // Apply new hover offset
  playerModel.position.y = baseHeight + newHoverOffset;

  // Store the current hover offset for next frame
  playerControls.lastHoverOffset = newHoverOffset;

  return true;
}

/**
 * Start orientation reset process
 */
export function startOrientationReset() {
  if (!playerModel || !playerControls) return;

  playerControls.resetOrientationInProgress = true;
  playerControls.originalOrientation = playerModel.quaternion.clone();
  playerControls.currentTurnRate = 0;
}

/**
 * Update orientation reset process
 * @param {number} deltaTime - Delta time in milliseconds
 * @returns {boolean} True if reset is still in progress
 */
export function updateOrientationReset(deltaTime) {
  if (
    !playerModel ||
    !playerControls ||
    !playerControls.resetOrientationInProgress
  )
    return false;

  // Convert to seconds
  const deltaSeconds = deltaTime / 1000;

  const resetSpeed = SHIP.ORIENTATION_RESET_SPEED * deltaSeconds;

  const levelOrientation = getLevelOrientation(playerModel.quaternion);
  playerModel.quaternion.slerp(levelOrientation, resetSpeed);
  playerControls.shipYawRotation = levelOrientation.clone();

  if (playerModel.quaternion.angleTo(levelOrientation) < 0.01) {
    playerControls.resetOrientationInProgress = false;
    playerModel.quaternion.copy(levelOrientation);
    playerControls.shipYawRotation = levelOrientation.clone();
    playerControls.currentPitch = 0;
    playerControls.targetPitch = 0;

    // Update cardinal direction after reset
    playerControls.cardinalDirection = calculateCardinalDirection(
      playerModel.rotation.y
    );
  }

  return true;
}

/**
 * Update camera position relative to player
 * @param {Camera} camera - Three.js camera object
 */
export function updateCamera(camera) {
  if (!playerModel || !playerControls || !camera) return;

  // Set camera distance and height parameters
  const CAMERA = {
    DISTANCE: 5,
    HEIGHT: 2,
    LOOK_AHEAD: 3,
  };

  const useRotation = playerControls.resetOrientationInProgress
    ? playerModel.quaternion
    : playerControls.shipYawRotation;

  const shipForward = new Vector3(0, 0, -1)
    .applyQuaternion(useRotation)
    .normalize();

  const shipUp = new Vector3(0, 1, 0);

  camera.position.copy(
    playerModel.position
      .clone()
      .add(shipForward.clone().multiplyScalar(-CAMERA.DISTANCE))
      .add(shipUp.clone().multiplyScalar(CAMERA.HEIGHT))
  );

  camera.lookAt(
    playerModel.position
      .clone()
      .add(shipForward.clone().multiplyScalar(CAMERA.LOOK_AHEAD))
  );
}

/**
 * Set mobile movement input values
 * @param {number} x - Horizontal movement input (-1 to 1)
 * @param {number} y - Vertical movement input (-1 to 1)
 */
export function setMobileMovement(x, y) {
  if (!playerControls) return;

  playerControls.mobileMovementX = x;
  playerControls.mobileMovementY = y;
}

/**
 * Set mobile altitude change input
 * @param {number} change - Altitude change input (-1, 0, or 1)
 */
export function setMobileAltitudeChange(change) {
  if (!playerControls) return;

  playerControls.mobileAltitudeChange = change;

  // Reset arrival state if changing altitude while at destination
  if (change !== 0 && playerControls.isArrived) {
    playerControls.isArrived = false;
  }
}

/**
 * Clean up player controls
 */
export function disposePlayerControls() {
  if (playerControls?.dispose) {
    playerControls.dispose();
  }
  playerControls = null;
}

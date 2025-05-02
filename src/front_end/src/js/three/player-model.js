/**
 * @fileoverview Player model and controls implementation
 */

import {
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  Group,
  Vector3,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
} from "../extern/three/three.module.min.js";

// Control state
let playerControls = null;
let playerModel = null;
let playerHeight = 10; // Default starting height

// Player movement settings
const PLAYER = {
  MAX_SPEED: 0.2,
  ACCELERATION: 0.01,
  DECELERATION: 0.008,
  ROTATION_SPEED: 0.05,
  VERTICAL_MAX_SPEED: 0.15,
  VERTICAL_ACCELERATION: 0.008,
  VERTICAL_DECELERATION: 0.006,
};

// Height constraints
const HEIGHT = {
  MIN: 1, // Minimum flying height
  MAX: 50, // Maximum flying height
};

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

  // Update color based on height if needed
  // You could add code here to change the ship's appearance based on altitude
}

/**
 * Get player height
 * @returns {number} Current player height
 */
export function getPlayerHeight() {
  return playerHeight;
}

/**
 * Initialize player controls
 */
export function initPlayerControls() {
  // Control state
  const keysPressed = {};
  let currentVelocity = 0;
  let currentVerticalVelocity = 0;
  let currentTurnRate = 0;

  // Update player movement based on keyboard input
  playerControls = {
    keysPressed,
    update: (deltaTime) => updatePlayerMovement(deltaTime),
    currentVelocity: 0,
    currentVerticalVelocity: 0,
    currentTurnRate: 0,
    bankAngle: 0,
  };

  // Add keyboard event listeners
  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
  });
}

/**
 * Movement helper that implements acceleration and deceleration
 */
function applyMovementPhysics(
  current,
  isAccelerating,
  isDecelerating,
  maxSpeed,
  accel,
  decel,
  deltaTime
) {
  // Time scaling factor to ensure consistent movement speed
  const timeScale = deltaTime / 16.67; // 60fps as baseline

  if (isAccelerating) {
    return Math.min(maxSpeed, current + accel * timeScale);
  } else if (isDecelerating) {
    return Math.max(-maxSpeed, current - accel * timeScale);
  }
  // Apply deceleration when no input
  return Math.abs(current) < decel * timeScale
    ? 0
    : current + (current > 0 ? -decel : decel) * timeScale;
}

/**
 * Update player movement based on input
 * @param {number} deltaTime - Time elapsed since last update in ms
 */
export function updatePlayerMovement(deltaTime) {
  if (!playerModel || !playerControls) return;

  const keys = playerControls.keysPressed;

  // Get directional vectors
  const playerForward = new Vector3(0, 0, -1)
    .applyQuaternion(playerModel.quaternion)
    .normalize();
  const playerRight = new Vector3(1, 0, 0)
    .applyQuaternion(playerModel.quaternion)
    .normalize();

  // Initialize movement vector
  const moveVector = new Vector3(0, 0, 0);

  // Forward/backward movement (W/S)
  const movingForward = keys["KeyW"] || keys["ArrowUp"];
  const movingBackward = keys["KeyS"] || keys["ArrowDown"];

  // Calculate velocity with acceleration/deceleration
  let currentVelocity = applyMovementPhysics(
    playerControls.currentVelocity || 0,
    movingForward,
    movingBackward,
    PLAYER.MAX_SPEED,
    PLAYER.ACCELERATION,
    PLAYER.DECELERATION,
    deltaTime
  );

  // Store updated velocity
  playerControls.currentVelocity = currentVelocity;

  // Apply forward/backward movement
  if (currentVelocity !== 0) {
    moveVector.add(playerForward.clone().multiplyScalar(currentVelocity));
  }

  // Left/right rotation (A/D)
  const turningLeft = keys["KeyA"] || keys["ArrowLeft"];
  const turningRight = keys["KeyD"] || keys["ArrowRight"];

  // Calculate turn rate with direct control instead of physics
  // This ensures more responsive turning without accumulation issues
  const turnSpeed = PLAYER.ROTATION_SPEED;
  let currentTurnRate = 0;

  if (turningLeft) {
    currentTurnRate = turnSpeed;
  } else if (turningRight) {
    currentTurnRate = -turnSpeed;
  }

  // Store the current turn rate for reference
  playerControls.currentTurnRate = currentTurnRate;

  // Apply direct rotation if turning
  if (currentTurnRate !== 0) {
    // Apply rotation directly to the Y axis for unlimited turning
    playerModel.rotateY(currentTurnRate);
  }

  // Always maintain level flight (no roll)
  playerModel.rotation.z = 0;

  // Vertical movement (Space/Shift)
  const movingUp = keys["Space"] && playerModel.position.y < HEIGHT.MAX;
  const movingDown =
    (keys["ShiftLeft"] || keys["ShiftRight"]) &&
    playerModel.position.y > HEIGHT.MIN;

  // Calculate vertical velocity
  let currentVerticalVelocity = applyMovementPhysics(
    playerControls.currentVerticalVelocity || 0,
    movingUp,
    movingDown,
    PLAYER.VERTICAL_MAX_SPEED,
    PLAYER.VERTICAL_ACCELERATION,
    PLAYER.VERTICAL_DECELERATION,
    deltaTime
  );

  // Store updated vertical velocity
  playerControls.currentVerticalVelocity = currentVerticalVelocity;

  // Apply vertical movement
  if (currentVerticalVelocity !== 0) {
    // Calculate next position
    const nextHeight = playerModel.position.y + currentVerticalVelocity;

    // Check height limits and adjust movement
    if (nextHeight > HEIGHT.MAX) {
      moveVector.y = HEIGHT.MAX - playerModel.position.y;
      playerControls.currentVerticalVelocity = 0;
    } else if (nextHeight < HEIGHT.MIN) {
      moveVector.y = HEIGHT.MIN - playerModel.position.y;
      playerControls.currentVerticalVelocity = 0;
    } else {
      moveVector.y = currentVerticalVelocity;
    }

    // Pitch adjustment based on vertical movement
    const pitchFactor = 0.2;
    const targetPitch = currentVerticalVelocity * pitchFactor;
    const currentPitch = playerModel.rotation.x;

    // Smoothly adjust pitch
    playerModel.rotation.x = currentPitch + (targetPitch - currentPitch) * 0.1;
  } else {
    // Return to level pitch when not changing altitude
    playerModel.rotation.x *= 0.9;
  }

  // Apply final movement
  playerModel.position.add(moveVector);

  // Update stored height
  setPlayerHeight(playerModel.position.y);

  // Add subtle hovering motion to make the ship feel alive
  const hoverTime = Date.now() * 0.001;
  const hoverAmount = 0.01;
  playerModel.position.y += Math.sin(hoverTime * 2) * hoverAmount;

  // Return if movement was applied
  return moveVector.lengthSq() > 0;
}

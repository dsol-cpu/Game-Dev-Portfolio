/**
 * @fileoverview Memory-optimized compact player model and controls
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
import { handleUserInteraction } from "../user-interaction.js";

// Singleton state
const playerState = {
  model: null,
  controls: null,
  height: 10,
};

// Reusable objects to avoid allocations during updates
const _vector = new Vector3();
const _tempVector = new Vector3(); // Additional temp vector for operations
const _euler = new Euler();
const _quaternion = new Quaternion();

// Constants
const SHIP = {
  MAX_SPEED: 12.0,
  ACCELERATION: 0.6,
  DECELERATION: 0.5,
  ROTATION_SPEED: 3.0,
  VERTICAL_MAX_SPEED: 9.0,
  VERTICAL_ACCELERATION: 0.5,
  VERTICAL_DECELERATION: 0.4,
  TILT_AMOUNT: Math.PI / 24,
  TILT_SPEED: 6.0,
  ORIENTATION_RESET_SPEED: 6.0,
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
  "ControlLeft",
  "ControlRight",
];

// Pre-define cardinal directions array to avoid recreation
const CARDINAL_DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE", "S"];
const VEC_3_ZERO = new Vector3(0, 0, 0);
const MOBILE_MOVE_THRESHOLD = 0.2;

// Create materials only once and share them
const MATERIALS = {
  SHIP_BODY: new MeshPhongMaterial({
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

// Cache geometries to reuse them
const GEOMETRIES = {
  BODY: new CylinderGeometry(MOBILE_MOVE_THRESHOLD, 0.5, 2, 8),
  COCKPIT: new SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  WINGS: new BoxGeometry(1.6, 0.1, 0.6),
  ENGINE: new CylinderGeometry(0.15, 0.15, 0.3, 8),
  GLOW: new ConeGeometry(0.1, 0.4, 8),
};

/**
 * Calculate cardinal direction from rotation - optimized
 */
function calculateCardinalDirection(rotation) {
  const normalized = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return CARDINAL_DIRECTIONS[
    Math.floor(((normalized * 180) / Math.PI + 22.5) / 45) % 8
  ];
}

/**
 * Get level orientation (keeping only Y rotation)
 * Uses cached objects to avoid allocations
 */
function getLevelOrientation(quaternion) {
  _euler.setFromQuaternion(quaternion, "YXZ");
  return _quaternion.setFromEuler(new Euler(0, _euler.y, 0, "YXZ"));
}

// Create a spaceship model - optimized for memory
export function createPlayerModel() {
  // Don't recreate if already exists
  if (playerState.model) return playerState.model;

  const shipGroup = new Group();

  // Ship body
  const body = new Mesh(GEOMETRIES.BODY, MATERIALS.SHIP_BODY);
  body.rotation.x = Math.PI / 2;

  // Cockpit
  const cockpit = new Mesh(GEOMETRIES.COCKPIT, MATERIALS.COCKPIT);
  cockpit.position.set(0, 0, -0.7);
  cockpit.rotation.x = -Math.PI / 2;

  // Wings
  const wings = new Mesh(GEOMETRIES.WINGS, MATERIALS.WINGS);
  wings.position.z = MOBILE_MOVE_THRESHOLD;

  // Create engines and glow
  const createEngine = (x) => {
    const engine = new Mesh(GEOMETRIES.ENGINE, MATERIALS.ENGINE);
    engine.position.set(x, 0, 0.5);
    engine.rotation.x = Math.PI / 2;

    const glow = new Mesh(GEOMETRIES.GLOW, MATERIALS.GLOW);
    glow.position.set(x, 0, 0.8);
    glow.rotation.x = -Math.PI / 2;

    shipGroup.add(engine, glow);
  };

  createEngine(-0.5);
  createEngine(0.5);

  shipGroup.add(body, cockpit, wings);
  shipGroup.position.set(0, HEIGHT.MIN, 0);

  playerState.model = shipGroup;
  return playerState.model;
}

export function getPlayerModel() {
  return playerState.model;
}

export function setPlayerHeight(height) {
  playerState.height = Math.max(HEIGHT.MIN, Math.min(HEIGHT.MAX, height));
}

export function getPlayerHeight() {
  return playerState.height;
}

// Event handlers - defined outside to avoid recreation
const gameControlHandlers = {
  keyDown: null,
  keyUp: null,
  preventDefaults: null,
};

export function initPlayerControls() {
  // Clean up existing handlers
  disposePlayerControls();

  // Base controls object - reuse if possible
  const controls = playerState.controls || {
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
    speedMultiplier: 2.0,
    mobileMovementX: 0,
    mobileMovementY: 0,
    mobileAltitudeChange: 0,
    isArrived: false,
    lastHoverOffset: 0,
    lastHoverTime: performance.now() / 1000,
  };

  // Define handlers only once
  const isGameActive = () => window.isGameViewActive?.();

  gameControlHandlers.keyDown = (e) => {
    if (isGameActive() && CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();

      if (
        (e.ctrlKey || e.metaKey) &&
        ["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)
      ) {
        return false;
      }
      handleUserInteraction(e);
      controls.keysPressed[e.code] = true;
    }
  };

  gameControlHandlers.keyUp = (e) => {
    if (isGameActive() && CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      handleUserInteraction(e);
      controls.keysPressed[e.code] = false;
    }
  };

  gameControlHandlers.preventDefaults = (e) => {
    if (
      isGameActive() &&
      (e.type === "contextmenu" || CONTROL_KEYS.includes(e.code))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Add event listeners
  window.addEventListener("keydown", gameControlHandlers.keyDown, {
    capture: true,
  });
  window.addEventListener("keyup", gameControlHandlers.keyUp, {
    capture: true,
  });
  document.addEventListener("keydown", gameControlHandlers.preventDefaults, {
    capture: true,
  });
  document.addEventListener("keyup", gameControlHandlers.preventDefaults, {
    capture: true,
  });
  document.addEventListener("contextmenu", gameControlHandlers.preventDefaults);

  // Make canvas focusable
  const gameCanvas = document.getElementById("main-game-canvas");
  if (gameCanvas) {
    gameCanvas.tabIndex = 1;
    gameCanvas.addEventListener("click", () => gameCanvas.focus());
  }

  // Methods object - simplified to avoid duplicating functions
  const controlMethods = {
    update: updatePlayerMovement,
    updateCamera,
    startOrientationReset,
    updateOrientationReset,
    getDebugInfo: () => ({
      keysPressed: Object.keys(controls.keysPressed).filter(
        (key) => controls.keysPressed[key]
      ),
      velocity: controls.currentVelocity,
      verticalVelocity: controls.currentVerticalVelocity,
      turnRate: controls.currentTurnRate,
      position: playerState.model
        ? [
            playerState.model.position.x,
            playerState.model.position.y,
            playerState.model.position.z,
          ]
        : null,
      direction: controls.cardinalDirection,
    }),
  };

  // Store the combined object
  playerState.controls = Object.assign(controls, controlMethods);
  return playerState.controls;
}

export function updatePlayerMovement(deltaTime) {
  const model = playerState.model;
  const controls = playerState.controls;

  if (!model || !controls) return false;
  if (window.isGameViewActive && !window.isGameViewActive()) return false;
  if (controls.resetOrientationInProgress) return false;

  // Reuse cached _vector for ship forward direction instead of creating new
  const shipForward = _vector
    .set(0, 0, -1)
    .applyQuaternion(controls.shipYawRotation)
    .normalize();

  if (controls.lastPosition) {
    if (
      model.position.distanceTo(controls.lastPosition) > 5 &&
      controls.isArrived
    ) {
      controls.isArrived = false;
    }
  } else {
    controls.lastPosition = new Vector3();
  }
  controls.lastPosition.copy(model.position);

  // Create a movement vector to store all changes
  const moveVector = new Vector3(0, 0, 0);
  const keys = controls.keysPressed;
  const speedMult = controls.speedMultiplier;

  // Process different movement types
  processForwardMovement(keys, speedMult, deltaTime, moveVector, shipForward);
  processVerticalMovement(keys, speedMult, deltaTime, moveVector);
  processTurning(keys, speedMult, deltaTime);

  // Apply position change
  if (!moveVector.equals(VEC_3_ZERO)) {
    model.position.add(moveVector);
    setPlayerHeight(model.position.y);
    if (controls.isArrived) controls.isArrived = false;
  }

  // Update ship tilt
  updateShipTilt(speedMult, deltaTime);

  // Add hover effect with delta time
  applyHoverEffect(deltaTime);

  return true;
}

function processForwardMovement(
  keys,
  speedMult,
  deltaTime,
  moveVector,
  shipForward
) {
  const controls = playerState.controls;
  const maxSpeed = SHIP.MAX_SPEED * speedMult * deltaTime;
  const acceleration = SHIP.ACCELERATION * speedMult * deltaTime;
  const deceleration = SHIP.DECELERATION * speedMult * deltaTime;

  const movingForward =
    keys["ArrowUp"] ||
    keys["KeyW"] ||
    controls.mobileMovementY > MOBILE_MOVE_THRESHOLD;
  const movingBackward =
    keys["ArrowDown"] ||
    keys["KeyS"] ||
    controls.mobileMovementY < -MOBILE_MOVE_THRESHOLD;

  let velocity = controls.currentVelocity;
  if (movingForward) {
    const inputStrength = Math.max(
      keys["ArrowUp"] || keys["KeyW"] ? 1 : 0,
      controls.mobileMovementY > MOBILE_MOVE_THRESHOLD
        ? controls.mobileMovementY
        : 0
    );
    velocity = Math.min(maxSpeed * inputStrength, velocity + acceleration);
  } else if (movingBackward) {
    const inputStrength = Math.max(
      keys["ArrowDown"] || keys["KeyS"] ? 1 : 0,
      controls.mobileMovementY < -MOBILE_MOVE_THRESHOLD
        ? -controls.mobileMovementY
        : 0
    );
    velocity = Math.max(-maxSpeed * inputStrength, velocity - acceleration);
  } else {
    velocity =
      Math.abs(velocity) < deceleration
        ? 0
        : velocity > 0
        ? velocity - deceleration
        : velocity + deceleration;
  }

  controls.currentVelocity = velocity;
  if (velocity !== 0) {
    // Use _tempVector for calculations to avoid creating new objects
    _tempVector.copy(shipForward).multiplyScalar(velocity);
    moveVector.add(_tempVector);
  }
}

function processVerticalMovement(keys, speedMult, deltaTime, moveVector) {
  const model = playerState.model;
  const controls = playerState.controls;

  const vertMaxSpeed = SHIP.VERTICAL_MAX_SPEED * speedMult * deltaTime;
  const vertAccel = SHIP.VERTICAL_ACCELERATION * speedMult * deltaTime;
  const vertDecel = SHIP.VERTICAL_DECELERATION * speedMult * deltaTime;

  const movingUp =
    (keys["Space"] || controls.mobileAltitudeChange > 0) &&
    model.position.y < HEIGHT.MAX;
  const movingDown =
    (keys["ShiftLeft"] ||
      keys["ShiftRight"] ||
      controls.mobileAltitudeChange < 0) &&
    model.position.y > HEIGHT.MIN;

  let vertVelocity = controls.currentVerticalVelocity;
  const velocity = controls.currentVelocity;

  if (movingUp) {
    vertVelocity = Math.min(vertMaxSpeed, vertVelocity + vertAccel);
    controls.targetPitch =
      velocity > 0 ? SHIP.TILT_AMOUNT : velocity < 0 ? -SHIP.TILT_AMOUNT : 0;
  } else if (movingDown) {
    vertVelocity = Math.max(-vertMaxSpeed, vertVelocity - vertAccel);
    controls.targetPitch =
      velocity > 0 ? -SHIP.TILT_AMOUNT : velocity < 0 ? SHIP.TILT_AMOUNT : 0;
  } else {
    vertVelocity =
      Math.abs(vertVelocity) < vertDecel
        ? 0
        : vertVelocity > 0
        ? vertVelocity - vertDecel
        : vertVelocity + vertDecel;
    controls.targetPitch = 0;
  }

  // Enforce height limits
  if (
    (model.position.y >= HEIGHT.MAX && vertVelocity > 0) ||
    (model.position.y <= HEIGHT.MIN && vertVelocity < 0)
  ) {
    vertVelocity = 0;
  }

  controls.currentVerticalVelocity = vertVelocity;

  if (vertVelocity !== 0) {
    const nextHeight = model.position.y + vertVelocity;
    moveVector.y =
      nextHeight > HEIGHT.MAX
        ? HEIGHT.MAX - model.position.y
        : nextHeight < HEIGHT.MIN
        ? HEIGHT.MIN - model.position.y
        : vertVelocity;
  }
}

function processTurning(keys, speedMult, deltaTime) {
  const model = playerState.model;
  const controls = playerState.controls;

  const turnAccel = 0.15 * speedMult * deltaTime;
  const maxTurnRate = SHIP.ROTATION_SPEED * speedMult * deltaTime;
  const turnDecel = 0.15 * speedMult * deltaTime;

  const turningLeft =
    keys["ArrowLeft"] ||
    keys["KeyA"] ||
    controls.mobileMovementX < -MOBILE_MOVE_THRESHOLD;
  const turningRight =
    keys["ArrowRight"] ||
    keys["KeyD"] ||
    controls.mobileMovementX > MOBILE_MOVE_THRESHOLD;

  let turnRate = controls.currentTurnRate;

  if (turningLeft) {
    const inputStrength = Math.max(
      keys["ArrowLeft"] || keys["KeyA"] ? 1 : 0,
      controls.mobileMovementX < -MOBILE_MOVE_THRESHOLD
        ? -controls.mobileMovementX
        : 0
    );
    turnRate = Math.min(maxTurnRate * inputStrength, turnRate + turnAccel);
  } else if (turningRight) {
    const inputStrength = Math.max(
      keys["ArrowRight"] || keys["KeyD"] ? 1 : 0,
      controls.mobileMovementX > MOBILE_MOVE_THRESHOLD
        ? controls.mobileMovementX
        : 0
    );
    turnRate = Math.max(-maxTurnRate * inputStrength, turnRate - turnAccel);
  } else {
    turnRate =
      Math.abs(turnRate) < turnDecel
        ? 0
        : turnRate > 0
        ? turnRate - turnDecel
        : turnRate + turnDecel;
  }

  controls.currentTurnRate = turnRate;

  if (turnRate !== 0) {
    if (controls.isArrived) controls.isArrived = false;

    // Reuse quaternion instead of creating new
    _quaternion.setFromAxisAngle(new Vector3(0, 1, 0), turnRate);
    model.quaternion.premultiply(_quaternion);
    controls.shipYawRotation.premultiply(_quaternion);
    controls.cardinalDirection = calculateCardinalDirection(model.rotation.y);
  }
}

function updateShipTilt(speedMult, deltaTime) {
  const model = playerState.model;
  const controls = playerState.controls;

  const tiltSpeed = SHIP.TILT_SPEED * speedMult * deltaTime;
  const newPitch =
    controls.currentPitch +
    (controls.targetPitch - controls.currentPitch) * tiltSpeed;
  controls.currentPitch = newPitch;

  // Reuse euler variable instead of creating new
  _euler.setFromQuaternion(controls.shipYawRotation, "YXZ");
  model.quaternion.setFromEuler(new Euler(newPitch, _euler.y, 0, "YXZ"));

  // Update cardinal direction
  controls.cardinalDirection = calculateCardinalDirection(model.rotation.y);
}

function applyHoverEffect(deltaTime) {
  const model = playerState.model;
  const controls = playerState.controls;

  // Use delta time for consistent hover effect regardless of frame rate
  const currentTime = performance.now() / 1000;
  const timeDelta = currentTime - controls.lastHoverTime;
  controls.lastHoverTime = currentTime;

  // Calculate hover with delta time to ensure consistent speed
  const hoverSpeed = 0.5 * Math.PI * 2; // Complete cycle every 2 seconds
  const hoverPhase = (currentTime * hoverSpeed) % (Math.PI * 2);
  const newHoverOffset = Math.sin(hoverPhase) * 0.03;

  // Get base height without hover effect
  const baseHeight = model.position.y - controls.lastHoverOffset;

  // Apply new hover offset
  model.position.y = baseHeight + newHoverOffset;
  controls.lastHoverOffset = newHoverOffset;
}

export function startOrientationReset() {
  const model = playerState.model;
  const controls = playerState.controls;

  if (!model || !controls) return;

  controls.resetOrientationInProgress = true;
  controls.originalOrientation.copy(model.quaternion);
  controls.currentTurnRate = 0;
}

export function updateOrientationReset(deltaTime) {
  const model = playerState.model;
  const controls = playerState.controls;

  if (!model || !controls?.resetOrientationInProgress) return false;

  const resetSpeed = SHIP.ORIENTATION_RESET_SPEED * (deltaTime / 1000);

  // Use shared quaternion instead of creating a new one
  getLevelOrientation(model.quaternion);
  const levelOrientation = _quaternion;

  model.quaternion.slerp(levelOrientation, resetSpeed);
  controls.shipYawRotation.copy(levelOrientation);

  if (model.quaternion.angleTo(levelOrientation) < 0.01) {
    controls.resetOrientationInProgress = false;
    model.quaternion.copy(levelOrientation);
    controls.shipYawRotation.copy(levelOrientation);
    controls.currentPitch = 0;
    controls.targetPitch = 0;
    controls.cardinalDirection = calculateCardinalDirection(model.rotation.y);
  }

  return true;
}

export function updateCamera(camera) {
  const model = playerState.model;
  const controls = playerState.controls;

  if (!model || !controls || !camera) return;

  const useRotation = controls.resetOrientationInProgress
    ? model.quaternion
    : controls.shipYawRotation;

  // Reuse vectors instead of creating new ones
  _vector.set(0, 0, -1).applyQuaternion(useRotation).normalize();
  const shipForward = _vector;

  // Calculate camera position
  camera.position
    .copy(model.position)
    .add(shipForward.clone().multiplyScalar(-CAMERA.DISTANCE))
    .add(new Vector3(0, CAMERA.HEIGHT, 0));

  // Calculate look target
  _vector
    .copy(model.position)
    .add(shipForward.multiplyScalar(CAMERA.LOOK_AHEAD));
  camera.lookAt(_vector);
}

export function setMobileMovement(x, y) {
  if (!playerState.controls) return;
  playerState.controls.mobileMovementX = x;
  playerState.controls.mobileMovementY = y;
}

export function setMobileAltitudeChange(change) {
  if (!playerState.controls) return;
  playerState.controls.mobileAltitudeChange = change;
  if (change !== 0 && playerState.controls.isArrived) {
    playerState.controls.isArrived = false;
  }
}

export function disposePlayerControls() {
  if (!playerState.controls) return;

  // Remove event listeners
  if (gameControlHandlers.keyDown) {
    window.removeEventListener("keydown", gameControlHandlers.keyDown, {
      capture: true,
    });
    window.removeEventListener("keyup", gameControlHandlers.keyUp, {
      capture: true,
    });
    document.removeEventListener(
      "keydown",
      gameControlHandlers.preventDefaults,
      { capture: true }
    );
    document.removeEventListener("keyup", gameControlHandlers.preventDefaults, {
      capture: true,
    });
    document.removeEventListener(
      "contextmenu",
      gameControlHandlers.preventDefaults
    );
  }
}

export function updatePlayer(deltaTime) {
  if (playerState.controls) {
    playerState.controls.resetOrientationInProgress
      ? updateOrientationReset(deltaTime)
      : updatePlayerMovement(deltaTime);
  }
}

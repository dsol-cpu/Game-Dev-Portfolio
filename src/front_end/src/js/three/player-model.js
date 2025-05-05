/**
 * @fileoverview Optimized compact player model and controls - Fixed version
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

// State
let playerControls = null;
let playerModel = null;
let playerHeight = 10;

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

/**
 * Calculate cardinal direction from rotation
 */
function calculateCardinalDirection(rotation) {
  const normalized = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const directions = ["S", "SW", "W", "NW", "N", "NE", "E", "SE", "S"];
  return directions[Math.floor(((normalized * 180) / Math.PI + 22.5) / 45) % 8];
}

/**
 * Get level orientation (keeping only Y rotation)
 */
function getLevelOrientation(quaternion) {
  const euler = new Euler().setFromQuaternion(quaternion, "YXZ");
  return new Quaternion().setFromEuler(new Euler(0, euler.y, 0, "YXZ"));
}

// Create a spaceship model
export function createPlayerModel() {
  const shipGroup = new Group();

  // Ship body
  const body = new Mesh(
    new CylinderGeometry(0.2, 0.5, 2, 8),
    MATERIALS.SHIP_BODY
  );
  body.rotation.x = Math.PI / 2;

  // Cockpit
  const cockpit = new Mesh(
    new SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    MATERIALS.COCKPIT
  );
  cockpit.position.set(0, 0, -0.7);
  cockpit.rotation.x = -Math.PI / 2;

  // Wings
  const wings = new Mesh(new BoxGeometry(1.6, 0.1, 0.6), MATERIALS.WINGS);
  wings.position.z = 0.2;

  // Engines and glow
  const engineGeometry = new CylinderGeometry(0.15, 0.15, 0.3, 8);
  const glowGeometry = new ConeGeometry(0.1, 0.4, 8);

  const createEngine = (x) => {
    const engine = new Mesh(engineGeometry, MATERIALS.ENGINE);
    engine.position.set(x, 0, 0.5);
    engine.rotation.x = Math.PI / 2;

    const glow = new Mesh(glowGeometry, MATERIALS.GLOW);
    glow.position.set(x, 0, 0.8);
    glow.rotation.x = -Math.PI / 2;

    return [engine, glow];
  };

  const [leftEngine, leftGlow] = createEngine(-0.5);
  const [rightEngine, rightGlow] = createEngine(0.5);

  shipGroup.add(
    body,
    cockpit,
    wings,
    leftEngine,
    rightEngine,
    leftGlow,
    rightGlow
  );
  shipGroup.position.set(0, HEIGHT.MIN, 0);

  playerModel = shipGroup;
  return playerModel;
}

export function getPlayerModel() {
  return playerModel;
}

export function setPlayerHeight(height) {
  playerHeight = Math.max(HEIGHT.MIN, Math.min(HEIGHT.MAX, height));
}

export function getPlayerHeight() {
  return playerHeight;
}

export function initPlayerControls() {
  // Clean up existing handlers
  if (window._gameControlsHandlers) {
    const handlers = window._gameControlsHandlers;
    window.removeEventListener("keydown", handlers.keyDown);
    window.removeEventListener("keyup", handlers.keyUp);
    document.removeEventListener("keydown", handlers.preventDefaults, {
      capture: true,
    });
    document.removeEventListener("keyup", handlers.preventDefaults, {
      capture: true,
    });
    document.removeEventListener("contextmenu", handlers.preventDefaults);
  }

  // Base controls object
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
    speedMultiplier: 2.0,
    mobileMovementX: 0,
    mobileMovementY: 0,
    mobileAltitudeChange: 0,
    isArrived: false,
    lastHoverOffset: 0,
    lastHoverTime: performance.now() / 1000, // Added to track hover time consistently
  };

  // Event handlers
  const isGameActive = () => window.isGameViewActive?.();

  const handleKeyDown = (e) => {
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

  const handleKeyUp = (e) => {
    if (isGameActive() && CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      handleUserInteraction(e);
      controls.keysPressed[e.code] = false;
    }
  };

  const preventBrowserShortcuts = (e) => {
    if (
      isGameActive() &&
      (e.type === "contextmenu" || CONTROL_KEYS.includes(e.code))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Store handlers
  window._gameControlsHandlers = {
    keyDown: handleKeyDown,
    keyUp: handleKeyUp,
    preventDefaults: preventBrowserShortcuts,
  };

  // Add event listeners
  window.addEventListener("keydown", handleKeyDown, { capture: true });
  window.addEventListener("keyup", handleKeyUp, { capture: true });
  document.addEventListener("keydown", preventBrowserShortcuts, {
    capture: true,
  });
  document.addEventListener("keyup", preventBrowserShortcuts, {
    capture: true,
  });
  document.addEventListener("contextmenu", preventBrowserShortcuts);

  // Make canvas focusable
  const gameCanvas = document.getElementById("main-game-canvas");
  if (gameCanvas) {
    gameCanvas.tabIndex = 1;
    gameCanvas.addEventListener("click", () => gameCanvas.focus());
  }

  // Build controls object with methods
  playerControls = {
    ...controls,
    update: (deltaTime) => updatePlayerMovement(deltaTime),
    updateCamera,
    startOrientationReset,
    updateOrientationReset: (deltaTime) => updateOrientationReset(deltaTime),
    getDebugInfo: () => ({
      keysPressed: Object.keys(controls.keysPressed).filter(
        (key) => controls.keysPressed[key]
      ),
      velocity: controls.currentVelocity,
      verticalVelocity: controls.currentVerticalVelocity,
      turnRate: controls.currentTurnRate,
      position: playerModel
        ? [
            playerModel.position.x,
            playerModel.position.y,
            playerModel.position.z,
          ]
        : null,
      direction: controls.cardinalDirection,
    }),
    dispose: () => {
      const handlers = window._gameControlsHandlers;
      window.removeEventListener("keydown", handlers.keyDown, {
        capture: true,
      });
      window.removeEventListener("keyup", handlers.keyUp, { capture: true });
      document.removeEventListener("keydown", handlers.preventDefaults, {
        capture: true,
      });
      document.removeEventListener("keyup", handlers.preventDefaults, {
        capture: true,
      });
      document.removeEventListener("contextmenu", handlers.preventDefaults);
    },
  };

  return playerControls;
}

export function updatePlayerMovement(deltaTime) {
  if (!playerModel || !playerControls) return false;
  if (window.isGameViewActive && !window.isGameViewActive()) return false;
  if (playerControls.resetOrientationInProgress) return false;

  // Get directional vector
  const shipForward = new Vector3(0, 0, -1)
    .applyQuaternion(playerControls.shipYawRotation)
    .normalize();

  if (playerControls.lastPosition) {
    const current = playerModel.position.clone();
    if (
      current.distanceTo(playerControls.lastPosition) > 5 &&
      playerControls.isArrived
    ) {
      playerControls.isArrived = false;
    }
  }
  playerControls.lastPosition = playerModel.position.clone();

  // Movement vector
  const moveVector = new Vector3(0, 0, 0);
  const keys = playerControls.keysPressed;
  const speedMult = playerControls.speedMultiplier;

  // Process different movement types
  processForwardMovement(keys, speedMult, deltaTime, moveVector, shipForward);
  processVerticalMovement(keys, speedMult, deltaTime, moveVector);
  processTurning(keys, speedMult, deltaTime); // Removed moveVector parameter to match original behavior

  // Apply position change
  if (!moveVector.equals(new Vector3(0, 0, 0))) {
    // Removed console.log to prevent performance spikes
    playerModel.position.add(moveVector);
    setPlayerHeight(playerModel.position.y);
    if (playerControls.isArrived) playerControls.isArrived = false;
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
  const maxSpeed = SHIP.MAX_SPEED * speedMult * deltaTime;
  const acceleration = SHIP.ACCELERATION * speedMult * deltaTime;
  const deceleration = SHIP.DECELERATION * speedMult * deltaTime;

  const movingForward =
    keys["ArrowUp"] || keys["KeyW"] || playerControls.mobileMovementY > 0.2;
  const movingBackward =
    keys["ArrowDown"] || keys["KeyS"] || playerControls.mobileMovementY < -0.2;

  let velocity = playerControls.currentVelocity;

  if (movingForward) {
    const inputStrength = Math.max(
      keys["ArrowUp"] || keys["KeyW"] ? 1 : 0,
      playerControls.mobileMovementY > 0.2 ? playerControls.mobileMovementY : 0
    );
    velocity = Math.min(maxSpeed * inputStrength, velocity + acceleration);
  } else if (movingBackward) {
    const inputStrength = Math.max(
      keys["ArrowDown"] || keys["KeyS"] ? 1 : 0,
      playerControls.mobileMovementY < -0.2
        ? -playerControls.mobileMovementY
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

  playerControls.currentVelocity = velocity;
  if (velocity !== 0) {
    moveVector.add(shipForward.clone().multiplyScalar(velocity));
  }
}

function processVerticalMovement(keys, speedMult, deltaTime, moveVector) {
  const vertMaxSpeed = SHIP.VERTICAL_MAX_SPEED * speedMult * deltaTime;
  const vertAccel = SHIP.VERTICAL_ACCELERATION * speedMult * deltaTime;
  const vertDecel = SHIP.VERTICAL_DECELERATION * speedMult * deltaTime;

  const movingUp =
    (keys["Space"] || playerControls.mobileAltitudeChange > 0) &&
    playerModel.position.y < HEIGHT.MAX;
  const movingDown =
    (keys["ShiftLeft"] ||
      keys["ShiftRight"] ||
      playerControls.mobileAltitudeChange < 0) &&
    playerModel.position.y > HEIGHT.MIN;

  let vertVelocity = playerControls.currentVerticalVelocity;
  const velocity = playerControls.currentVelocity;

  if (movingUp) {
    vertVelocity = Math.min(vertMaxSpeed, vertVelocity + vertAccel);
    playerControls.targetPitch =
      velocity > 0 ? SHIP.TILT_AMOUNT : velocity < 0 ? -SHIP.TILT_AMOUNT : 0;
  } else if (movingDown) {
    vertVelocity = Math.max(-vertMaxSpeed, vertVelocity - vertAccel);
    playerControls.targetPitch =
      velocity > 0 ? -SHIP.TILT_AMOUNT : velocity < 0 ? SHIP.TILT_AMOUNT : 0;
  } else {
    vertVelocity =
      Math.abs(vertVelocity) < vertDecel
        ? 0
        : vertVelocity > 0
        ? vertVelocity - vertDecel
        : vertVelocity + vertDecel;
    playerControls.targetPitch = 0;
  }

  // Enforce height limits
  if (
    (playerModel.position.y >= HEIGHT.MAX && vertVelocity > 0) ||
    (playerModel.position.y <= HEIGHT.MIN && vertVelocity < 0)
  ) {
    vertVelocity = 0;
  }

  playerControls.currentVerticalVelocity = vertVelocity;

  if (vertVelocity !== 0) {
    const nextHeight = playerModel.position.y + vertVelocity;
    moveVector.y =
      nextHeight > HEIGHT.MAX
        ? HEIGHT.MAX - playerModel.position.y
        : nextHeight < HEIGHT.MIN
        ? HEIGHT.MIN - playerModel.position.y
        : vertVelocity;
  }
}

function processTurning(keys, speedMult, deltaTime, moveVector, shipForward) {
  const turnAccel = 0.15 * speedMult * deltaTime;
  const maxTurnRate = SHIP.ROTATION_SPEED * speedMult * deltaTime;
  const turnDecel = 0.15 * speedMult * deltaTime;

  const turningLeft =
    keys["ArrowLeft"] || keys["KeyA"] || playerControls.mobileMovementX < -0.2;
  const turningRight =
    keys["ArrowRight"] || keys["KeyD"] || playerControls.mobileMovementX > 0.2;

  let turnRate = playerControls.currentTurnRate;

  if (turningLeft) {
    const inputStrength = Math.max(
      keys["ArrowLeft"] || keys["KeyA"] ? 1 : 0,
      playerControls.mobileMovementX < -0.2
        ? -playerControls.mobileMovementX
        : 0
    );
    turnRate = Math.min(maxTurnRate * inputStrength, turnRate + turnAccel);
  } else if (turningRight) {
    const inputStrength = Math.max(
      keys["ArrowRight"] || keys["KeyD"] ? 1 : 0,
      playerControls.mobileMovementX > 0.2 ? playerControls.mobileMovementX : 0
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

  playerControls.currentTurnRate = turnRate;

  if (turnRate !== 0) {
    if (playerControls.isArrived) playerControls.isArrived = false;

    const rotationY = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      turnRate
    );
    playerModel.quaternion.premultiply(rotationY);
    playerControls.shipYawRotation.premultiply(rotationY);
    playerControls.cardinalDirection = calculateCardinalDirection(
      playerModel.rotation.y
    );

    // Removed sideways movement during turning to match original behavior
  }
}

function updateShipTilt(speedMult, deltaTime) {
  const tiltSpeed = SHIP.TILT_SPEED * speedMult * deltaTime;
  const newPitch =
    playerControls.currentPitch +
    (playerControls.targetPitch - playerControls.currentPitch) * tiltSpeed;
  playerControls.currentPitch = newPitch;

  const euler = new Euler().setFromQuaternion(
    playerControls.shipYawRotation,
    "YXZ"
  );
  playerModel.quaternion.copy(
    new Quaternion().setFromEuler(new Euler(newPitch, euler.y, 0, "YXZ"))
  );

  // Update cardinal direction
  playerControls.cardinalDirection = calculateCardinalDirection(
    playerModel.rotation.y
  );
}

function applyHoverEffect(deltaTime) {
  // Use delta time for consistent hover effect regardless of frame rate
  const currentTime = performance.now() / 1000;
  const timeDelta = currentTime - playerControls.lastHoverTime;
  playerControls.lastHoverTime = currentTime;

  // Calculate hover with delta time to ensure consistent speed
  const hoverSpeed = 0.5 * Math.PI * 2; // Complete cycle every 2 seconds
  const hoverPhase = (currentTime * hoverSpeed) % (Math.PI * 2);
  const newHoverOffset = Math.sin(hoverPhase) * 0.03;

  // Get base height without hover effect
  const baseHeight = playerModel.position.y - playerControls.lastHoverOffset;

  // Apply new hover offset
  playerModel.position.y = baseHeight + newHoverOffset;
  playerControls.lastHoverOffset = newHoverOffset;
}

export function startOrientationReset() {
  if (!playerModel || !playerControls) return;

  playerControls.resetOrientationInProgress = true;
  playerControls.originalOrientation = playerModel.quaternion.clone();
  playerControls.currentTurnRate = 0;
}

export function updateOrientationReset(deltaTime) {
  if (!playerModel || !playerControls?.resetOrientationInProgress) return false;

  const resetSpeed = SHIP.ORIENTATION_RESET_SPEED * (deltaTime / 1000);
  const levelOrientation = getLevelOrientation(playerModel.quaternion);

  playerModel.quaternion.slerp(levelOrientation, resetSpeed);
  playerControls.shipYawRotation = levelOrientation.clone();

  if (playerModel.quaternion.angleTo(levelOrientation) < 0.01) {
    playerControls.resetOrientationInProgress = false;
    playerModel.quaternion.copy(levelOrientation);
    playerControls.shipYawRotation = levelOrientation.clone();
    playerControls.currentPitch = 0;
    playerControls.targetPitch = 0;
    playerControls.cardinalDirection = calculateCardinalDirection(
      playerModel.rotation.y
    );
  }

  return true;
}

export function updateCamera(camera) {
  if (!playerModel || !playerControls || !camera) return;

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

export function setMobileMovement(x, y) {
  if (!playerControls) return;
  playerControls.mobileMovementX = x;
  playerControls.mobileMovementY = y;
}

export function setMobileAltitudeChange(change) {
  if (!playerControls) return;
  playerControls.mobileAltitudeChange = change;
  if (change !== 0 && playerControls.isArrived) {
    playerControls.isArrived = false;
  }
}

export function disposePlayerControls() {
  if (playerControls?.dispose) playerControls.dispose();
  playerControls = null;
}

export function updatePlayer(deltaTime) {
  if (playerControls) {
    playerControls.resetOrientationInProgress
      ? updateOrientationReset(deltaTime)
      : updatePlayerMovement(deltaTime);
  }
}

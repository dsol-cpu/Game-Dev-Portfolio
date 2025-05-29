import {
  Euler,
  Quaternion,
  Vector3,
  Group,
  MeshPhongMaterial,
} from "../extern/three/three.module.min.js";
import { loadModel } from "./model.js";
import {
  isKeyPressed,
  areKeysPressed,
  isAnyKeyPressed,
  getMovementVector,
  isMovementActive,
  isHorizontalMovementActive,
  isVerticalMovementActive,
  isAscending,
  isDescending,
  getInputState,
} from "./input-manager.js";

// Reused objects for performance
const _v3 = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();
const _axisY = new Vector3(0, 1, 0);
const _dir = new Vector3(0, 0, -1);
const _cam = new Vector3();

// Movement constants
const MOVEMENT = {
  SPEED: 12,
  ACCELERATION: 1.2,
  DECELERATION: 0.5,
  TURN_SPEED: 3,
};

// Vertical movement constants
const VERTICAL = {
  MAX_SPEED: 9,
  ACCELERATION: 0.5,
  DECELERATION: 0.5,
};

// Height limits
const HEIGHT = {
  MIN: -50,
  MAX: 50,
};

// Ship orientation constants
const ORIENTATION = {
  TILT_ANGLE: Math.PI / 30, // How much the ship tilts during maneuvers
  TILT_SPEED: 3, // How fast tilt changes happen
  RESET_SPEED: 6, // How fast ship returns to level
  PITCH_ANGLE: Math.PI / 36, // Maximum pitch angle
};

// Camera constants
const CAMERA = {
  DISTANCE: 5, // Distance behind ship
  HEIGHT: 2, // Height above ship
  LOOK_AHEAD: 3, // How far ahead to look
};

// Direction lookup for compass display
const DIRS = Array.from(
  { length: 360 },
  (_, i) =>
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][(((i + 22.5) / 45) | 0) % 8]
);

// Ship materials for different parts
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

// Player state object
const player = {
  model: null,
  velocity_x: 0, // Forward/backward velocity
  velocity_y: 0, // Up/down velocity
  dir: "N", // Current compass direction
  pos: new Vector3(), // Current position
  quat: new Quaternion(), // Current rotation quaternion
  reset: false, // Whether ship is auto-leveling
  pitch: 0, // Current pitch angle
  tpitch: 0, // Target pitch angle
  clamped: false, // Whether vertical movement is clamped by height limits
};

// UI state for key indicators (separate from input processing)
let keyEls = {};
let keyUpdates = new Map();
let updateScheduled = false;

// Autopilot state flag
let isAutoPilotActive = false;

// Convert rotation to compass direction
export const getDirection = (rotation) =>
  DIRS[~~(((((-rotation * 180) / Math.PI) % 360) + 360) % 360)];

// Create and initialize the player ship model
export const createPlayerModel = async () => {
  if (player.model) return player.model;

  const shipModel = await loadModel("portfolioShip");

  if (!shipModel) {
    throw new Error("Portfolio ship model not found in cache");
  }

  const ship = new Group();
  shipModel.quaternion.identity();
  shipModel.scale.set(1, 1, 1);
  ship.add(shipModel);
  ship.position.set(0, HEIGHT.MIN, 0);

  player.quat = new Quaternion();
  ship.quaternion.copy(player.quat);
  player.model = ship;

  return ship;
};

// Schedule UI updates for key press indicators (visual feedback only)
const scheduleKeyVisualUpdate = (keyCode, isPressed) => {
  keyUpdates.set(keyCode, isPressed);

  if (updateScheduled) return;
  updateScheduled = true;

  requestAnimationFrame(() => {
    keyUpdates.forEach((active, key) => {
      const el = keyEls[key];
      if (el) el.classList.toggle("active", active);
    });
    keyUpdates.clear();
    updateScheduled = false;
  });
};

const getCurrentInputState = () => {
  if (isAutoPilotActive) {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
    };
  }

  const inputState = getInputState();
  const pressedKeys = inputState.pressedKeys || []; // Keep as array

  return {
    forward: pressedKeys.includes("KeyW") || pressedKeys.includes("ArrowUp"),
    backward: pressedKeys.includes("KeyS") || pressedKeys.includes("ArrowDown"),
    left: pressedKeys.includes("KeyA") || pressedKeys.includes("ArrowLeft"),
    right: pressedKeys.includes("KeyD") || pressedKeys.includes("ArrowRight"),
    up: pressedKeys.includes("Space"),
    down:
      pressedKeys.includes("ShiftLeft") || pressedKeys.includes("ShiftRight"),
  };
};

// Update visual key indicators based on current input state
const updateKeyVisuals = () => {
  const inputState = getCurrentInputState();

  // Map input states to visual key codes
  const keyMappings = {
    KeyW: inputState.forward,
    KeyS: inputState.backward,
    KeyA: inputState.left,
    KeyD: inputState.right,
    Space: inputState.up,
    ShiftLeft: inputState.down,
    ArrowUp: inputState.forward,
    ArrowDown: inputState.backward,
    ArrowLeft: inputState.left,
    ArrowRight: inputState.right,
  };

  // Update visuals for all mapped keys
  Object.entries(keyMappings).forEach(([keyCode, isActive]) => {
    scheduleKeyVisualUpdate(keyCode, isActive);
  });
};

// Initialize player controls - now uses input manager integration
export const initPlayerControls = () => {
  // Cache UI elements for key indicators
  document.querySelectorAll(".key[data-key]").forEach((el) => {
    keyEls[el.dataset.key] = el;
  });

  // Make canvas focusable for keyboard input (still useful for focus management)
  const canvas = document.getElementById("main-game-canvas");
  if (canvas) {
    canvas.tabIndex = 1;
    canvas.addEventListener("click", () => canvas.focus());
  }

  console.log("Player controls initialized with input manager integration");

  // Return cleanup function (now minimal since input manager handles events)
  return () => {
    keyEls = {};
    keyUpdates.clear();
    console.log("Player controls cleaned up");
  };
};

// Main player update function called each frame
export const updatePlayer = (deltaTime) => {
  const ship = player.model;
  if (!ship) return;

  // Cap deltaTime to prevent large jumps
  deltaTime = Math.min(deltaTime, 0.1);

  // Update visual key indicators
  updateKeyVisuals();

  if (player.reset) {
    updateReset(deltaTime, ship);
    return;
  }

  updateMovement(deltaTime, ship);
  player.pos.copy(ship.position);
};

// Update ship movement based on input manager state
const updateMovement = (deltaTime, ship) => {
  const inputState = getCurrentInputState();
  const currentHeight = ship.position.y;

  // Update horizontal velocity
  const forwardAccel = inputState.forward * MOVEMENT.ACCELERATION * deltaTime;
  const backwardAccel = inputState.backward * MOVEMENT.ACCELERATION * deltaTime;
  const deceleration = MOVEMENT.DECELERATION * deltaTime;

  player.velocity_x += forwardAccel - backwardAccel;
  player.velocity_x -=
    Math.sign(player.velocity_x) *
    Math.min(
      Math.abs(player.velocity_x),
      deceleration * !(forwardAccel || backwardAccel)
    );

  const maxSpeed = MOVEMENT.SPEED * deltaTime;
  player.velocity_x = Math.max(
    -maxSpeed,
    Math.min(maxSpeed, player.velocity_x)
  );

  // Update vertical velocity with height constraints
  const atMaxHeight = currentHeight >= HEIGHT.MAX;
  const atMinHeight = currentHeight <= HEIGHT.MIN;
  const canGoUp = !atMaxHeight && inputState.up;
  const canGoDown = !atMinHeight && inputState.down;

  const upAccel = canGoUp * VERTICAL.ACCELERATION * deltaTime;
  const downAccel = canGoDown * VERTICAL.ACCELERATION * deltaTime;
  const vertDecel = VERTICAL.DECELERATION * deltaTime;

  player.velocity_y += upAccel - downAccel;
  player.velocity_y -=
    Math.sign(player.velocity_y) *
    Math.min(Math.abs(player.velocity_y), vertDecel * !(upAccel || downAccel));

  const maxVertSpeed = VERTICAL.MAX_SPEED * deltaTime;
  player.velocity_y = Math.max(
    -maxVertSpeed,
    Math.min(maxVertSpeed, player.velocity_y)
  );

  // Clamp velocity at height limits
  const hitCeiling = atMaxHeight && player.velocity_y > 0;
  const hitFloor = atMinHeight && player.velocity_y < 0;
  player.velocity_y *= !(hitCeiling || hitFloor);
  player.clamped = hitCeiling || hitFloor;

  // Handle turning
  const turnAmount =
    (inputState.left - inputState.right) * MOVEMENT.TURN_SPEED * deltaTime;

  _quat.setFromAxisAngle(_axisY, turnAmount);
  player.quat.premultiply(_quat);

  // Calculate pitch based on movement state
  const forward = inputState.forward || player.velocity_x > 0;
  const backward = inputState.backward || player.velocity_x < 0;
  const up = inputState.up && !player.clamped;
  const down = inputState.down && !player.clamped;

  // Pitch calculation
  const pitchMultiplier =
    forward && down
      ? -1
      : forward && up
      ? 1
      : forward
      ? 0.3
      : backward && down
      ? 1
      : backward && up
      ? -1
      : backward
      ? -0.3
      : down
      ? 0.5
      : up
      ? -0.5
      : 0;

  player.tpitch = pitchMultiplier * ORIENTATION.PITCH_ANGLE;
  player.pitch +=
    (player.tpitch - player.pitch) *
    Math.min(1, ORIENTATION.TILT_SPEED * deltaTime);

  // Apply movement
  _dir
    .set(0, 0, -1)
    .applyQuaternion(player.quat)
    .normalize()
    .multiplyScalar(player.velocity_x);
  ship.position.add(_dir);
  ship.position.y = Math.max(
    HEIGHT.MIN,
    Math.min(HEIGHT.MAX, ship.position.y + player.velocity_y)
  );

  // Update rotation
  _euler.setFromQuaternion(player.quat, "YXZ");
  player.dir = getDirection(_euler.y);
  ship.quaternion.setFromEuler(_euler.set(player.pitch, _euler.y, 0, "YXZ"));
};

// Handle ship auto-leveling when reset is triggered
const updateReset = (deltaTime, ship) => {
  const resetSpeed = ORIENTATION.RESET_SPEED * deltaTime;

  _euler.setFromQuaternion(player.quat, "YXZ");
  _quat.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));

  player.quat.slerp(_quat, resetSpeed);
  player.pitch *= 1 - resetSpeed;
  ship.quaternion.setFromEuler(_euler.set(player.pitch, _euler.y, 0, "YXZ"));

  const resetComplete = Math.abs(player.pitch) < 0.01;
  player.reset = !resetComplete;
  player.pitch *= !resetComplete;

  if (resetComplete) {
    ship.quaternion.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));
    player.dir = getDirection(_euler.y);
  }
};

// Update camera to follow the ship
export const updateCamera = (camera) => {
  const ship = player.model;
  if (!ship || !camera) return;

  // Calculate camera position behind and above the ship
  _dir.set(0, 0, -1).applyQuaternion(player.quat).normalize();
  _cam.copy(_dir).multiplyScalar(-CAMERA.DISTANCE);

  camera.position
    .copy(ship.position)
    .add(_cam)
    .add(_v3.set(0, CAMERA.HEIGHT, 0));

  // Look ahead of the ship
  camera.lookAt(
    _v3.copy(ship.position).add(_dir.multiplyScalar(CAMERA.LOOK_AHEAD))
  );
};

// Utility functions
export const getPlayerModel = () => player.model;

export const resetOrientation = () => {
  if (player.model) player.reset = true;
};

export const getCurrentHeight = () =>
  player.model ? player.model.position.y : HEIGHT.MIN;

export const getHeightLimits = () => ({
  min: HEIGHT.MIN,
  max: HEIGHT.MAX,
});

export const disposePlayerControls = initPlayerControls;

/**
 * Enable or disable autopilot mode for the player ship.
 * This disables manual input and lets navigation take over.
 * @param {boolean} isEnabled - Whether to enable autopilot
 */
export function setPlayerAutoPilot(isEnabled) {
  isAutoPilotActive = isEnabled;

  if (isEnabled) {
    console.log("🧭 Autopilot engaged – manual controls disabled");
    // Clear any current velocities when autopilot engages
    player.velocity_x = 0;
    player.velocity_y = 0;
  } else {
    console.log("🧭 Autopilot disabled – manual controls available");
  }
}

/**
 * Fully clear autopilot mode and re-enable manual control.
 */
export function clearPlayerAutoPilot() {
  isAutoPilotActive = false;
  player.velocity_x = 0;
  player.velocity_y = 0;
  console.log("🕹️ Autopilot disengaged – manual controls re-enabled");
}

/**
 * Check if autopilot is currently active
 * @returns {boolean}
 */
export function isPlayerAutoPiloting() {
  return isAutoPilotActive;
}

/**
 * Get current player input state (useful for debugging and external systems)
 * @returns {Object} Current input state with movement flags
 */
export function getPlayerInputState() {
  return getCurrentInputState();
}

/**
 * Get detailed player state for UI and debugging
 * @returns {Object} Comprehensive player state
 */
export function getPlayerState() {
  return {
    position: player.pos.clone(),
    direction: player.dir,
    velocity: { x: player.velocity_x, y: player.velocity_y },
    height: getCurrentHeight(),
    heightLimits: getHeightLimits(),
    isAutoPiloting: isAutoPilotActive,
    isClamped: player.clamped,
    isResetting: player.reset,
    inputState: getCurrentInputState(),
  };
}

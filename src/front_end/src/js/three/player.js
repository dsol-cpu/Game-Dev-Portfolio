import {
  Euler,
  Quaternion,
  Vector3,
  Group,
  MeshPhongMaterial,
} from "../extern/three/three.module.min.js";
import { loadModel } from "./model.js";

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

// Key mappings for input handling
const KEY = {
  FORWARD: 1,
  BACKWARD: 2,
  LEFT: 4,
  RIGHT: 8,
  TILT_UP: 16,
  TILT_DOWN: 32,
};

const KEYS = new Map([
  ...["ArrowUp", "KeyW"].map((k) => [k, KEY.FORWARD]),
  ...["ArrowDown", "KeyS"].map((k) => [k, KEY.BACKWARD]),
  ...["ArrowLeft", "KeyA"].map((k) => [k, KEY.LEFT]),
  ...["ArrowRight", "KeyD"].map((k) => [k, KEY.RIGHT]),
  ...["Space"].map((k) => [k, KEY.TILT_UP]),
  ...["ShiftLeft", "ShiftRight"].map((k) => [k, KEY.TILT_DOWN]),
]);

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
  keys: 0, // Bitfield of currently pressed keys
  dir: "N", // Current compass direction
  pos: new Vector3(), // Current position
  quat: new Quaternion(), // Current rotation quaternion
  reset: false, // Whether ship is auto-leveling
  pitch: 0, // Current pitch angle
  tpitch: 0, // Target pitch angle
  clamped: false, // Whether vertical movement is clamped by height limits
};

// UI and input handling state
let keyEls = {};
let keyUpdates = new Map();
let updateScheduled = false;

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

// Schedule UI updates for key press indicators
const scheduleKeys = () => {
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

// Handle keyboard input
const handleKey = (e, pressed) => {
  const bit = KEYS.get(e.code);
  const hasValidKey = bit !== undefined;

  e.preventDefault();
  e.stopPropagation();
  player.keys = pressed ? player.keys | bit : player.keys & ~bit;
  keyUpdates.set(e.code, pressed);
  scheduleKeys();

  return hasValidKey;
};

// Initialize player controls and event listeners
export const initPlayerControls = () => {
  const keyDown = (e) => handleKey(e, true);
  const keyUp = (e) => handleKey(e, false);

  window.addEventListener("keydown", keyDown, { passive: false });
  window.addEventListener("keyup", keyUp, { passive: false });

  // Cache UI elements for key indicators
  document.querySelectorAll(".key[data-key]").forEach((el) => {
    keyEls[el.dataset.key] = el;
  });

  // Make canvas focusable for keyboard input
  const canvas = document.getElementById("main-game-canvas");
  canvas &&
    ((canvas.tabIndex = 1),
    canvas.addEventListener("click", () => canvas.focus()));

  // Return cleanup function
  return () => {
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);
  };
};

// Main player update function called each frame
export const updatePlayer = (deltaTime) => {
  const ship = player.model;
  if (!ship) return;

  // Cap deltaTime to prevent large jumps
  deltaTime = Math.min(deltaTime, 0.1);

  if (player.reset) {
    updateReset(deltaTime, ship);
    return;
  }

  updateMovement(deltaTime, ship);
  player.pos.copy(ship.position);
};

// Update ship movement based on input
const updateMovement = (deltaTime, ship) => {
  const { keys } = player;
  const currentHeight = ship.position.y;

  // Update horizontal velocity
  const forwardAccel = (keys & KEY.FORWARD) * MOVEMENT.ACCELERATION * deltaTime;
  const backwardAccel =
    (keys & KEY.BACKWARD) * MOVEMENT.ACCELERATION * deltaTime;
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
  const canGoUp = !atMaxHeight && keys & KEY.TILT_UP;
  const canGoDown = !atMinHeight && keys & KEY.TILT_DOWN;

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
  const turnLeft = !!(keys & KEY.LEFT);
  const turnRight = !!(keys & KEY.RIGHT);
  const turnAmount = (turnLeft - turnRight) * MOVEMENT.TURN_SPEED * deltaTime;

  _quat.setFromAxisAngle(_axisY, turnAmount);
  player.quat.premultiply(_quat);

  // Calculate pitch based on movement state (flattened logic)
  const forward = keys & KEY.FORWARD || player.velocity_x > 0;
  const backward = keys & KEY.BACKWARD || player.velocity_x < 0;
  const up = keys & KEY.TILT_UP && !player.clamped;
  const down = keys & KEY.TILT_DOWN && !player.clamped;

  // Pitch lookup table approach
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

// Autopilot state flag
let isAutoPilotActive = false;

/**
 * Enable or disable autopilot mode for the player ship.
 * This typically disables manual input and lets navigation take over.
 * @param {boolean} isEnabled - Whether to enable autopilot
 */
export function setPlayerAutoPilot(isEnabled) {
  isAutoPilotActive = isEnabled;

  // Example: Disable user inputs if autopilot is on
  if (isEnabled) {
    console.log("🧭 Autopilot engaged – manual controls disabled");
    // You might want to disable input listeners or lock movement updates here
    // e.g., inputManager.disable(), movementEnabled = false, etc.
  } else {
    console.log(
      "🧭 Autopilot flag set, but not fully cleared (call clearPlayerAutoPilot)"
    );
  }
}

/**
 * Fully clear autopilot mode and re-enable manual control.
 */
export function clearPlayerAutoPilot() {
  isAutoPilotActive = false;
  console.log("🕹️ Autopilot disengaged – manual controls re-enabled");
  // Re-enable any user input systems here
  // e.g., inputManager.enable(), movementEnabled = true, etc.
}

/**
 * Optionally expose autopilot state if needed by other systems
 * @returns {boolean}
 */
export function isPlayerAutoPiloting() {
  return isAutoPilotActive;
}

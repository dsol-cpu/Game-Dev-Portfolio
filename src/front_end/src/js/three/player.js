import {
  Euler,
  Quaternion,
  Vector3,
  Group,
  MeshPhongMaterial,
} from "../extern/three/three.module.min.js";
import { getModel } from "./model-manager.js";

// Reuse objects for all vector/quaternion operations
const _v3 = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();
const _axisY = new Vector3(0, 1, 0);
const _movementDir = new Vector3(0, 0, -1);
const _camOffset = new Vector3(0, 0, 0);

// Fast bitwise key state tracking
const KEY = {
  FORWARD: 1,
  BACKWARD: 2,
  LEFT: 4,
  RIGHT: 8,
  UP: 16,
  DOWN: 32,
};

// DOM element cache
const keyElements = {};

// Pack constants into TypedArrays for CPU cache optimization
const CONSTANTS = new Float32Array([
  12.0, // 0: MAX_SPEED
  1.2, // 1: ACCELERATION
  0.5, // 2: DECELERATION
  3.0, // 3: TURN_RATE
  9.0, // 4: VERTICAL_MAX
  0.5, // 5: VERTICAL_ACCEL
  0.5, // 6: VERTICAL_DECEL
  Math.PI / 30, // 7: TILT_AMOUNT
  3.0, // 8: TILT_SPEED
  6.0, // 9: RESET_SPEED
  -50, // 10: MIN_HEIGHT
  50, // 11: MAX_HEIGHT
  5, // 12: CAMERA_DISTANCE
  2, // 13: CAMERA_HEIGHT
  3, // 14: CAMERA_LOOK_AHEAD
  (Math.PI / 30) * 1.2, // 15: PITCH_AMOUNT
]);

// Pre-computed pitch arrays for fast lookup
const PITCH = {
  FORWARD: new Float32Array([
    CONSTANTS[15] * 0.3,
    -CONSTANTS[15],
    CONSTANTS[15],
  ]),
  BACKWARD: new Float32Array([
    -CONSTANTS[15] * 0.3,
    CONSTANTS[15],
    -CONSTANTS[15],
  ]),
  IDLE: new Float32Array([0, CONSTANTS[15] * 0.5, -CONSTANTS[15] * 0.5]),
};

// Fast key map using integers instead of strings
const CONTROL_KEY_MAP = new Map();
["ArrowUp", "KeyW"].forEach((k) => CONTROL_KEY_MAP.set(k, KEY.FORWARD));
["ArrowDown", "KeyS"].forEach((k) => CONTROL_KEY_MAP.set(k, KEY.BACKWARD));
["ArrowLeft", "KeyA"].forEach((k) => CONTROL_KEY_MAP.set(k, KEY.LEFT));
["ArrowRight", "KeyD"].forEach((k) => CONTROL_KEY_MAP.set(k, KEY.RIGHT));
["Space"].forEach((k) => CONTROL_KEY_MAP.set(k, KEY.UP));
["ShiftLeft", "ShiftRight"].forEach((k) => CONTROL_KEY_MAP.set(k, KEY.DOWN));

const pendingKeyUpdates = new Map();
let keyUpdateScheduled = false;

function scheduleKeyUpdates() {
  if (keyUpdateScheduled) return;
  keyUpdateScheduled = true;

  requestAnimationFrame(() => {
    pendingKeyUpdates.forEach((active, key) => {
      const el = keyElements[key];
      if (el) {
        if (active) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      }
    });
    pendingKeyUpdates.clear();
    keyUpdateScheduled = false;
  });
}

// Material cache - prevent repeated material creation
const MATERIALS = {};
MATERIALS.BODY = new MeshPhongMaterial({
  color: 0x3366cc,
  shininess: 100,
  specular: 0x111111,
});
MATERIALS.COCKPIT = new MeshPhongMaterial({
  color: 0x66ccff,
  shininess: 120,
  opacity: 0.7,
  transparent: true,
});
MATERIALS.WINGS = new MeshPhongMaterial({ color: 0x2255aa });
MATERIALS.ENGINE = new MeshPhongMaterial({ color: 0x555555 });
MATERIALS.GLOW = new MeshPhongMaterial({
  color: 0xff7700,
  emissive: 0xff5500,
  transparent: true,
  opacity: 0.8,
});

// Pre-calculated direction lookup (single array)
const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DIRECTION_LOOKUP = new Array(360);
for (let i = 0; i < 360; i++) {
  DIRECTION_LOOKUP[i] = DIRECTIONS[Math.floor(((i + 22.5) % 360) / 45)];
}

// Cache Math functions for speed
const abs = Math.abs;
const min = Math.min;
const max = Math.max;
const floor = Math.floor;

// Player state structure optimized for memory layout
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
  heightClamped: false,
};

/**
 * Get the player's model object
 * @returns {Object|null} The player's ship model or null if not created
 */
export function getPlayerModel() {
  return player.model;
}

// Fast direction lookup using pre-calculated array
export function getDirection(rotation) {
  // ~~ is faster than Math.floor for integers
  const degrees = ~~(((((rotation * 180) / Math.PI) % 360) + 360) % 360);
  return DIRECTION_LOOKUP[degrees];
}

export async function createPlayerModel() {
  if (player.model) return player.model;

  const ship = new Group();
  const shipModel = await getModel("portfolioShip");

  shipModel.quaternion.identity();
  shipModel.scale.set(1, 1, 1);
  ship.add(shipModel);
  ship.position.set(0, CONSTANTS[10], 0); // MIN_HEIGHT

  player.orientation = new Quaternion();
  ship.quaternion.copy(player.orientation);
  player.model = ship;

  return ship;
}

export function initPlayerControls() {
  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp, { passive: false });

  document.querySelectorAll(".key[data-key]").forEach((el) => {
    keyElements[el.dataset.key] = el;
  });

  const canvas = document.getElementById("main-game-canvas");
  if (canvas) {
    canvas.tabIndex = 1;
    canvas.addEventListener("click", () => canvas.focus());
  }
}
function handleKeyDown(e) {
  const keyBit = CONTROL_KEY_MAP.get(e.code);
  if (keyBit !== undefined) {
    e.preventDefault();
    e.stopPropagation();
    player.keyState |= keyBit;
    pendingKeyUpdates.set(e.code, true);
    scheduleKeyUpdates();
  }
}

function handleKeyUp(e) {
  const keyBit = CONTROL_KEY_MAP.get(e.code);
  if (keyBit !== undefined) {
    e.preventDefault();
    e.stopPropagation();
    player.keyState &= ~keyBit;
    pendingKeyUpdates.set(e.code, false);
    scheduleKeyUpdates();
  }
}

export function updatePlayer(deltaTime) {
  const ship = player.model;
  if (!ship) return;

  // Clamp deltaTime to prevent physics issues
  const dt = min(deltaTime, 0.1);

  if (player.resetInProgress) {
    updateOrientationReset(dt);
  } else {
    // Use local frame batch processing for CPU cache efficiency
    const batch = updateMovementBatch(dt);
    updateTurningAndTilt(dt, batch);
    applyTransforms(ship, batch);
  }

  player.position.copy(ship.position);
}

// Batch movement calculations to reduce function calls
function updateMovementBatch(dt) {
  const keyState = player.keyState;
  const shipY = player.model.position.y;

  // Create local result batch for better CPU cache locality
  const batch = {
    forward: 0,
    vertical: 0,
    heightClamped: false,
    tiltDir: 0,
    turnRate: 0,
  };

  // Movement constants
  const maxSpeed = CONSTANTS[0] * dt; // MAX_SPEED
  const accel = CONSTANTS[1] * dt; // ACCELERATION
  const decel = CONSTANTS[2] * dt; // DECELERATION
  const vertMax = CONSTANTS[4] * dt; // VERTICAL_MAX
  const vertAccel = CONSTANTS[5] * dt; // VERTICAL_ACCEL
  const vertDecel = CONSTANTS[6] * dt; // VERTICAL_DECEL
  const minHeight = CONSTANTS[10]; // MIN_HEIGHT
  const maxHeight = CONSTANTS[11]; // MAX_HEIGHT

  // Forward/backward - faster bitwise check
  if (keyState & KEY.FORWARD) {
    player.velocity = min(maxSpeed, player.velocity + accel);
  } else if (keyState & KEY.BACKWARD) {
    player.velocity = max(-maxSpeed, player.velocity - accel);
  } else {
    // Fast deceleration with sign check
    player.velocity =
      player.velocity > 0
        ? max(0, player.velocity - decel)
        : min(0, player.velocity + decel);
  }

  // Height limit checks
  const atMaxHeight = shipY >= maxHeight;
  const atMinHeight = shipY <= minHeight;

  // Vertical movement - using direct bit checks
  if (keyState & KEY.UP && !atMaxHeight) {
    player.verticalVelocity = min(vertMax, player.verticalVelocity + vertAccel);
  } else if (keyState & KEY.DOWN && !atMinHeight) {
    player.verticalVelocity = max(
      -vertMax,
      player.verticalVelocity - vertAccel
    );
  } else {
    // Vertical deceleration
    player.verticalVelocity =
      player.verticalVelocity > 0
        ? max(0, player.verticalVelocity - vertDecel)
        : min(0, player.verticalVelocity + vertDecel);
  }

  // Height limit enforcement
  if (
    (atMaxHeight && player.verticalVelocity > 0) ||
    (atMinHeight && player.verticalVelocity < 0)
  ) {
    player.verticalVelocity = 0;
    batch.heightClamped = true;
  }

  player.heightClamped = batch.heightClamped;
  batch.forward = player.velocity;
  batch.vertical = player.verticalVelocity;

  return batch;
}

// Combine turning and tilt for fewer function calls and better locality
function updateTurningAndTilt(dt, batch) {
  const keyState = player.keyState;
  const turnConst = CONSTANTS[3] * dt; // TURN_RATE
  const tiltSpeed = CONSTANTS[8] * dt; // TILT_SPEED

  // Turning calculation
  if (keyState & KEY.LEFT) {
    player.turnRate = turnConst;
  } else if (keyState & KEY.RIGHT) {
    player.turnRate = -turnConst;
  } else {
    player.turnRate = 0;
  }

  if (player.turnRate !== 0) {
    _quat.setFromAxisAngle(_axisY, player.turnRate);
    player.orientation.premultiply(_quat);

    _euler.setFromQuaternion(player.orientation, "YXZ");
    player.direction = getDirection(_euler.y);
  }

  // Tilt calculation packed into the same function
  const velocity = player.velocity;
  const clamped = player.heightClamped;

  const movingForward = keyState & KEY.FORWARD || velocity > 0;
  const movingBackward = keyState & KEY.BACKWARD || velocity < 0;
  const goingUp = keyState & KEY.UP && !clamped;
  const goingDown = keyState & KEY.DOWN && !clamped;

  // Fast index calculation
  const dirIndex = goingDown ? 1 : goingUp ? 2 : 0;

  // Lookup target pitch from pre-computed arrays
  let targetPitch;
  if (movingForward) {
    targetPitch = PITCH.FORWARD[dirIndex];
  } else if (movingBackward) {
    targetPitch = PITCH.BACKWARD[dirIndex];
  } else {
    targetPitch = PITCH.IDLE[dirIndex];
  }

  player.targetPitch = targetPitch;

  // Fast lerp with clamping
  const tiltLerpFactor = min(1, tiltSpeed);
  player.currentPitch += (targetPitch - player.currentPitch) * tiltLerpFactor;

  batch.turnRate = player.turnRate;
}

function applyTransforms(ship, batch) {
  // Apply forward movement using pre-allocated vector
  if (batch.forward !== 0) {
    _movementDir
      .set(0, 0, -1)
      .applyQuaternion(player.orientation)
      .normalize()
      .multiplyScalar(batch.forward);

    ship.position.add(_movementDir);
  }

  // Apply vertical movement only if non-zero
  if (batch.vertical !== 0) {
    ship.position.y += batch.vertical;
  }

  // Fast min/max clamping
  ship.position.y = max(CONSTANTS[10], min(CONSTANTS[11], ship.position.y));

  // Efficient orientation application
  _euler.setFromQuaternion(player.orientation, "YXZ");
  ship.quaternion.setFromEuler(
    _euler.set(player.currentPitch, _euler.y, 0, "YXZ")
  );
}

function updateOrientationReset(dt) {
  const ship = player.model;
  const resetSpeed = CONSTANTS[9] * dt; // RESET_SPEED

  _euler.setFromQuaternion(player.orientation, "YXZ");
  _quat.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));

  // Fast orientation interpolation
  player.orientation.slerp(_quat, resetSpeed);
  ship.quaternion.setFromEuler(
    _euler.set(player.currentPitch, _euler.y, 0, "YXZ")
  );

  // Efficient pitch damping
  player.currentPitch *= 1 - resetSpeed;

  // Fast completion check with cached Math.abs
  if (abs(player.currentPitch) < 0.01) {
    player.resetInProgress = false;
    player.currentPitch = 0;
    ship.quaternion.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));
    player.direction = getDirection(_euler.y);
  }
}

export function resetOrientation() {
  if (!player.model) return;
  player.resetInProgress = true;
  player.turnRate = 0;
}

export function updateCamera(camera) {
  const ship = player.model;
  if (!ship || !camera) return;

  // Single vector reuse for better performance
  _movementDir.set(0, 0, -1).applyQuaternion(player.orientation).normalize();

  // Camera positioning with minimal allocations
  _camOffset.copy(_movementDir).multiplyScalar(-CONSTANTS[12]); // CAMERA_DISTANCE
  camera.position
    .copy(ship.position)
    .add(_camOffset)
    .add(_v3.set(0, CONSTANTS[13], 0)); // CAMERA_HEIGHT

  _v3.copy(ship.position).add(
    _movementDir.multiplyScalar(CONSTANTS[14]) // CAMERA_LOOK_AHEAD
  );
  camera.lookAt(_v3);
}

export function getCurrentHeight() {
  return player.model ? player.model.position.y : CONSTANTS[10]; // MIN_HEIGHT
}

export function getHeightLimits() {
  return { min: CONSTANTS[10], max: CONSTANTS[11] };
}

export function disposePlayerControls() {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
}

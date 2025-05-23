import {
  Euler,
  Quaternion,
  Vector3,
  Group,
  MeshPhongMaterial,
} from "../extern/three/three.module.min.js";
import { getCachedModels } from "./model.js";

// Reused objects
const _v3 = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();
const _axisY = new Vector3(0, 1, 0);
const _dir = new Vector3(0, 0, -1);
const _cam = new Vector3();

const SPEED = 12;
const ACCELERATION = 1.2;
const DECELERATION = 0.5;
const TURN = 3;
const VERTICAL_MAX = 9;
const VERTICAL_ACCELERATION = 0.5;
const VERTICAL_DECELERATION = 0.5;
// Packed constants
const C = new Float32Array([
  12,
  1.2,
  0.5,
  3,
  9,
  0.5,
  0.5, // speed, accel, decel, turn, vmax, vaccel, vdecel
  Math.PI / 30,
  3,
  6,
  -50,
  50,
  5,
  2,
  3,
  Math.PI / 36, // tilt, tiltspeed, reset, minH, maxH, camdist, camheight, camlook, pitch
]);

// Key mappings
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

// Direction lookup
const DIRS = Array.from(
  { length: 360 },
  (_, i) =>
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][(((i + 22.5) / 45) | 0) % 8]
);

// Materials cache
const MAT = {
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

// Player state
const player = {
  model: null,
  velocity_x: 0,
  velocity_y: 0,
  keys: 0,
  dir: "N",
  pos: new Vector3(),
  quat: new Quaternion(),
  reset: false,
  pitch: 0,
  tpitch: 0,
  clamped: false,
};

let keyEls = {};
let keyUpdates = new Map();
let updateScheduled = false;

// Direction calculation
export const getDirection = (rot) =>
  DIRS[~~(((((-rot * 180) / Math.PI) % 360) + 360) % 360)];

// Model creation
export const createPlayerModel = async () => {
  if (player.model) return player.model;

  const models = getCachedModels();
  const shipModel = models.portfolioShip;

  if (!shipModel) {
    throw new Error("Portfolio ship model not found in cache");
  }

  const ship = new Group();
  shipModel.quaternion.identity();
  shipModel.scale.set(1, 1, 1);
  ship.add(shipModel);
  ship.position.set(0, C[10], 0); // MIN_HEIGHT

  player.quat = new Quaternion();
  ship.quaternion.copy(player.quat);
  player.model = ship;

  return ship;
};

// Key scheduling
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

// Event handlers
const handleKey = (e, pressed) => {
  const bit = KEYS.get(e.code);
  if (bit !== undefined) {
    e.preventDefault();
    e.stopPropagation();
    player.keys = pressed ? player.keys | bit : player.keys & ~bit;
    keyUpdates.set(e.code, pressed);
    scheduleKeys();
  }
};

// Controls initialization
export const initPlayerControls = () => {
  const keyDown = (e) => handleKey(e, true);
  const keyUp = (e) => handleKey(e, false);

  window.addEventListener("keydown", keyDown, { passive: false });
  window.addEventListener("keyup", keyUp, { passive: false });

  document.querySelectorAll(".key[data-key]").forEach((el) => {
    keyEls[el.dataset.key] = el;
  });

  const canvas = document.getElementById("main-game-canvas");
  if (canvas) {
    canvas.tabIndex = 1;
    canvas.addEventListener("click", () => canvas.focus());
  }

  return () => {
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);
  };
};

// Physics update
export const updatePlayer = (deltaTime) => {
  const ship = player.model;
  if (!ship) return;

  deltaTime = Math.min(deltaTime, 0.1);

  if (player.reset) {
    updateReset(deltaTime, ship);
    return;
  }

  updateMovement(deltaTime, ship);
  player.pos.copy(ship.position);
};

// Movement update
const updateMovement = (deltaTime, ship) => {
  const { keys } = player;
  const y = ship.position.y;

  // Velocity updates
  player.velocity_x +=
    keys & KEY.FORWARD
      ? C[1] * deltaTime
      : keys & KEY.BACKWARD
      ? -C[1] * deltaTime
      : -Math.sign(player.velocity_x) *
        Math.min(Math.abs(player.velocity_x), C[2] * deltaTime);
  player.velocity_x = Math.max(
    -C[0] * deltaTime,
    Math.min(C[0] * deltaTime, player.velocity_x)
  );

  // Vertical velocity with clamping
  const atMax = y >= C[11],
    atMin = y <= C[10];
  player.velocity_y +=
    keys & KEY.TILT_UP && !atMax
      ? C[5] * deltaTime
      : keys & KEY.TILT_DOWN && !atMin
      ? -C[5] * deltaTime
      : -Math.sign(player.velocity_y) *
        Math.min(Math.abs(player.velocity_y), C[6] * deltaTime);
  player.velocity_y = Math.max(
    -C[4] * deltaTime,
    Math.min(C[4] * deltaTime, player.velocity_y)
  );

  if ((atMax && player.velocity_y > 0) || (atMin && player.velocity_y < 0)) {
    player.velocity_y = 0;
    player.clamped = true;
  } else {
    player.clamped = false;
  }

  // Turning
  const turn =
    keys & KEY.LEFT
      ? C[3] * deltaTime
      : keys & KEY.RIGHT
      ? -C[3] * deltaTime
      : 0;
  if (turn) {
    _quat.setFromAxisAngle(_axisY, turn);
    player.quat.premultiply(_quat);
    _euler.setFromQuaternion(player.quat, "YXZ");
    player.dir = getDirection(_euler.y);
  }

  // Pitch calculation
  const forward = keys & KEY.FORWARD || player.velocity_x > 0;
  const back = keys & KEY.BACKWARD || player.velocity_x < 0;
  const up = keys & KEY.TILT_UP && !player.clamped;
  const down = keys & KEY.TILT_DOWN && !player.clamped;

  player.tpitch = forward
    ? down
      ? -C[15]
      : up
      ? C[15]
      : C[15] * 0.3
    : back
    ? down
      ? C[15]
      : up
      ? -C[15]
      : -C[15] * 0.3
    : down
    ? C[15] * 0.5
    : up
    ? -C[15] * 0.5
    : 0;

  player.pitch +=
    (player.tpitch - player.pitch) * Math.min(1, C[8] * deltaTime);

  // Apply transforms
  if (player.velocity_x) {
    _dir
      .set(0, 0, -1)
      .applyQuaternion(player.quat)
      .normalize()
      .multiplyScalar(player.velocity_x);
    ship.position.add(_dir);
  }

  if (player.velocity_y) ship.position.y += player.velocity_y;
  ship.position.y = Math.max(C[10], Math.min(C[11], ship.position.y));

  _euler.setFromQuaternion(player.quat, "YXZ");
  ship.quaternion.setFromEuler(_euler.set(player.pitch, _euler.y, 0, "YXZ"));
};

// Reset update
const updateReset = (deltaTime, ship) => {
  const speed = C[9] * deltaTime;

  _euler.setFromQuaternion(player.quat, "YXZ");
  _quat.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));

  player.quat.slerp(_quat, speed);
  player.pitch *= 1 - speed;

  ship.quaternion.setFromEuler(_euler.set(player.pitch, _euler.y, 0, "YXZ"));

  if (Math.abs(player.pitch) < 0.01) {
    player.reset = false;
    player.pitch = 0;
    ship.quaternion.setFromEuler(_euler.set(0, _euler.y, 0, "YXZ"));
    player.dir = getDirection(_euler.y);
  }
};

// Camera update
export const updateCamera = (camera) => {
  const ship = player.model;
  if (!ship || !camera) return;

  _dir.set(0, 0, -1).applyQuaternion(player.quat).normalize();
  _cam.copy(_dir).multiplyScalar(-C[12]);

  camera.position.copy(ship.position).add(_cam).add(_v3.set(0, C[13], 0));
  camera.lookAt(_v3.copy(ship.position).add(_dir.multiplyScalar(C[14])));
};

// Utility exports
export const getPlayerModel = () => player.model;
export const resetOrientation = () => {
  if (player.model) player.reset = true;
};
export const getCurrentHeight = () =>
  player.model ? player.model.position.y : C[10];
export const getHeightLimits = () => ({ min: C[10], max: C[11] });
export const disposePlayerControls = initPlayerControls;

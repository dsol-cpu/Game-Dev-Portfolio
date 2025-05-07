/**
 * @fileoverview Simplified Player model and controls for airship (Skies of Arcadia style) - No Gravity
 */

import {
  Euler,
  Quaternion,
  Vector3,
  Group,
  MeshPhongMaterial,
} from "../extern/three/three.module.min.js";
import { handleUserInteraction } from "../user-interaction.js";
import { getModel } from "./model-manager.js";

// Player state
const player = {
  model: null,
  velocity: 0,
  verticalVelocity: 0,
  turnRate: 0,
  keys: {},
  direction: "N",
  position: new Vector3(),
  orientation: new Quaternion(),
  resetInProgress: false,
  currentPitch: 0,
  targetPitch: 0,
};

// Constants
const SPEED = {
  MAX: 12.0,
  ACCELERATION: 0.6,
  DECELERATION: 0.5,
  TURN: 3.0,
  VERTICAL_MAX: 9.0,
  VERTICAL_ACCEL: 0.5,
  VERTICAL_DECEL: 0.5,
  TILT_AMOUNT: Math.PI / 30,
  TILT_SPEED: 3.0,
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

// Reusable objects
const tempVector = new Vector3();
const tempEuler = new Euler();
const tempQuaternion = new Quaternion();
const twoPi = 2 * Math.PI;

export async function createPlayerModel() {
  if (player.model) return player.model;

  const ship = new Group();
  const shipModel = await getModel("portfolioShip");
  shipModel.quaternion.identity();
  ship.add(shipModel);
  ship.position.set(0, HEIGHT.MIN, 0);

  player.orientation = new Quaternion();

  ship.quaternion.copy(player.orientation);

  player.model = ship;
  return ship;
}

export function initPlayerControls() {
  window.addEventListener("keydown", (e) => handleKey(e, true), {});
  window.addEventListener("keyup", (e) => handleKey(e, false), {});

  const canvas = document.getElementById("main-game-canvas");
  if (canvas) {
    canvas.tabIndex = 1;
    canvas.addEventListener("click", () => canvas.focus());
  }
}

function handleKey(e, isDown) {
  if (CONTROL_KEYS.includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
    handleUserInteraction(e);
    player.keys[e.code] = isDown;
    const query = document.querySelector(`.key[data-key="${e.code}"]`);
    isDown ? query.classList.add("active") : query.classList.remove("active");
  }
}

function getDirection(rotation) {
  const normalized = (((rotation % 2) * Math.PI + 2 * Math.PI) % 2) * Math.PI;
  return DIRECTIONS[Math.floor(((normalized * 180) / Math.PI + 22.5) / 45) % 8];
}

export function updatePlayer(deltaTime) {
  const ship = player.model;
  if (!ship) return;

  if (player.resetInProgress) {
    updateOrientationReset(deltaTime);
    return;
  }

  updateMovement(deltaTime);
  updateTurning(deltaTime);
  updateTilt(deltaTime);

  applyTransforms(ship);

  player.position.copy(ship.position);
}

function updateMovement(deltaTime) {
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

  // Vertical movement
  const vertMaxSpeed = SPEED.VERTICAL_MAX * deltaTime;
  const vertAccel = SPEED.VERTICAL_ACCEL * deltaTime;

  if (keys["Space"] && player.model.position.y < HEIGHT.MAX) {
    player.verticalVelocity = Math.min(
      vertMaxSpeed,
      player.verticalVelocity + vertAccel
    );
  } else if (
    (keys["ShiftLeft"] || keys["ShiftRight"]) &&
    player.model.position.y > HEIGHT.MIN
  ) {
    player.verticalVelocity = Math.max(
      -vertMaxSpeed,
      player.verticalVelocity - vertAccel
    );
  } else {
    player.verticalVelocity = 0;
  }

  // Apply height limits
  if (
    (player.model.position.y >= HEIGHT.MAX && player.verticalVelocity > 0) ||
    (player.model.position.y <= HEIGHT.MIN && player.verticalVelocity < 0)
  ) {
    player.verticalVelocity = 0;
  }
}

function updateTurning(deltaTime) {
  const keys = player.keys;
  const turnRate = SPEED.TURN * deltaTime;

  if (keys["ArrowLeft"] || keys["KeyA"]) {
    player.turnRate = turnRate;
  } else if (keys["ArrowRight"] || keys["KeyD"]) {
    player.turnRate = -turnRate;
  } else {
    player.turnRate = 0;
  }

  if (player.turnRate !== 0) {
    tempQuaternion.setFromAxisAngle(new Vector3(0, 1, 0), player.turnRate);
    player.orientation.premultiply(tempQuaternion);
    tempEuler.setFromQuaternion(player.orientation, "YXZ");
    player.direction = getDirection(tempEuler.y);
  }
}

function updateTilt(deltaTime) {
  const keys = player.keys;
  const pitchAmount = SPEED.TILT_AMOUNT * 1.2;

  const movingForward = keys["ArrowUp"] || keys["KeyW"] || player.velocity > 0;
  const movingBackward =
    keys["ArrowDown"] || keys["KeyS"] || player.velocity < 0;
  const goingUp = keys["Space"];
  const goingDown = keys["ShiftLeft"] || keys["ShiftRight"];

  // Simplified tilt logic
  let targetPitch = 0;

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

  // Smooth transition
  const tiltLerpFactor = Math.min(1, SPEED.TILT_SPEED * deltaTime);
  player.currentPitch +=
    (player.targetPitch - player.currentPitch) * tiltLerpFactor;
}

function applyTransforms(ship) {
  // Apply forward movement
  if (player.velocity !== 0) {
    tempVector.set(0, 0, -1).applyQuaternion(player.orientation).normalize();
    tempVector.multiplyScalar(player.velocity);
    ship.position.add(tempVector);
  }

  // Apply vertical movement
  if (player.verticalVelocity !== 0) {
    ship.position.y += player.verticalVelocity;
  }

  // Enforce height limits
  ship.position.y = Math.max(HEIGHT.MIN, Math.min(HEIGHT.MAX, ship.position.y));

  // Apply orientation
  tempEuler.setFromQuaternion(player.orientation, "YXZ");
  ship.quaternion.setFromEuler(
    new Euler(player.currentPitch, tempEuler.y, 0, "YXZ")
  );
}

function updateOrientationReset(deltaTime) {
  const ship = player.model;
  const resetSpeed = SPEED.RESET_SPEED * deltaTime;

  // Get level orientation (only Y rotation)
  tempEuler.setFromQuaternion(player.orientation, "YXZ");
  tempQuaternion.setFromEuler(new Euler(0, tempEuler.y, 0, "YXZ"));

  // Smoothly interpolate to level orientation
  player.orientation.slerp(tempQuaternion, resetSpeed);
  ship.quaternion.setFromEuler(
    new Euler(player.currentPitch, tempEuler.y, 0, "YXZ")
  );

  // Reset pitch gradually
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

export function resetOrientation() {
  if (!player.model) return;
  player.resetInProgress = true;
  player.turnRate = 0;
}

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

export function disposePlayerControls() {
  window.removeEventListener("keydown", (e) => handleKey(e, true), {});
  window.removeEventListener("keyup", (e) => handleKey(e, false), {});
}

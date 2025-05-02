/**
 * @fileoverview Player model and movement controls
 */

import {
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  Vector3,
  Quaternion,
  Euler,
} from "../extern/three/three.module.min.js";

// Player constants
const PLAYER = {
  MOVE_SPEED: 0.1,
  ROTATE_SPEED: 0.05,
  ASCEND_SPEED: 0.08,
  MODEL_HEIGHT: 1.8,
  MODEL_WIDTH: 0.6,
};

// Key state tracking
const keyState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  ascend: false,
  descend: false,
};

let playerModel = null;
let moveVector = new Vector3();
let rotationEuler = new Euler(0, 0, 0, "YXZ");
let playerQuaternion = new Quaternion();

/**
 * Create a simple player model
 * @returns {Mesh} The player model mesh
 */
export function createPlayerModel() {
  // Create a simple box geometry for the player
  const geometry = new BoxGeometry(
    PLAYER.MODEL_WIDTH,
    PLAYER.MODEL_HEIGHT,
    PLAYER.MODEL_WIDTH
  );
  const material = new MeshStandardMaterial({ color: 0x3366ff });

  playerModel = new Mesh(geometry, material);
  playerModel.position.set(0, PLAYER.MODEL_HEIGHT / 2, 0);
  playerModel.castShadow = true;
  playerModel.receiveShadow = false;

  // Add a head part to indicate forward direction
  const headGeometry = new BoxGeometry(
    PLAYER.MODEL_WIDTH * 0.6,
    PLAYER.MODEL_HEIGHT * 0.3,
    PLAYER.MODEL_WIDTH * 0.8
  );
  const headMaterial = new MeshStandardMaterial({ color: 0x2255dd });
  const head = new Mesh(headGeometry, headMaterial);
  head.position.set(0, PLAYER.MODEL_HEIGHT * 0.4, PLAYER.MODEL_WIDTH * 0.3);
  playerModel.add(head);

  return playerModel;
}

/**
 * Get the player model
 * @returns {Mesh} The player model
 */
export function getPlayerModel() {
  return playerModel;
}

/**
 * Initialize keyboard controls
 */
export function initPlayerControls() {
  // Event listeners for keyboard input
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
}

/**
 * Handle keydown events
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyDown(event) {
  updateKeyState(event.code, true);
  event.preventDefault();
}

/**
 * Handle keyup events
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyUp(event) {
  updateKeyState(event.code, false);
}

/**
 * Update key state based on key code
 * @param {string} code - The key code
 * @param {boolean} pressed - Whether the key is pressed
 */
function updateKeyState(code, pressed) {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      keyState.forward = pressed;
      break;
    case "KeyS":
    case "ArrowDown":
      keyState.backward = pressed;
      break;
    case "KeyA":
    case "ArrowLeft":
      keyState.left = pressed;
      break;
    case "KeyD":
    case "ArrowRight":
      keyState.right = pressed;
      break;
    case "Space":
      keyState.ascend = pressed;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      keyState.descend = pressed;
      break;
  }
}

/**
 * Update player position based on key state
 * @param {number} deltaTime - Time since last update in milliseconds
 */
export function updatePlayerMovement(deltaTime) {
  if (!playerModel) return;

  const speedFactor = deltaTime / 16; // Normalize for frame rate
  moveVector.set(0, 0, 0);

  // Calculate forward/backward movement
  if (keyState.forward) moveVector.z += PLAYER.MOVE_SPEED * speedFactor;
  if (keyState.backward) moveVector.z -= PLAYER.MOVE_SPEED * speedFactor;

  // Calculate left/right movement
  if (keyState.left) moveVector.x -= PLAYER.MOVE_SPEED * speedFactor;
  if (keyState.right) moveVector.x += PLAYER.MOVE_SPEED * speedFactor;

  // Calculate up/down movement
  if (keyState.ascend) moveVector.y += PLAYER.ASCEND_SPEED * speedFactor;
  if (keyState.descend) moveVector.y -= PLAYER.ASCEND_SPEED * speedFactor;

  // Apply rotation to movement vector for forward/backward and left/right
  const movementVector = new Vector3(moveVector.x, 0, moveVector.z);
  movementVector.applyQuaternion(playerModel.quaternion);

  // Update player position
  playerModel.position.add(
    new Vector3(movementVector.x, moveVector.y, movementVector.z)
  );

  // Handle rotation (turning left/right)
  if (keyState.left && !keyState.right) {
    rotationEuler.y += PLAYER.ROTATE_SPEED * speedFactor;
  } else if (keyState.right && !keyState.left) {
    rotationEuler.y -= PLAYER.ROTATE_SPEED * speedFactor;
  }

  // Apply rotation
  playerQuaternion.setFromEuler(rotationEuler);
  playerModel.quaternion.copy(playerQuaternion);

  return playerModel.position;
}

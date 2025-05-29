// Streamlined key code mapping for essential controls only
const KEY_MAP = new Map([
  // Movement keys
  ["KeyW", 0],
  ["KeyS", 1],
  ["KeyA", 2],
  ["KeyD", 3],
  ["ArrowUp", 4],
  ["ArrowDown", 5],
  ["ArrowLeft", 6],
  ["ArrowRight", 7],
  // Action keys
  ["ShiftLeft", 8],
  ["ShiftRight", 8], // Normalize shift keys
  ["Space", 9],
  ["Escape", 10],
  ["KeyR", 11],
]);

// Global state using BigInt for efficient bit operations
let keyState = 0n;
let isEnabled = true;
let keyBindings = null; // Only create when needed
let callbacks = null; // Only create when needed

// Pre-computed movement vectors for 3D airship movement
const MOVEMENT_VECTORS = {
  w: { x: 0, z: -1 },
  s: { x: 0, z: 1 },
  a: { x: -1, z: 0 },
  d: { x: 1, z: 0 },
  up: { x: 0, z: -1 },
  down: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};

// Constants for bit operations
const HORIZONTAL_MOVEMENT_MASK = 0b11111111n; // First 8 bits for horizontal movement
const VERTICAL_UP_MASK = 1n << 8n; // Bit 8 for ascend (shift)
const VERTICAL_DOWN_MASK = 1n << 9n; // Bit 9 for descend (space)

// Core bit manipulation functions
const setBit = (state, bit) => state | (1n << BigInt(bit));
const clearBit = (state, bit) => state & ~(1n << BigInt(bit));
const testBit = (state, bit) => Boolean(state & (1n << BigInt(bit)));

// Key state management
const setKeyPressed = (keyCode, pressed) => {
  const bit = KEY_MAP.get(keyCode);
  if (bit !== undefined) {
    keyState = pressed ? setBit(keyState, bit) : clearBit(keyState, bit);
    return true;
  }
  return false;
};

const isKeyPressed = (keyCode) => {
  const bit = KEY_MAP.get(keyCode);
  return bit !== undefined ? testBit(keyState, bit) : false;
};

// Optimized multi-key checks using bit operations
const areKeysPressed = (...keyCodes) => {
  let mask = 0n;
  for (let i = 0; i < keyCodes.length; i++) {
    const bit = KEY_MAP.get(keyCodes[i]);
    if (bit === undefined) return false;
    mask |= 1n << BigInt(bit);
  }
  return (keyState & mask) === mask;
};

const isAnyKeyPressed = (...keyCodes) => {
  let mask = 0n;
  for (let i = 0; i < keyCodes.length; i++) {
    const bit = KEY_MAP.get(keyCodes[i]);
    if (bit !== undefined) {
      mask |= 1n << BigInt(bit);
    }
  }
  return Boolean(keyState & mask);
};

// Event handling functions
const handleKeyDown = (event) => {
  if (!isEnabled) return;

  const keyCode = event.code;
  const bit = KEY_MAP.get(keyCode);

  if (bit === undefined) return;

  // Prevent repeat events
  if (testBit(keyState, bit)) return;

  keyState = setBit(keyState, bit);

  // Trigger callbacks efficiently
  if (callbacks?.keydown) {
    const callbackList = callbacks.keydown;
    for (let i = 0; i < callbackList.length; i++) {
      try {
        callbackList[i](keyCode, event);
      } catch (error) {
        console.error("Input callback error:", error);
      }
    }
  }

  // Handle bindings
  if (keyBindings?.has(keyCode)) {
    const binding = keyBindings.get(keyCode);
    if (binding.onPress) {
      binding.onPress(event);
    }
    if (binding.preventDefault) {
      event.preventDefault();
    }
  }
};

const handleKeyUp = (event) => {
  if (!isEnabled) return;

  const keyCode = event.code;
  const bit = KEY_MAP.get(keyCode);

  if (bit === undefined) return;

  keyState = clearBit(keyState, bit);

  // Trigger callbacks efficiently
  if (callbacks?.keyup) {
    const callbackList = callbacks.keyup;
    for (let i = 0; i < callbackList.length; i++) {
      try {
        callbackList[i](keyCode, event);
      } catch (error) {
        console.error("Input callback error:", error);
      }
    }
  }

  // Handle bindings
  if (keyBindings?.has(keyCode)) {
    const binding = keyBindings.get(keyCode);
    if (binding.onRelease) {
      binding.onRelease(event);
    }
  }
};

const resetAllKeys = () => {
  // Get list of pressed keys before clearing
  const pressedKeys = [];
  for (const [keyCode, bit] of KEY_MAP) {
    if (testBit(keyState, bit)) {
      pressedKeys.push(keyCode);
    }
  }

  // Clear all keys
  keyState = 0n;

  // Trigger release callbacks for previously pressed keys
  if (callbacks?.keyup) {
    const callbackList = callbacks.keyup;
    for (let i = 0; i < pressedKeys.length; i++) {
      for (let j = 0; j < callbackList.length; j++) {
        try {
          callbackList[j](pressedKeys[i], null);
        } catch (error) {
          console.error("Input callback error:", error);
        }
      }
    }
  }

  // Handle bindings
  if (keyBindings) {
    for (let i = 0; i < pressedKeys.length; i++) {
      const binding = keyBindings.get(pressedKeys[i]);
      if (binding?.onRelease) {
        binding.onRelease(null);
      }
    }
  }
};

const handleFocus = () => {
  if (document.hidden) {
    resetAllKeys();
  }
};

// Movement functions optimized for 3D airship control
const getMovementVector = () => {
  let x = 0,
    z = 0,
    y = 0;

  // Use bit operations for fast checks
  const horizontalState = keyState & HORIZONTAL_MOVEMENT_MASK;

  // WASD horizontal movement
  if (horizontalState & 1n) z -= 1; // KeyW
  if (horizontalState & 2n) z += 1; // KeyS
  if (horizontalState & 4n) x -= 1; // KeyA
  if (horizontalState & 8n) x += 1; // KeyD

  // Arrow keys horizontal movement
  if (horizontalState & 16n) z -= 1; // ArrowUp
  if (horizontalState & 32n) z += 1; // ArrowDown
  if (horizontalState & 64n) x -= 1; // ArrowLeft
  if (horizontalState & 128n) x += 1; // ArrowRight

  // Vertical movement
  if (keyState & VERTICAL_UP_MASK) y += 1; // Shift - ascend
  if (keyState & VERTICAL_DOWN_MASK) y -= 1; // Space - descend

  // Normalize diagonal horizontal movement
  if (x !== 0 && z !== 0) {
    const inv = 0.7071067811865476; // 1/sqrt(2) precomputed
    x *= inv;
    z *= inv;
  }

  return { x, y, z };
};

const isMovementActive = () =>
  Boolean(
    keyState &
      (HORIZONTAL_MOVEMENT_MASK | VERTICAL_UP_MASK | VERTICAL_DOWN_MASK)
  );
const isHorizontalMovementActive = () =>
  Boolean(keyState & HORIZONTAL_MOVEMENT_MASK);
const isVerticalMovementActive = () =>
  Boolean(keyState & (VERTICAL_UP_MASK | VERTICAL_DOWN_MASK));
const isAscending = () => Boolean(keyState & VERTICAL_UP_MASK);
const isDescending = () => Boolean(keyState & VERTICAL_DOWN_MASK);

// Binding management (lazy initialization)
const bindKey = (keyCode, options = {}) => {
  if (!keyBindings) keyBindings = new Map();
  keyBindings.set(keyCode, {
    onPress: options.onPress,
    onRelease: options.onRelease,
    preventDefault: options.preventDefault || false,
  });
};

const unbindKey = (keyCode) => {
  keyBindings?.delete(keyCode);
};

// Callback management (lazy initialization)
const addCallback = (eventType, callback) => {
  if (!callbacks) callbacks = {};
  if (!callbacks[eventType]) callbacks[eventType] = [];
  callbacks[eventType].push(callback);
};

const removeCallback = (eventType, callback) => {
  if (!callbacks?.[eventType]) return;
  const index = callbacks[eventType].indexOf(callback);
  if (index > -1) {
    callbacks[eventType].splice(index, 1);
  }
};

// Utility functions
const setEnabled = (enabled) => {
  isEnabled = enabled;
  if (!enabled) {
    resetAllKeys();
  }
};

const getInputState = () => {
  const pressedKeys = [];
  for (const [keyCode, bit] of KEY_MAP) {
    if (testBit(keyState, bit)) {
      pressedKeys.push(keyCode);
    }
  }

  return {
    pressedKeys,
    totalKeys: KEY_MAP.size,
    bindings: keyBindings ? Array.from(keyBindings.keys()) : [],
    enabled: isEnabled,
    keyState: keyState.toString(2), // Binary representation for debugging
  };
};

// Event listener management
let listenersAttached = false;

const attachListeners = () => {
  if (listenersAttached) return;

  document.addEventListener("keydown", handleKeyDown, { passive: false });
  document.addEventListener("keyup", handleKeyUp, { passive: true });
  window.addEventListener("blur", resetAllKeys, { passive: true });
  document.addEventListener("visibilitychange", handleFocus, { passive: true });

  listenersAttached = true;
};

const detachListeners = () => {
  if (!listenersAttached) return;

  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("blur", resetAllKeys);
  document.removeEventListener("visibilitychange", handleFocus);

  listenersAttached = false;
};

const dispose = () => {
  detachListeners();
  keyState = 0n;
  keyBindings = null;
  callbacks = null;
  isEnabled = true;
};

// Initialize on import
attachListeners();

// Public API
export {
  // Key state
  isKeyPressed,
  areKeysPressed,
  isAnyKeyPressed,

  // Movement
  getMovementVector,
  isMovementActive,
  isHorizontalMovementActive,
  isVerticalMovementActive,
  isAscending,
  isDescending,

  // Bindings
  bindKey,
  unbindKey,

  // Callbacks
  addCallback,
  removeCallback,

  // Control
  setEnabled,
  dispose,
  getInputState,

  // Event management
  attachListeners,
  detachListeners,
};

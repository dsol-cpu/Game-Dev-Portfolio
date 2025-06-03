// Ultra-optimized input handler with flattened conditionals
const K = new Uint8Array(256); // Direct key code mapping
const keyLookup = {
  KeyW: 0,
  KeyS: 1,
  KeyA: 2,
  KeyD: 3,
  ArrowUp: 4,
  ArrowDown: 5,
  ArrowLeft: 6,
  ArrowRight: 7,
  ShiftLeft: 8,
  ShiftRight: 8,
  Space: 9,
  Escape: 10,
  KeyR: 11,
};

// Bit masks for ultra-fast operations
const WASD_FWD = 1,
  WASD_BCK = 2,
  WASD_LFT = 4,
  WASD_RGT = 8;
const ARR_FWD = 16,
  ARR_BCK = 32,
  ARR_LFT = 64,
  ARR_RGT = 128;
const SHIFT = 256,
  SPACE = 512;
const H_MASK = 255,
  V_MASK = 768; // Horizontal/Vertical masks

let state = 0; // Single integer for all key states
let enabled = 1;
let bindings, callbacks;

// Conflict resolution lookup (flattened)
const conflicts = new Uint16Array(12);
conflicts[0] = WASD_BCK;
conflicts[1] = WASD_FWD; // W conflicts with S
conflicts[2] = WASD_RGT;
conflicts[3] = WASD_LFT; // A conflicts with D
conflicts[4] = ARR_BCK;
conflicts[5] = ARR_FWD; // Up conflicts with Down
conflicts[6] = ARR_RGT;
conflicts[7] = ARR_LFT; // Left conflicts with Right
conflicts[8] = SPACE;
conflicts[9] = SHIFT; // Shift conflicts with Space

// Movement vector lookup table (flattened for direct access)
const moveX = new Float32Array(256);
const moveZ = new Float32Array(256);
const moveY = new Float32Array(4); // Only 4 combinations for Y
moveY[1] = 1;
moveY[2] = -1; // Up only, Down only

// Pre-compute all 256 possible horizontal movement combinations
const inv = 0.7071067811865476; // 1/sqrt(2)
for (let i = 0; i < 256; i++) {
  let x = 0,
    z = 0;
  const hasWASD = i & 15;
  const hasArrow = i & 240;

  // Use WASD if both present, otherwise use whichever is active
  const activeSet = hasWASD && hasArrow ? i & 15 : i;

  // Extract movement (flattened conditional logic)
  x += activeSet & 4 && !(activeSet & 8) ? -1 : 0; // Left
  x += activeSet & 8 && !(activeSet & 4) ? 1 : 0; // Right
  x += activeSet & 64 && !(activeSet & 128) && !hasWASD ? -1 : 0; // Arrow left
  x += activeSet & 128 && !(activeSet & 64) && !hasWASD ? 1 : 0; // Arrow right

  z += activeSet & 1 && !(activeSet & 2) ? -1 : 0; // Forward
  z += activeSet & 2 && !(activeSet & 1) ? 1 : 0; // Backward
  z += activeSet & 16 && !(activeSet & 32) && !hasWASD ? -1 : 0; // Arrow up
  z += activeSet & 32 && !(activeSet & 16) && !hasWASD ? 1 : 0; // Arrow down

  // Normalize diagonal movement
  const isDiagonal = x !== 0 && z !== 0;
  moveX[i] = isDiagonal ? x * inv : x;
  moveZ[i] = isDiagonal ? z * inv : z;
}

// Core functions (minimal branching)
const setBit = (bit) => (state |= 1 << bit);
const clearBit = (bit) => (state &= ~(1 << bit));
const testBit = (bit) => state & (1 << bit);

const handleKeyDown = (e) => {
  const bit = keyLookup[e.code];
  const isValid = bit !== undefined && enabled;
  const isNew = isValid && !testBit(bit);
  const hasConflict = isValid && isNew && state & conflicts[bit];

  // Flattened execution path
  isValid && isNew && !hasConflict && setBit(bit);
  isValid && isNew && !hasConflict && bindings?.get(e.code)?.onPress?.(e);
  isValid &&
    isNew &&
    !hasConflict &&
    callbacks?.keydown?.forEach((cb) => cb(e.code, e));

  const binding = isValid && bindings?.get(e.code);
  binding?.preventDefault && e.preventDefault();
};

const handleKeyUp = (e) => {
  const bit = keyLookup[e.code];
  const isValid = bit !== undefined && enabled;

  isValid && testBit(bit) && clearBit(bit);
  isValid && bindings?.get(e.code)?.onRelease?.(e);
  isValid && callbacks?.keyup?.forEach((cb) => cb(e.code, e));
};

// Movement calculation (single lookup)
const getMovementVector = () => {
  const h = state & H_MASK;
  const v = state & V_MASK;
  const yIdx = (v === SHIFT ? 1 : 0) | (v === SPACE ? 2 : 0);

  return {
    x: moveX[h],
    y: moveY[yIdx],
    z: moveZ[h],
  };
};

// Optimized state checks (single bit operations)
const isKeyPressed = (code) => testBit(keyLookup[code] || 255);
const isMovementActive = () => state & (H_MASK | V_MASK);
const isHorizontalMovementActive = () => state & H_MASK;
const isVerticalMovementActive = () => state & V_MASK;
const isAscending = () => state & SHIFT;
const isDescending = () => state & SPACE;

// Multi-key checks (optimized)
const areKeysPressed = (...codes) => {
  let mask = 0;
  codes.forEach((code) => (mask |= 1 << (keyLookup[code] || 255)));
  return (state & mask) === mask;
};

const isAnyKeyPressed = (...codes) => {
  let mask = 0;
  codes.forEach((code) => (mask |= 1 << (keyLookup[code] || 255)));
  return state & mask;
};

// Reset with efficient callback handling
const resetAllKeys = () => {
  const oldState = state;
  state = 0;

  // Trigger callbacks only for previously pressed keys
  callbacks?.keyup &&
    Object.entries(keyLookup).forEach(([code, bit]) => {
      oldState & (1 << bit) && callbacks.keyup.forEach((cb) => cb(code, null));
    });

  // Handle bindings
  bindings &&
    Object.entries(keyLookup).forEach(([code, bit]) => {
      oldState & (1 << bit) && bindings.get(code)?.onRelease?.(null);
    });
};

// Lazy initialization helpers
const ensureBindings = () => bindings || (bindings = new Map());
const ensureCallbacks = () => callbacks || (callbacks = {});

// Binding management
const bindKey = (code, opts = {}) => {
  ensureBindings().set(code, {
    onPress: opts.onPress,
    onRelease: opts.onRelease,
    preventDefault: opts.preventDefault,
  });
};

const unbindKey = (code) => bindings?.delete(code);

// Callback management
const addCallback = (type, cb) => {
  const cbs = ensureCallbacks();
  (cbs[type] || (cbs[type] = [])).push(cb);
};

const removeCallback = (type, cb) => {
  const list = callbacks?.[type];
  const idx = list?.indexOf(cb);
  idx > -1 && list.splice(idx, 1);
};

// Control functions
const setEnabled = (en) => {
  enabled = en ? 1 : 0;
  enabled || resetAllKeys();
};

const getInputState = () => ({
  pressedKeys: Object.entries(keyLookup)
    .filter(([, bit]) => testBit(bit))
    .map(([code]) => code),
  totalKeys: Object.keys(keyLookup).length,
  bindings: bindings ? Array.from(bindings.keys()) : [],
  enabled: Boolean(enabled),
  keyState: state.toString(2),
});

// Event listener management
let attached = 0;

const attachListeners = () => {
  attached ||
    (document.addEventListener("keydown", handleKeyDown),
    document.addEventListener("keyup", handleKeyUp),
    window.addEventListener("blur", resetAllKeys),
    document.addEventListener(
      "visibilitychange",
      () => document.hidden && resetAllKeys()
    ),
    (attached = 1));
};

const detachListeners = () => {
  attached &&
    (document.removeEventListener("keydown", handleKeyDown),
    document.removeEventListener("keyup", handleKeyUp),
    window.removeEventListener("blur", resetAllKeys),
    document.removeEventListener("visibilitychange", resetAllKeys),
    (attached = 0));
};

const dispose = () => {
  detachListeners();
  state = 0;
  bindings = callbacks = null;
  enabled = 1;
};

// Auto-initialize
attachListeners();

// Exports
export {
  isKeyPressed,
  areKeysPressed,
  isAnyKeyPressed,
  getMovementVector,
  isMovementActive,
  isHorizontalMovementActive,
  isVerticalMovementActive,
  isAscending,
  isDescending,
  bindKey,
  unbindKey,
  addCallback,
  removeCallback,
  setEnabled,
  dispose,
  getInputState,
  attachListeners,
  detachListeners,
};

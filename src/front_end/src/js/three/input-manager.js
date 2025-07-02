const KEYMAP = new Uint8Array(256); // Direct key code mapping
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

// Movement vector lookup table (optimized pre-computation)
const moveX = new Float32Array(256);
const moveZ = new Float32Array(256);
const moveY = new Float32Array(4); // Only 4 combinations for Y
moveY[1] = 1;
moveY[2] = -1; // Up only, Down only

// Pre-compute all 256 possible horizontal movement combinations (optimized)
const inv = 0.7071067811865476; // 1/sqrt(2)
for (let i = 0; i < 256; i++) {
  let x = 0,
    z = 0;

  // Optimized bit extraction using lookup tables
  const wasdBits = i & 15;
  const arrowBits = (i >> 4) & 15;

  // Use WASD if available, otherwise arrows
  const activeBits = wasdBits || arrowBits;

  // Optimized movement calculation using bit manipulation
  const leftRight = (activeBits & 4) - ((activeBits & 8) >> 1);
  const fwdBack = (activeBits & 1) - ((activeBits & 2) >> 1);

  x = leftRight ? (leftRight > 0 ? -1 : 1) : 0;
  z = fwdBack ? (fwdBack > 0 ? -1 : 1) : 0;

  // Normalize diagonal movement
  if (x && z) {
    moveX[i] = x * inv;
    moveZ[i] = z * inv;
  } else {
    moveX[i] = x;
    moveZ[i] = z;
  }
}

// Core functions (optimized with direct bit operations)
const setBit = (bit) => (state |= 1 << bit);
const clearBit = (bit) => (state &= ~(1 << bit));
const testBit = (bit) => (state >> bit) & 1;

// Optimized event handlers
const handleKeyDown = (e) => {
  const bit = keyLookup[e.code];
  if (bit === undefined || !enabled) return;

  const wasPressed = testBit(bit);
  if (wasPressed) return;

  setBit(bit);

  // Optimized callback handling
  const binding = bindings?.get(e.code);
  if (binding) {
    binding.onPress?.(e);
    binding.preventDefault && e.preventDefault();
  }

  // Batch callback execution
  const keydownCallbacks = callbacks?.keydown;
  if (keydownCallbacks?.length) {
    for (let i = 0; i < keydownCallbacks.length; i++) {
      keydownCallbacks[i](e.code, e);
    }
  }
};

const handleKeyUp = (e) => {
  const bit = keyLookup[e.code];
  if (bit === undefined || !enabled || !testBit(bit)) return;

  clearBit(bit);

  // Optimized callback handling
  const binding = bindings?.get(e.code);
  binding?.onRelease?.(e);

  // Batch callback execution
  const keyupCallbacks = callbacks?.keyup;
  if (keyupCallbacks?.length) {
    for (let i = 0; i < keyupCallbacks.length; i++) {
      keyupCallbacks[i](e.code, e);
    }
  }
};

// Movement calculation (single lookup with cached result)
let cachedMovement = { x: 0, y: 0, z: 0 };
let lastMovementState = -1;

const getMovementVector = () => {
  const currentState = state & (H_MASK | V_MASK);
  if (currentState === lastMovementState) return cachedMovement;

  lastMovementState = currentState;
  const h = state & H_MASK;
  const vBits = state & V_MASK;
  const yIdx = ((vBits === SHIFT) << 0) | ((vBits === SPACE) << 1);

  cachedMovement.x = moveX[h];
  cachedMovement.y = moveY[yIdx];
  cachedMovement.z = moveZ[h];

  return cachedMovement;
};

// Optimized state checks (using bit shift operations)
const isKeyPressed = (code) => {
  const bit = keyLookup[code];
  return bit !== undefined ? (state >> bit) & 1 : 0;
};

const isMovementActive = () => !!(state & (H_MASK | V_MASK));
const isHorizontalMovementActive = () => !!(state & H_MASK);
const isVerticalMovementActive = () => !!(state & V_MASK);
const isAscending = () => !!(state & SHIFT);
const isDescending = () => !!(state & SPACE);

// Multi-key checks (optimized with pre-computed masks)
const areKeysPressed = (...codes) => {
  let mask = 0;
  for (let i = 0; i < codes.length; i++) {
    const bit = keyLookup[codes[i]];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return (state & mask) === mask;
};

const isAnyKeyPressed = (...codes) => {
  let mask = 0;
  for (let i = 0; i < codes.length; i++) {
    const bit = keyLookup[codes[i]];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return !!(state & mask);
};

// Reset with optimized callback handling
const resetAllKeys = () => {
  if (!state) return; // Early exit if no keys pressed

  const oldState = state;
  state = 0;
  lastMovementState = -1; // Reset movement cache

  // Batch process callbacks for efficiency
  const keyupCallbacks = callbacks?.keyup;
  if (keyupCallbacks?.length) {
    const pressedCodes = [];
    for (const [code, bit] of Object.entries(keyLookup)) {
      if ((oldState >> bit) & 1) pressedCodes.push(code);
    }

    for (let i = 0; i < keyupCallbacks.length; i++) {
      for (let j = 0; j < pressedCodes.length; j++) {
        keyupCallbacks[i](pressedCodes[j], null);
      }
    }
  }

  // Handle bindings efficiently
  if (bindings) {
    for (const [code, bit] of Object.entries(keyLookup)) {
      if ((oldState >> bit) & 1) {
        bindings.get(code)?.onRelease?.(null);
      }
    }
  }
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

// Callback management (optimized array operations)
const addCallback = (type, cb) => {
  const cbs = ensureCallbacks();
  const list = cbs[type] || (cbs[type] = []);
  list.push(cb);
};

const removeCallback = (type, cb) => {
  const list = callbacks?.[type];
  if (!list) return;

  const idx = list.indexOf(cb);
  if (idx > -1) {
    // Efficient removal by swapping with last element
    const lastIdx = list.length - 1;
    if (idx !== lastIdx) list[idx] = list[lastIdx];
    list.length = lastIdx;
  }
};

// Control functions
const setEnabled = (en) => {
  enabled = en ? 1 : 0;
  if (!enabled) resetAllKeys();
};

// Optimized state reporting
const getInputState = () => {
  const pressedKeys = [];
  for (const [code, bit] of Object.entries(keyLookup)) {
    if (testBit(bit)) pressedKeys.push(code);
  }

  return {
    pressedKeys,
    totalKeys: Object.keys(keyLookup).length,
    bindings: bindings ? Array.from(bindings.keys()) : [],
    enabled: Boolean(enabled),
    keyState: state.toString(2),
  };
};

// Event listener management
let attached = 0;

const attachListeners = () => {
  if (attached) return;

  document.addEventListener("keydown", handleKeyDown, { passive: false });
  document.addEventListener("keyup", handleKeyUp, { passive: true });
  window.addEventListener("blur", resetAllKeys, { passive: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) resetAllKeys();
    },
    { passive: true }
  );

  attached = 1;
};

const detachListeners = () => {
  if (!attached) return;

  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("blur", resetAllKeys);
  document.removeEventListener("visibilitychange", resetAllKeys);

  attached = 0;
};

const dispose = () => {
  detachListeners();
  state = 0;
  lastMovementState = -1;
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

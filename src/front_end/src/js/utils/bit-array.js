/**
 * Optimized bit array implementation using typed arrays
 * with efficient bit manipulation operations.
 */

// Create a bit array with specified length
function createBitArray(length) {
  // Validate input
  if (length <= 0) {
    throw new Error("Length must be positive");
  }

  // Use Uint32Array for optimal performance
  return {
    length,
    // Store bit data in Uint32Array (32 bits per element)
    data: new Uint32Array(Math.ceil(length / 32)),
    // Constant to avoid recalculation
    BITS_PER_ELEMENT: 32,
  };
}

// Set a specific bit (inline calculations for speed)
function setBit(bitArray, index) {
  if (index < 0 || index >= bitArray.length) {
    throw new Error(`Index out of bounds: ${index}`);
  }

  const elementIndex = index >>> 5; // Fast division by 32
  const bitPosition = index & 31; // Fast modulo 32
  bitArray.data[elementIndex] |= 1 << bitPosition;
  return bitArray;
}

// Clear a specific bit (inline calculations for speed)
function clearBit(bitArray, index) {
  if (index < 0 || index >= bitArray.length) {
    throw new Error(`Index out of bounds: ${index}`);
  }

  const elementIndex = index >>> 5; // Fast division by 32
  const bitPosition = index & 31; // Fast modulo 32
  bitArray.data[elementIndex] &= ~(1 << bitPosition);
  return bitArray;
}

// Toggle a bit value (inline calculations for speed)
function toggleBit(bitArray, index) {
  if (index < 0 || index >= bitArray.length) {
    throw new Error(`Index out of bounds: ${index}`);
  }

  const elementIndex = index >>> 5; // Fast division by 32
  const bitPosition = index & 31; // Fast modulo 32
  bitArray.data[elementIndex] ^= 1 << bitPosition;
  return bitArray;
}

// Check if a bit is set (inline calculations for speed)
function isBitSet(bitArray, index) {
  if (index < 0 || index >= bitArray.length) {
    throw new Error(`Index out of bounds: ${index}`);
  }

  const elementIndex = index >>> 5; // Fast division by 32
  const bitPosition = index & 31; // Fast modulo 32
  return (bitArray.data[elementIndex] & (1 << bitPosition)) !== 0;
}

// Enable all bits (with optimization for trailing bits)
function enableAllBits(bitArray) {
  // Fill all elements with 1's
  bitArray.data.fill(0xffffffff);

  // Handle trailing bits that might extend beyond specified length
  const lastElementIndex = bitArray.data.length - 1;
  const extraBits = bitArray.data.length * 32 - bitArray.length;

  if (extraBits > 0) {
    // Create mask with only valid bits set (avoid setting bits beyond length)
    const mask = 0xffffffff >>> extraBits;
    bitArray.data[lastElementIndex] &= mask;
  }

  return bitArray;
}

// Disable all bits (simple and fast)
function disableAllBits(bitArray) {
  bitArray.data.fill(0);
  return bitArray;
}

// Create a bitmask from an array of indices
function createBitmask(length, indices = []) {
  const bitArray = createBitArray(length);

  // Use an optimized loop for setting bits
  const len = indices.length;
  for (let i = 0; i < len; i++) {
    const index = indices[i];
    if (index >= 0 && index < length) {
      // Use bit shifts instead of division/modulo
      const elementIndex = index >>> 5;
      const bitPosition = index & 31;
      bitArray.data[elementIndex] |= 1 << bitPosition;
    }
  }

  return bitArray;
}

// Apply a bitmask with a bitwise operation
function applyBitmask(targetArray, maskArray, operation = "OR") {
  if (targetArray.length !== maskArray.length) {
    throw new Error("Bit arrays must have the same length");
  }

  // Get operation once before loop
  const op = operation.toUpperCase();
  const len = targetArray.data.length;

  // Optimize common cases with dedicated loops
  if (op === "OR") {
    for (let i = 0; i < len; i++) {
      targetArray.data[i] |= maskArray.data[i];
    }
  } else if (op === "AND") {
    for (let i = 0; i < len; i++) {
      targetArray.data[i] &= maskArray.data[i];
    }
  } else if (op === "XOR") {
    for (let i = 0; i < len; i++) {
      targetArray.data[i] ^= maskArray.data[i];
    }
  } else {
    throw new Error(`Unsupported operation: ${operation}`);
  }

  return targetArray;
}

// Generate a binary string representation (least significant bit first)
function logBitArray(bitArray) {
  const bits = [];
  const len = bitArray.length;

  for (let i = 0; i < len; i++) {
    const elementIndex = i >>> 5;
    const bitPosition = i & 31;
    const isSet = (bitArray.data[elementIndex] >>> bitPosition) & 1;
    bits.push(isSet);
  }

  return `BitArray [${len} bits]: ${bits.join("")}`;
}

// Get the number of bits set to 1 (optimized popcount)
function popCount(bitArray) {
  let count = 0;
  const len = bitArray.data.length;

  // Using a lookup table for faster bit counting
  const LOOKUP = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    LOOKUP[i] = (i & 1) + LOOKUP[i >>> 1];
  }

  // Process 8 bits at a time using lookup table
  const u8View = new Uint8Array(bitArray.data.buffer);
  for (let i = 0; i < u8View.length; i++) {
    count += LOOKUP[u8View[i]];
  }

  return count;
}

// Create a copy of a bit array
function copyBitArray(bitArray) {
  const newArray = createBitArray(bitArray.length);
  newArray.data.set(bitArray.data);
  return newArray;
}

export {
  createBitArray,
  setBit,
  clearBit,
  toggleBit,
  isBitSet,
  enableAllBits,
  disableAllBits,
  createBitmask,
  applyBitmask,
  logBitArray,
  popCount,
  copyBitArray,
};

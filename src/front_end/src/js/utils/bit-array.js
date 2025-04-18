// Initializes a bit array of given bit length
function createBitArray(length) {
  return {
    length: length,
    bytes: new Uint8Array(Math.ceil(length / 8)),
  };
}

// Enables all bits
function enableAllBits(bitArray) {
  bitArray.bytes.fill(0xff);
  const extraBits = bitArray.bytes.length * 8 - bitArray.length;
  if (extraBits > 0) {
    const mask = 0xff >>> extraBits;
    bitArray.bytes[bitArray.bytes.length - 1] &= mask;
  }
}

// Disables all bits
function disableAllBits(bitArray) {
  bitArray.bytes.fill(0);
}

// Applies a bitmask with bitwise operation (OR, AND, XOR)
function applyBitmask(bitArray, mask, operation = "OR") {
  for (let i = 0; i < bitArray.bytes.length; i++) {
    const m = mask[i] || 0;
    switch (operation.toUpperCase()) {
      case "OR":
        bitArray.bytes[i] |= m;
        break;
      case "AND":
        bitArray.bytes[i] &= m;
        break;
      case "XOR":
        bitArray.bytes[i] ^= m;
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
}

// Creates a bitmask from an array of bit indices (1s where enabled)
function createBitmask(length, indices = []) {
  const mask = new Uint8Array(Math.ceil(length / 8));
  for (const index of indices) {
    if (index >= length) continue;
    const byte = Math.floor(index / 8);
    const bit = index % 8;
    mask[byte] |= 1 << bit;
  }
  return mask;
}

function logBitArray(bitArray) {
  let str = "";
  for (let i = 0; i < bitArray.length; i++) {
    const byte = Math.floor(i / 8);
    const bit = i % 8;
    const isSet = (bitArray.bytes[byte] >> bit) & 1;
    str = isSet + str;
  }
  return `BitArray [${bitArray.length} bits]: ${str}`;
}

export {
  createBitArray,
  enableAllBits,
  disableAllBits,
  createBitmask,
  logBitArray,
  applyBitmask,
};

const BITS_PER_ELEMENT = 32;
export const SHIFT = 5;
export const MASK = 31;
const FULL_MASK = 0xffffffff;

// Precomputed popcount lookup
const LOOKUP = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    table[i] = (i & 1) + table[i >>> 1];
  }
  return table;
})();

const BitOperation = {
  OR: 0,
  AND: 1,
  XOR: 2,
};

function createBitArray(length) {
  if (length <= 0) throw new Error("Length must be positive");
  return {
    length,
    data: new Uint32Array((length + 31) >>> SHIFT), // faster ceil
    BITS_PER_ELEMENT,
  };
}

const enableBit = (a, i) => ((a.data[i >>> SHIFT] |= 1 << (i & MASK)), a);
const disableBit = (a, i) => ((a.data[i >>> SHIFT] &= ~(1 << (i & MASK))), a);
const toggleBit = (a, i) => ((a.data[i >>> SHIFT] ^= 1 << (i & MASK)), a);
const isBitSet = (a, i) => (a.data[i >>> SHIFT] & (1 << (i & MASK))) !== 0;

function enableAllBits(a) {
  const { data, length } = a;
  data.fill(FULL_MASK);
  const rem = data.length * BITS_PER_ELEMENT - length;
  if (rem) data[data.length - 1] &= FULL_MASK >>> rem;
  return a;
}

const disableAllBits = (a) => (a.data.fill(0), a);

function createBitmask(length, indices = []) {
  const a = createBitArray(length);
  const d = a.data;
  for (let i = 0, n = indices.length; i < n; i++) {
    const ix = indices[i];
    if (ix >= 0 && ix < length) d[ix >>> SHIFT] |= 1 << (ix & MASK);
  }
  return a;
}

function applyBitmask(target, mask, op = BitOperation.OR) {
  const a = target.data,
    b = mask.data;
  if (a.length !== b.length) throw new Error("Bit arrays must match in length");
  const len = a.length;

  switch (op) {
    case BitOperation.OR:
      for (let i = 0; i < len; i++) a[i] |= b[i];
      break;
    case BitOperation.AND:
      for (let i = 0; i < len; i++) a[i] &= b[i];
      break;
    case BitOperation.XOR:
      for (let i = 0; i < len; i++) a[i] ^= b[i];
      break;
    default:
      throw new Error(`Unsupported op: ${op}`);
  }
  return target;
}

function logBitArray(a) {
  const out = new Array(a.length);
  const d = a.data;
  for (let i = 0; i < a.length; i++) {
    out[i] = (d[i >>> SHIFT] >>> (i & MASK)) & 1;
  }
  return `BitArray [${a.length} bits]: ${out.join("")}`;
}

function popCount(a) {
  const u8 = new Uint8Array(a.data.buffer);
  let sum = 0;
  for (let i = 0; i < u8.length; i++) sum += LOOKUP[u8[i]];
  return sum;
}

function copyBitArray(a) {
  const c = createBitArray(a.length);
  c.data.set(a.data);
  return c;
}

export {
  BitOperation,
  createBitArray,
  enableBit,
  disableBit,
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

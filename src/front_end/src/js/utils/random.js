export const random = (() => {
  let s = performance.now() & 0x7fffffff; // Use current timestamp as seed (masked to fit in 31 bits)

  return () => {
    // Park-Miller Linear Congruential Generator (LCG) algorithm
    s = (s * 16807) & 0x7fffffff;
    return s / 0x7fffffff;
  };
})();

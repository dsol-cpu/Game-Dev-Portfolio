const PERFORMANCE_LEVELS = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

/**
 * Check if the device is likely to be low-powered
 * @returns {boolean} - Whether the device is likely low-powered
 */
export function isLowPoweredDevice() {
  // Check for mobile devices first
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Check for hardware concurrency
  const cpuCores = navigator.hardwareConcurrency || 1;

  // Use deviceMemory if available (Chrome)
  const lowMemory =
    navigator.deviceMemory !== undefined && navigator.deviceMemory < 4;

  // Use battery API if available
  if ("getBattery" in navigator) {
    navigator
      .getBattery()
      .then((battery) => {
        // Device is charging with low battery might indicate low power mode
        if (!battery.charging && battery.level < 0.2) {
          return true;
        }
      })
      .catch(() => {});
  }

  // Consider a device low powered if it's mobile AND has either low memory or few CPU cores
  return isMobile && (lowMemory || cpuCores <= 4);
}

/**
 * Check if the browser supports WebGL
 * @returns {boolean} True if WebGL is supported
 */
export function hasWebGLSupport() {
  try {
    // Try to create a WebGL context
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    // Return true if we could get a WebGL context
    return !!gl;
  } catch (e) {
    console.error("Error checking WebGL support:", e);
    return false;
  }
}

/**
 * Determine the performance level of the device
 * This is used to adjust rendering quality
 * @returns {string} Performance level: 'high', 'medium', or 'low'
 */
export function getPerfLevel() {
  // Check if WebGL is supported at all
  if (!hasWebGLSupport()) {
    return PERFORMANCE_LEVELS.LOW;
  }

  // Create temporary canvas and get GL context for testing
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  if (!gl) {
    return PERFORMANCE_LEVELS.LOW;
  }

  try {
    // Get device information
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : "";

    // Check if this is a mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Check for high-end GPU indicators
    const isHighEndGPU =
      renderer &&
      (/NVIDIA/i.test(renderer) ||
        /AMD/i.test(renderer) ||
        /Radeon/i.test(renderer) ||
        /Intel Iris/i.test(renderer) ||
        /Apple M1/i.test(renderer) ||
        /Apple M2/i.test(renderer));

    // Check browser performance (approximate)
    const performanceCheck = measurePerformance();

    // Determine performance level
    if (isMobile) {
      return performanceCheck > 50
        ? PERFORMANCE_LEVELS.MEDIUM
        : PERFORMANCE_LEVELS.LOW;
    } else if (isHighEndGPU && performanceCheck > 80) {
      return PERFORMANCE_LEVELS.HIGH;
    } else if (performanceCheck > 40) {
      return PERFORMANCE_LEVELS.MEDIUM;
    } else {
      return PERFORMANCE_LEVELS.LOW;
    }
  } catch (e) {
    console.warn("Error determining performance level:", e);
    return PERFORMANCE_LEVELS.MEDIUM; // Default to medium if we can't determine
  }
}

/**
 * Measure general browser performance
 * @returns {number} Performance score (0-100)
 */
function measurePerformance() {
  const start = performance.now();

  // Simple computational test
  let result = 0;
  for (let i = 0; i < 100000; i++) {
    result += Math.sin(i) * Math.cos(i);
  }

  const duration = performance.now() - start;

  // Convert duration to a score (0-100)
  // Lower duration = higher score
  // Calibrated so ~50ms = 50 score
  const score = Math.min(100, Math.max(0, 100 - duration / 2));

  return score;
}

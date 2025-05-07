/**
 * Device performance detection module
 *
 * Provides utilities to detect device performance capabilities
 * and determine appropriate rendering settings.
 */

export const PERFORMANCE_LEVELS = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

/**
 * Comprehensive device performance detection
 * @returns {string} Performance level: 'high', 'medium', or 'low'
 */
export function detectDevicePerformance() {
  // Start with baseline checks
  const checks = {
    webgl: checkWebGLSupport(),
    hardware: checkHardwareCapabilities(),
    browser: checkBrowserPerformance(),
  };

  // Combine results for final determination
  if (!checks.webgl.supported) {
    return PERFORMANCE_LEVELS.LOW;
  }

  // Calculate weighted score (0-100)
  const score =
    checks.webgl.score * 0.4 +
    checks.hardware.score * 0.4 +
    checks.browser.score * 0.2;

  // Map score to performance level
  if (score >= 70) {
    return PERFORMANCE_LEVELS.HIGH;
  } else if (score >= 40) {
    return PERFORMANCE_LEVELS.MEDIUM;
  } else {
    return PERFORMANCE_LEVELS.LOW;
  }
}

/**
 * Check WebGL support and capabilities
 * @returns {Object} WebGL support information
 */
function checkWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) {
      return { supported: false, score: 0 };
    }

    // Check for WebGL2 support
    const isWebGL2 = canvas.getContext("webgl2") !== null;

    // Get renderer information if available
    let renderer = "Unknown";
    let score = 50; // Default middle score

    try {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        renderer =
          gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Unknown";

        // Score based on GPU vendor/model
        if (
          /NVIDIA RTX|AMD Radeon RX 6|Radeon RX 7|Intel Arc/i.test(renderer)
        ) {
          score = 90; // High-end dedicated GPU
        } else if (
          /NVIDIA|AMD|Radeon|Intel Iris|Apple M1|Apple M2|Apple M3|Mali-G7|Adreno 6|Adreno 7/i.test(
            renderer
          )
        ) {
          score = 70; // Mid to high-range GPU
        } else if (/Intel HD|Intel UHD|Mali-T|Adreno 5/i.test(renderer)) {
          score = 40; // Low to mid-range GPU
        } else if (/PowerVR|Mali-4|Adreno 3/i.test(renderer)) {
          score = 20; // Older mobile GPU
        }
      }
    } catch (e) {
      console.warn("Error getting WebGL renderer info:", e);
    }

    // Check max texture size as performance indicator
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const textureScore = Math.min(100, (maxTextureSize / 16384) * 100);

    // Combine scores
    score = score * 0.7 + textureScore * 0.3;

    // WebGL2 bonus
    if (isWebGL2) {
      score = Math.min(100, score + 10);
    }

    return {
      supported: true,
      renderer,
      isWebGL2,
      maxTextureSize,
      score,
    };
  } catch (e) {
    console.error("Error checking WebGL support:", e);
    return { supported: false, score: 0 };
  }
}

/**
 * Check hardware capabilities (CPU, memory, device type)
 * @returns {Object} Hardware capability information
 */
function checkHardwareCapabilities() {
  const result = {
    isMobile: false,
    cpuCores: 1,
    memoryLimited: false,
    batteryLimited: false,
    score: 50, // Default score
  };

  // Check if mobile device
  result.isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // CPU cores
  result.cpuCores = navigator.hardwareConcurrency || 1;

  // Memory check (if available)
  if (navigator.deviceMemory !== undefined) {
    result.memoryGB = navigator.deviceMemory;
    result.memoryLimited = navigator.deviceMemory < 4;
  }

  // Calculate hardware score
  let hardwareScore = 0;

  // CPU score (0-40)
  const cpuScore = Math.min(40, (result.cpuCores / 16) * 40);

  // Memory score (0-40)
  const memoryScore =
    navigator.deviceMemory !== undefined
      ? Math.min(40, (navigator.deviceMemory / 8) * 40)
      : 20; // Default if unknown

  // Device type score (0-20)
  const deviceTypeScore = result.isMobile ? 10 : 20;

  // Combined hardware score
  result.score = cpuScore + memoryScore + deviceTypeScore;

  // Check for battery status (async, won't affect immediate score)
  if ("getBattery" in navigator) {
    navigator
      .getBattery()
      .then((battery) => {
        result.batteryLimited = !battery.charging && battery.level < 0.2;

        // If device is in critical battery, store that info for later checks
        if (result.batteryLimited) {
          window.__deviceBatteryLimited = true;
        }
      })
      .catch(() => {});
  }

  return result;
}

/**
 * Measure browser performance using more reliable benchmarks
 * @returns {Object} Browser performance metrics
 */
function checkBrowserPerformance() {
  // Start with a default score
  let score = 50;

  try {
    // Check for requestAnimationFrame support
    const hasRAF = typeof window.requestAnimationFrame === "function";

    // More accurate computational benchmark
    const start = performance.now();

    // Use a mix of operations that better represent real-world usage
    let result1 = 0,
      result2 = 0;
    const size = 10000;

    // Array operations
    const array = new Array(size);
    for (let i = 0; i < size; i++) {
      array[i] = Math.random();
    }

    // Sorting (common operation)
    array.sort();

    // Math operations (common in graphics)
    for (let i = 0; i < size; i++) {
      result1 += Math.sin(i * 0.01) * Math.cos(i * 0.01);
      result2 += Math.sqrt(i) * Math.log(i + 1);
    }

    const duration = performance.now() - start;

    // Calculate score based on duration
    // Calibrated so a high-end device would score ~90
    score = Math.min(100, Math.max(0, 100 - duration / 5));

    return {
      benchmarkTime: duration,
      hasRAF,
      score,
    };
  } catch (e) {
    console.warn("Error during browser performance check:", e);
    return { score };
  }
}

/**
 * Simplified helper for backwards compatibility
 * @returns {boolean} Whether the device is likely low-powered
 */
export function isLowPoweredDevice() {
  return detectDevicePerformance() === PERFORMANCE_LEVELS.LOW;
}

/**
 * Simplified helper for backwards compatibility
 * @returns {boolean} Whether WebGL is supported
 */
export function hasWebGLSupport() {
  return checkWebGLSupport().supported;
}

/**
 * Simplified helper for backwards compatibility
 * @returns {string} Performance level
 */
export function getPerfLevel() {
  return detectDevicePerformance();
}

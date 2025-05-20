/**
 * Device Performance Detection Module
 *
 * Checks the device performance
 *
 * */

// Constants and configuration
export const PERFORMANCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

// Cache key for performance results
const PERF_CACHE_KEY = "device_performance_profile";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Main detection function with caching and progressive enhancement
 * @param {Object} options - Configuration options
 * @param {boolean} options.forceRefresh - Force fresh detection ignoring cache
 * @param {boolean} options.asyncMode - Return a promise with complete results (more accurate)
 * @returns {string|Promise<string>} Performance level or Promise resolving to performance level
 */
export function detectDevicePerformance(options = {}) {
  const { forceRefresh = false, asyncMode = false } = options;

  // Try to use cached results first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedPerformance();
    if (cached) return asyncMode ? Promise.resolve(cached) : cached;
  }

  // Quick synchronous detection for immediate feedback
  const quickResult = getQuickPerformanceEstimate();

  // For synchronous mode, cache and return quick result
  if (!asyncMode) {
    cachePerformanceResult(quickResult);
    return quickResult;
  }

  // For async mode, return promise with more thorough detection
  return new Promise((resolve) => {
    // Use requestIdleCallback if available to avoid impacting critical rendering
    const scheduleTask = window.requestIdleCallback || window.setTimeout;

    scheduleTask(
      () => {
        const thoroughChecks = {
          webgl: checkWebGLSupport(),
          hardware: checkHardwareCapabilities(),
          browser: checkBrowserPerformance(),
        };

        // Run advanced WebGL benchmark if high-end is suspected
        if (thoroughChecks.webgl.score > 60) {
          runAdvancedWebGLBenchmark().then((advancedScore) => {
            thoroughChecks.webgl.advancedScore = advancedScore;
            const finalResult = calculateFinalPerformanceLevel(thoroughChecks);
            cachePerformanceResult(finalResult);
            resolve(finalResult);
          });
        } else {
          const finalResult = calculateFinalPerformanceLevel(thoroughChecks);
          cachePerformanceResult(finalResult);
          resolve(finalResult);
        }
      },
      { timeout: 2000 }
    );
  });
}

/**
 * Quick performance estimate for synchronous contexts
 * @returns {string} Estimated performance level
 */
function getQuickPerformanceEstimate() {
  try {
    // Quick hardware checks
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(
      navigator.userAgent
    );
    const cpuCores = navigator.hardwareConcurrency || 1;
    const deviceMemory = navigator.deviceMemory || (isMobile ? 2 : 4);

    // Basic WebGL check
    let webGLSupported = false;
    try {
      const canvas = document.createElement("canvas");
      webGLSupported = !!(
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      );
    } catch {
      webGLSupported = false;
    }

    if (!webGLSupported) return PERFORMANCE_LEVELS.LOW;

    // Quick score calculation
    const score =
      (cpuCores / 8) * 50 + (deviceMemory / 8) * 30 + (isMobile ? 0 : 20);

    if (score >= 70) return PERFORMANCE_LEVELS.HIGH;
    if (score >= 40) return PERFORMANCE_LEVELS.MEDIUM;
    return PERFORMANCE_LEVELS.LOW;
  } catch {
    return PERFORMANCE_LEVELS.MEDIUM; // Fallback to medium on error
  }
}

/**
 * Advanced check for WebGL capabilities with GPU detection
 * @returns {Object} Detailed WebGL support information
 */
function checkWebGLSupport() {
  try {
    // Create offscreen canvas to avoid DOM manipulation
    const canvas = document.createElement("canvas");
    let gl = canvas.getContext("webgl2");
    const isWebGL2 = !!gl;

    if (!gl) {
      gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    }

    if (!gl) {
      return { supported: false, score: 0 };
    }

    // GPU detection with improved vendor recognition
    let renderer = "Unknown";
    let gpuVendor = "Unknown";
    let gpuTier = 0;

    try {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        renderer =
          gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Unknown";
        gpuVendor =
          gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "Unknown";

        // GPU tier detection with more comprehensive database
        gpuTier = detectGPUTier(renderer);
      }
    } catch {
      console.warn("WebGL renderer info unavailable");
    }

    // Performance indicators with progressive enhancement
    const capabilities = {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxCubeMapSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
      maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxFragmentUniformVectors: gl.getParameter(
        gl.MAX_FRAGMENT_UNIFORM_VECTORS
      ),
      aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
    };

    // Extensions support
    const extensions = {
      anisotropicFiltering: gl.getExtension("EXT_texture_filter_anisotropic"),
      floatTextures: gl.getExtension("OES_texture_float"),
      instancedArrays: gl.getExtension("ANGLE_instanced_arrays"),
      depthTextures: gl.getExtension("WEBGL_depth_texture"),
      derivatives: gl.getExtension("OES_standard_derivatives"),
    };

    // Calculate extension score
    const extensionScore = Object.values(extensions).filter(Boolean).length * 5;

    // Calculate weighted score
    const textureScore = Math.min(
      100,
      (capabilities.maxTextureSize / 16384) * 100
    );
    const baseScore = gpuTier * 20;

    let score = baseScore * 0.6 + textureScore * 0.2 + extensionScore * 0.2;

    // WebGL2 bonus
    if (isWebGL2) {
      score = Math.min(100, score * 1.15);
    }

    return {
      supported: true,
      renderer,
      vendor: gpuVendor,
      isWebGL2,
      capabilities,
      extensions: Object.fromEntries(
        Object.entries(extensions).map(([key, val]) => [key, !!val])
      ),
      gpuTier,
      score: Math.round(score),
    };
  } catch (e) {
    console.error("Error during WebGL detection:", e);
    return { supported: false, score: 0 };
  }
}

/**
 * Detect GPU tier based on renderer string
 * @param {string} renderer - WebGL renderer string
 * @returns {number} GPU tier (0-5, higher is better)
 */
function detectGPUTier(renderer) {
  const r = renderer.toLowerCase();

  // Tier 5: Latest high-end dedicated GPUs
  if (
    /nvidia r?tx\s*(30|40|50|4090|4080|3090|3080)/i.test(r) ||
    /radeon\s*rx\s*(7|69|68)/i.test(r) ||
    /arc\s*a[7-9]/i.test(r)
  ) {
    return 5;
  }

  // Tier 4: Recent high-end dedicated GPUs
  if (
    /nvidia r?tx|nvidia gtx\s*1[6-9]|nvidia gtx\s*2|radeon\s*rx\s*(6|5[7-9])/i.test(
      r
    ) ||
    /apple\s*m[2-3]|intel arc/i.test(r)
  ) {
    return 4;
  }

  // Tier 3: Mid-range dedicated GPUs and high-end integrated
  if (
    /nvidia gtx\s*[1-9]\d{2,}|radeon\s*(rx\s*5|vega)|iris xe|mali-g7|adreno\s*[6-7]/i.test(
      r
    ) ||
    /apple\s*m1/i.test(r)
  ) {
    return 3;
  }

  // Tier 2: Low-end dedicated GPUs and mid-range integrated
  if (
    /nvidia gt\s*[6-9]|intel\s*u?hd\s*[6-9]|iris\s*(plus|pro)|mali-g[56]|adreno\s*5/i.test(
      r
    )
  ) {
    return 2;
  }

  // Tier 1: Basic integrated GPUs
  if (/intel\s*u?hd|mali|adreno|powervr/i.test(r)) {
    return 1;
  }

  // Tier 0: Unknown or very old
  return 0;
}

/**
 * Run advanced WebGL benchmark for high-end devices
 * @returns {Promise<number>} Advanced score 0-100
 */
function runAdvancedWebGLBenchmark() {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

      if (!gl) {
        resolve(0);
        return;
      }

      // Size based on device pixel ratio for consistent testing
      const pixelRatio = window.devicePixelRatio || 1;
      const size = Math.min(1024, 512 * pixelRatio);
      canvas.width = canvas.height = size;

      // Create shader program
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(
        vertexShader,
        `
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `
      );
      gl.compileShader(vertexShader);

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(
        fragmentShader,
        `
        precision highp float;
        uniform vec2 resolution;
        uniform float time;

        void main() {
          vec2 uv = gl.FragCoord.xy / resolution;
          float x = uv.x * 30.0 + sin(time);
          float y = uv.y * 30.0 + cos(time);

          for(int i = 0; i < 20; i++) {
            float z = float(i) * 0.05;
            x = x + 0.5 * sin(y + z * time);
            y = y - 0.5 * cos(x + z * (time + 0.5));
          }

          vec3 color = vec3(
            sin(x) * 0.5 + 0.5,
            cos(y) * 0.5 + 0.5,
            sin(x+y) * 0.5 + 0.5
          );

          gl_FragColor = vec4(color, 1.0);
        }
      `
      );
      gl.compileShader(fragmentShader);

      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);

      // Create geometry
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );

      // Setup attributes
      const positionLocation = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Get uniform locations
      const resolutionLocation = gl.getUniformLocation(program, "resolution");
      const timeLocation = gl.getUniformLocation(program, "time");

      // Set resolution uniform
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      // Run benchmark
      const frameCount = 100;
      let frames = 0;
      const startTime = performance.now();

      function renderFrame() {
        if (frames >= frameCount) {
          const duration = performance.now() - startTime;
          const fps = (1000 * frames) / duration;

          // Calculate score (normalized to expected range of fps)
          // 60fps = ~70 score, 120fps = ~90 score, 30fps = ~50 score
          const score = Math.min(100, Math.max(0, 40 + fps * 0.5));

          // Clean up resources
          gl.deleteProgram(program);
          gl.deleteShader(vertexShader);
          gl.deleteShader(fragmentShader);
          gl.deleteBuffer(buffer);

          resolve(Math.round(score));
          return;
        }

        // Update time uniform
        gl.uniform1f(timeLocation, frames * 0.05);

        // Draw
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        frames++;
        requestAnimationFrame(renderFrame);
      }

      renderFrame();
    } catch (e) {
      console.error("WebGL benchmark failed:", e);
      resolve(30); // Fallback score
    }
  });
}

/**
 * Check hardware capabilities with enhanced detection
 * @returns {Object} Detailed hardware capability information
 */
function checkHardwareCapabilities() {
  const result = {
    deviceType: "unknown",
    cpuCores: navigator.hardwareConcurrency || 1,
    memoryGB: navigator.deviceMemory || 0,
    screenInfo: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
      touchPoints: navigator.maxTouchPoints || 0,
    },
    connection: null,
    batteryStatus: null,
    score: 50,
  };

  // Enhanced device type detection
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  ) {
    result.deviceType = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent)
      ? "tablet"
      : "mobile";
  } else {
    result.deviceType = "desktop";
  }

  // CPU performance estimation
  const cpuScore = Math.min(40, (result.cpuCores / 16) * 40);

  // Memory score
  const memoryScore = result.memoryGB
    ? Math.min(40, (result.memoryGB / 8) * 40)
    : 20;

  // Device type score adjustment
  let deviceTypeScore =
    result.deviceType === "desktop"
      ? 20
      : result.deviceType === "tablet"
      ? 15
      : 10;

  // Screen resolution quality factor
  const totalPixels =
    result.screenInfo.width *
    result.screenInfo.height *
    result.screenInfo.pixelRatio;
  const screenQualityScore = Math.min(
    15,
    (totalPixels / (1920 * 1080 * 2)) * 15
  );

  // Network connection if available
  if (navigator.connection) {
    result.connection = {
      type: navigator.connection.effectiveType || "unknown",
      downlink: navigator.connection.downlink || 0,
      rtt: navigator.connection.rtt || 0,
      saveData: navigator.connection.saveData || false,
    };

    // Adjust score for network conditions
    const networkPenalty = result.connection.saveData
      ? -10
      : result.connection.effectiveType === "4g"
      ? 0
      : result.connection.effectiveType === "3g"
      ? -5
      : -10;

    deviceTypeScore += networkPenalty;
  }

  // Battery status check
  if ("getBattery" in navigator) {
    navigator
      .getBattery()
      .then((battery) => {
        result.batteryStatus = {
          charging: battery.charging,
          level: battery.level,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
        };

        // Store in window for power-saving behaviors
        window.__deviceBatteryStatus = result.batteryStatus;

        // Power saving mode detection
        if (battery.level < 0.2 && !battery.charging) {
          window.__deviceLowPowerMode = true;
        }
      })
      .catch(() => {});
  }

  // Calculate final hardware score
  result.score = cpuScore + memoryScore + deviceTypeScore + screenQualityScore;
  return result;
}

/**
 * Advanced browser performance measurement with progressive enhancement
 * @returns {Object} Detailed browser performance metrics
 */
function checkBrowserPerformance() {
  const result = {
    features: {},
    benchmark: {},
    score: 50,
  };

  // Feature detection with progressive enhancement
  result.features = {
    requestAnimationFrame: typeof window.requestAnimationFrame === "function",
    requestIdleCallback: typeof window.requestIdleCallback === "function",
    serviceWorker: "serviceWorker" in navigator,
    webWorkers: typeof Worker === "function",
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
    webAssembly: typeof WebAssembly === "object",
    offscreenCanvas: typeof OffscreenCanvas === "function",
    customElements: "customElements" in window,
  };

  // Feature score
  const featureCount = Object.values(result.features).filter(Boolean).length;
  const featureScore = (featureCount / 8) * 25;

  try {
    const start = performance.now();

    // Mixed operations benchmark
    const benchmarkSize = 25000;
    let sum = 0;

    // Array operations
    const array = new Float64Array(benchmarkSize);
    for (let i = 0; i < benchmarkSize; i++) {
      array[i] = random();
    }

    // Sort benchmark (partial, to avoid excessive time)
    const sampleToSort = array.slice(0, 10000);
    sampleToSort.sort();

    // Math operations (trigonometry and square roots are common in graphics)
    for (let i = 0; i < benchmarkSize; i++) {
      sum += Math.sin(i * 0.01) * Math.cos(i * 0.01);
      if (i % 10 === 0) {
        sum += Math.sqrt(i) * Math.log(i + 1);
      }
    }

    // String operations
    let testString = "performance";
    for (let i = 0; i < 5000; i++) {
      testString += i;
      testString = testString.substring(1);
    }

    const duration = performance.now() - start;

    // Record benchmark results
    result.benchmark = {
      totalTime: duration,
      operationsPerMs: benchmarkSize / duration,
    };

    // Calculate score based on duration
    // Adjusted for more realistic scoring range
    // 50ms (very fast) = 90 score, 500ms (slow) = 30 score
    const benchmarkScore = Math.min(75, Math.max(0, 100 - duration / 10));

    // Final score combining features and benchmark
    result.score = Math.round(benchmarkScore * 0.75 + featureScore * 0.25);
  } catch (e) {
    console.warn("Error during browser performance benchmark:", e);
  }

  return result;
}

/**
 * Calculate final performance level from all collected metrics
 * @param {Object} checks - All performance check results
 * @returns {string} Performance level
 */
function calculateFinalPerformanceLevel(checks) {
  // Early exit for no WebGL
  if (!checks.webgl.supported) {
    return PERFORMANCE_LEVELS.LOW;
  }

  // Adjust WebGL score if advanced benchmark was run
  const webglScore = checks.webgl.advancedScore || checks.webgl.score;

  // Calculate weighted score with dynamic weighting based on available information
  let weights = {
    webgl: 0.4,
    hardware: 0.4,
    browser: 0.2,
  };

  // If advanced WebGL benchmark was run, give it more weight
  if (checks.webgl.advancedScore) {
    weights.webgl = 0.5;
    weights.hardware = 0.3;
    weights.browser = 0.2;
  }

  // Calculate final score
  const score =
    webglScore * weights.webgl +
    checks.hardware.score * weights.hardware +
    checks.browser.score * weights.browser;

  // Apply special case adjustments

  // Low memory override: Memory is crucial for high-end applications
  if (checks.hardware.memoryGB && checks.hardware.memoryGB < 2) {
    return PERFORMANCE_LEVELS.LOW;
  }

  // Battery saving mode consideration
  if (window.__deviceLowPowerMode === true) {
    // In low power mode, downgrade by one level unless already LOW
    if (score >= 70) return PERFORMANCE_LEVELS.MEDIUM;
    return PERFORMANCE_LEVELS.LOW;
  }

  // Map score to performance level with thresholds
  if (score >= 70) {
    return PERFORMANCE_LEVELS.HIGH;
  } else if (score >= 40) {
    return PERFORMANCE_LEVELS.MEDIUM;
  } else {
    return PERFORMANCE_LEVELS.LOW;
  }
}

/**
 * Cache performance result
 * @param {string} level - Performance level to cache
 */
function cachePerformanceResult(level) {
  try {
    localStorage.setItem(
      PERF_CACHE_KEY,
      JSON.stringify({
        level,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn("Failed to cache performance result:", e);
  }
}

/**
 * Get cached performance result if valid
 * @returns {string|null} Cached performance level or null
 */
function getCachedPerformance() {
  try {
    const cached = localStorage.getItem(PERF_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    // Check if cache is still valid
    if (age < CACHE_DURATION_MS) {
      return data.level;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Simplified helper for backwards compatibility
 * @returns {boolean} Whether the device is likely low-powered
 */
export function isLowPoweredDevice() {
  // Use cached result if available
  const cached = getCachedPerformance();
  if (cached) return cached === PERFORMANCE_LEVELS.LOW;

  // Otherwise do quick check
  return getQuickPerformanceEstimate() === PERFORMANCE_LEVELS.LOW;
}

/**
 * Simplified helper for backwards compatibility
 * @returns {boolean} Whether WebGL is supported
 */
export function hasWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

/**
 * Simplified helper for backwards compatibility
 * @returns {string} Performance level
 */
export function getPerfLevel() {
  return detectDevicePerformance();
}

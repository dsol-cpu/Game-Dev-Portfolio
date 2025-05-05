/**
 * TimeManager.js - Singleton time management system for game and rendering synchronization
 * Uses performance.now() for high-precision timing with reduced lag
 */
export const TimeManager = (function () {
  // Private instance
  const instance = {
    // Time tracking
    lastFrameTime: 0,
    deltaTime: 0,
    fixedDeltaTime: 16.667, // 60fps in ms
    maxDeltaTime: 25.0, // Cap at ~30 FPS equivalent
    timeScale: 1.0, // For slow-mo effects if needed

    // REDUCED smoothing to minimize lag
    smoothingFactor: 0.1, // Lower value reduces lag but may increase jitter
    smoothedDeltaTime: 0,
    previousDeltas: [], // Store recent deltas for median filtering
    deltaSampleSize: 7, // Smaller sample reduces lag

    // Fixed timestep accumulation
    timeAccumulator: 0,

    // Performance monitoring
    frameCount: 0,
    fpsUpdateInterval: 500, // Update FPS display every 500ms
    lastFpsUpdate: 0,
    currentFps: 0,

    // History tracking for debugging
    timeHistory: [],
    maxHistorySize: 60, // 1 second at 60fps

    // Idle state handling - now relying on user-interaction.js
    idleThreshold: 100, // Time in ms before considered idle
    idleThrottle: 250, // Throttle to 4fps when idle
    isIdle: false,
    wasIdleLastFrame: false,

    // Focus state tracking
    hadFocus: true,
    hasFocus: true,
    lastInteractionTime: 0,

    // Direct timing mode - bypass smoothing when true
    directTimingMode: false,
  };

  /**
   * Apply median filtering to smooth out spikes
   * @param {number} newDelta - The new delta time value to filter
   * @returns {number} - Filtered delta time
   */
  const applyMedianFilter = (newDelta) => {
    // Add new delta to array
    instance.previousDeltas.push(newDelta);

    // Keep only the most recent samples
    if (instance.previousDeltas.length > instance.deltaSampleSize) {
      instance.previousDeltas.shift();
    }

    // Sort a copy of the array to find median
    const sortedDeltas = [...instance.previousDeltas].sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedDeltas.length / 2);

    return sortedDeltas[medianIndex];
  };

  /**
   * Apply exponential moving average to smooth delta time
   * @param {number} newDelta - The new delta time value
   * @returns {number} - Smoothed delta time
   */
  const applyEMA = (newDelta) => {
    if (instance.smoothedDeltaTime === 0) {
      return newDelta; // First frame, no smoothing
    }

    return (
      instance.smoothingFactor * newDelta +
      (1 - instance.smoothingFactor) * instance.smoothedDeltaTime
    );
  };

  // Track window focus state
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => {
      instance.hasFocus = true;
      instance.lastInteractionTime = performance.now();
    });

    window.addEventListener("blur", () => {
      instance.hasFocus = false;
    });
  }

  // Public interface
  return {
    /**
     * Update time values based on current timestamp
     * @param {number} timestamp - Current timestamp (from requestAnimationFrame)
     * @param {string} clientId - ID of the client requesting the update
     * @returns {Object} Time information for this frame
     */
    update(timestamp, clientId = "unknown") {
      // Get current high-precision timestamp if not provided
      if (timestamp === undefined) {
        timestamp = performance.now();
      }

      // Initialize on first call
      if (instance.lastFrameTime === 0) {
        instance.lastFrameTime = timestamp;
        instance.lastFpsUpdate = timestamp;
        instance.smoothedDeltaTime = instance.fixedDeltaTime;
        instance.lastInteractionTime = timestamp;

        // Initialize the previousDeltas array with a reasonable starting value
        for (let i = 0; i < instance.deltaSampleSize; i++) {
          instance.previousDeltas.push(instance.fixedDeltaTime);
        }

        return {
          deltaTime: instance.fixedDeltaTime / 1000,
          fixedDeltaTime: instance.fixedDeltaTime / 1000,
          isIdle: false,
        };
      }

      // Calculate raw delta time
      const rawDeltaTime = timestamp - instance.lastFrameTime;
      instance.lastFrameTime = timestamp;

      // Get idle state from user-interaction.js
      instance.isIdle =
        typeof isIdle === "function" ? isIdle() : instance.isIdle;

      // Detect focus changes
      const focusChanged = instance.hasFocus !== instance.hadFocus;
      instance.hadFocus = instance.hasFocus;

      // When focus is regained, force a non-idle state and reset the timer
      if (focusChanged && instance.hasFocus) {
        this.registerActivity();
        instance.isIdle = false;
        instance.wasIdleLastFrame = true; // Force delta reset on next frame
      }

      // If idle and throttling enabled, check if we should skip this frame
      // Don't skip frames immediately after regaining focus
      if (
        instance.isIdle &&
        !focusChanged &&
        rawDeltaTime < instance.idleThrottle
      ) {
        return { skipFrame: true, client: clientId };
      }

      // CRITICAL FIX: Direct timing mode skips all smoothing
      if (instance.directTimingMode) {
        // Just clamp the raw value to prevent extreme values
        instance.deltaTime =
          Math.min(
            Math.max(rawDeltaTime, 1.0), // 1ms minimum
            instance.maxDeltaTime
          ) * instance.timeScale;
      }
      // Handle transitions from idle state - prevent huge delta spikes
      else if (
        (instance.wasIdleLastFrame && !instance.isIdle) ||
        (focusChanged && instance.hasFocus) ||
        rawDeltaTime > instance.maxDeltaTime * 2
      ) {
        // We just came back from idle or window regained focus - use a reasonable delta instead of the actual time
        instance.wasIdleLastFrame = false;
        instance.deltaTime = instance.fixedDeltaTime;

        // Reset the smoothing history to prevent old values from causing lag
        instance.previousDeltas = Array(instance.deltaSampleSize).fill(
          instance.fixedDeltaTime
        );
        instance.smoothedDeltaTime = instance.fixedDeltaTime;
      } else {
        // Normal frame processing
        // Clamp delta time to prevent spiral of death at low framerates
        // Also enforce a minimum deltaTime to ensure movement never stalls
        const MINIMUM_DELTA_TIME = 1.0; // 1ms minimum (before timeScale)

        // Store idle state for next frame
        instance.wasIdleLastFrame = instance.isIdle;

        // Apply clamping to raw delta time
        const clampedDelta = Math.min(
          Math.max(rawDeltaTime, MINIMUM_DELTA_TIME),
          instance.maxDeltaTime
        );

        // Apply median filter to remove outliers
        const medianFilteredDelta = applyMedianFilter(clampedDelta);

        // Apply exponential moving average for final smoothing
        instance.smoothedDeltaTime = applyEMA(medianFilteredDelta);

        // Apply time scale
        instance.deltaTime = instance.smoothedDeltaTime * instance.timeScale;
      }

      // Update time accumulator for fixed timestep simulation
      instance.timeAccumulator += instance.deltaTime;

      // Track history for debugging
      instance.timeHistory.push({
        timestamp,
        raw: rawDeltaTime,
        smoothed: instance.smoothedDeltaTime,
        final: instance.deltaTime,
      });

      // Keep history at reasonable size
      if (instance.timeHistory.length > instance.maxHistorySize) {
        instance.timeHistory.shift();
      }

      // Update FPS counter
      instance.frameCount++;
      if (timestamp - instance.lastFpsUpdate > instance.fpsUpdateInterval) {
        instance.currentFps = Math.round(
          (instance.frameCount * 1000) / (timestamp - instance.lastFpsUpdate)
        );
        instance.lastFpsUpdate = timestamp;
        instance.frameCount = 0;
      }

      const safetyDeltaTime = Math.max(instance.deltaTime / 1000, 0.00001); // Never return less than 0.00001s

      return {
        deltaTime: safetyDeltaTime, // Ensure non-zero value
        fixedDeltaTime: instance.fixedDeltaTime / 1000,
        rawDeltaTime: rawDeltaTime / 1000,
        timeAccumulator: instance.timeAccumulator / 1000,
        isIdle: instance.isIdle,
        fps: instance.currentFps,
        client: clientId,
        hasFocus: instance.hasFocus,
      };
    },

    /**
     * Consume time from the accumulator for fixed timestep simulation
     * @returns {boolean} - Whether there's enough accumulated time for a physics step
     */
    consumeFixedTimestep() {
      if (instance.timeAccumulator >= instance.fixedDeltaTime) {
        instance.timeAccumulator -= instance.fixedDeltaTime;
        return true;
      }
      return false;
    },

    /**
     * Register user activity
     * Updates last interaction time and forwards to user-interaction.js if available
     */
    registerActivity() {
      // Update internal interaction time
      instance.lastInteractionTime = performance.now();

      // If handleUserInteraction is available, use it
      if (typeof handleUserInteraction === "function") {
        handleUserInteraction();
      }
      return this; // For chaining
    },

    /**
     * Configure time manager settings
     * @param {Object} options - Configuration options
     */
    configure(options = {}) {
      // Apply options if provided
      if (options.fixedDeltaTime !== undefined)
        instance.fixedDeltaTime = options.fixedDeltaTime;
      if (options.maxDeltaTime !== undefined)
        instance.maxDeltaTime = options.maxDeltaTime;
      if (options.timeScale !== undefined)
        instance.timeScale = options.timeScale;
      if (options.idleThrottle !== undefined)
        instance.idleThrottle = options.idleThrottle;
      if (options.smoothingFactor !== undefined)
        instance.smoothingFactor = options.smoothingFactor;
      if (options.deltaSampleSize !== undefined) {
        instance.deltaSampleSize = options.deltaSampleSize;
        // Resize the previousDeltas array if needed
        instance.previousDeltas = instance.previousDeltas.slice(
          -instance.deltaSampleSize
        );
        // Fill with fixedDeltaTime if array is smaller than sample size
        while (instance.previousDeltas.length < instance.deltaSampleSize) {
          instance.previousDeltas.unshift(instance.fixedDeltaTime);
        }
      }
      // NEW OPTION: directTimingMode - bypass smoothing
      if (options.directTimingMode !== undefined)
        instance.directTimingMode = options.directTimingMode;

      return this; // For chaining
    },

    /**
     * Get current time configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
      return {
        fixedDeltaTime: instance.fixedDeltaTime,
        maxDeltaTime: instance.maxDeltaTime,
        timeScale: instance.timeScale,
        idleThrottle: instance.idleThrottle,
        smoothingFactor: instance.smoothingFactor,
        deltaSampleSize: instance.deltaSampleSize,
        directTimingMode: instance.directTimingMode,
      };
    },

    /**
     * Get current performance metrics
     * @returns {Object} Performance data
     */
    getPerformanceMetrics() {
      return {
        fps: instance.currentFps,
        isIdle: instance.isIdle,
        timeScale: instance.timeScale,
        hasFocus: instance.hasFocus,
        rawDeltaHistory: instance.timeHistory.map((entry) => entry.raw),
        smoothedDeltaHistory: instance.timeHistory.map(
          (entry) => entry.smoothed
        ),
      };
    },

    /**
     * Reset the time accumulator
     * Useful when changing scenes or when game is paused
     */
    resetAccumulator() {
      instance.timeAccumulator = 0;
      return this; // For chaining
    },

    /**
     * Set up integration with user-interaction.js
     * @param {Function} isIdleFunction - Reference to the isIdle function
     * @param {Function} onIdleStateChangeFunction - Reference to register for idle state changes
     */
    setupUserInteractionIntegration(isIdleFunction, onIdleStateChangeFunction) {
      // Store reference to isIdle function if provided
      if (typeof isIdleFunction === "function") {
        this.isIdleFunction = isIdleFunction;
      }

      // Register for idle state changes if function provided
      if (typeof onIdleStateChangeFunction === "function") {
        onIdleStateChangeFunction((idleState) => {
          instance.isIdle = idleState;
        });
      }

      return this; // For chaining
    },

    /**
     * Enable or disable direct timing mode
     * When enabled, bypasses all smoothing to eliminate lag
     * @param {boolean} enable - Whether to enable direct timing
     */
    setDirectTimingMode(enable) {
      instance.directTimingMode = enable;

      // If enabling direct mode, reset smoothing history
      if (enable) {
        const currentTime = performance.now();
        instance.lastFrameTime = currentTime;
        instance.previousDeltas = Array(instance.deltaSampleSize).fill(
          instance.fixedDeltaTime
        );
        instance.smoothedDeltaTime = instance.fixedDeltaTime;
      }

      return this; // For chaining
    },

    /**
     * Force a frame to be rendered regardless of idle state
     * Useful when coming back from idle or blur
     */
    forceFrame() {
      instance.wasIdleLastFrame = true; // This will trigger a fixed deltaTime on next frame
      instance.isIdle = false; // Temporarily disable idle state
      return this;
    },

    /**
     * Check if the window currently has focus
     */
    hasFocus() {
      return instance.hasFocus;
    },

    /**
     * Reset the time manager to eliminate any accumulated lag
     * Call this when experiencing persistent lag issues
     */
    resetTiming() {
      const currentTime = performance.now();
      instance.lastFrameTime = currentTime;
      instance.previousDeltas = Array(instance.deltaSampleSize).fill(
        instance.fixedDeltaTime
      );
      instance.smoothedDeltaTime = instance.fixedDeltaTime;
      instance.timeAccumulator = 0;
      return this;
    },
  };
})();

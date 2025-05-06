/**
 * TimeManager.js - Optimized time management system for game and rendering synchronization
 * Memory-efficient implementation with reduced heap allocations and improved performance
 */
export const TimeManager = (function () {
  const instance = {
    // Core timing - use primitive values where possible
    lastFrameTime: 0,
    deltaTime: 16.667, // Default to 60fps in ms
    fixedDeltaTime: 16.667,
    maxDeltaTime: 33.333, // ~30 FPS cap
    timeScale: 1.0,

    // Simplified smoothing with smaller buffer
    smoothingFactor: 0.2,
    smoothedDeltaTime: 16.667,
    deltas: new Float32Array(3), // Use typed array for better performance
    deltasIndex: 0,

    // Fixed timestep and performance tracking
    timeAccumulator: 0,
    frameCount: 0,
    fpsUpdateInterval: 1000, // Update FPS every second
    lastFpsUpdate: 0,
    currentFps: 60,

    // Reduced history tracking - use circular buffer with fixed size
    timeHistory: null, // Will be initialized as typed array
    historyIndex: 0,
    historySize: 0,
    maxHistorySize: 20,
    lastHistoryCleanup: 0,

    // Memory management
    lastMemoryManagement: 0,

    // State tracking
    isIdle: false,
    wasIdleLastFrame: false,
    idleThreshold: 100,
    idleThrottle: 250,
    hasFocus: true,
    hadFocus: true,
    lastInteractionTime: 0,

    // Configuration flags - grouped for better cache locality
    directTimingMode: false,
    driftDetected: false,
    frameCapping: true,
    isDisposed: false,

    // FPS Cap settings - store as inverse for faster calculations
    targetFPS: 60,
    frameTimeLimit: 16.667,
    lastFrameStartTime: 0,

    // Event handling
    eventHandlers: null, // Will be initialized when needed
  };

  // Pre-allocate history storage as typed arrays
  const initializeHistoryStorage = () => {
    // Use typed arrays for better memory performance
    const size = instance.maxHistorySize;
    // Store only timestamps and delta times
    instance.timeHistory = {
      timestamps: new Float32Array(size),
      deltas: new Float32Array(size),
    };
  };

  /**
   * Efficient median filter implementation using insertion sort
   * Avoids array copying and full sort operations
   * @param {number} newDelta - The new delta time value
   * @returns {number} - Filtered delta time
   */
  const getFilteredDelta = (newDelta) => {
    // Store the new value in the circular buffer
    instance.deltas[instance.deltasIndex] = newDelta;
    instance.deltasIndex = (instance.deltasIndex + 1) % instance.deltas.length;

    // For small arrays, insertion sort is faster than full sort
    // Copy values to avoid modifying original array
    const values = [];
    for (let i = 0; i < instance.deltas.length; i++) {
      values[i] = instance.deltas[i];
    }

    // Simple insertion sort (faster than Array.sort for very small arrays)
    for (let i = 1; i < values.length; i++) {
      const temp = values[i];
      let j = i - 1;
      while (j >= 0 && values[j] > temp) {
        values[j + 1] = values[j];
        j--;
      }
      values[j + 1] = temp;
    }

    // Return the median value
    return values[Math.floor(values.length / 2)];
  };

  /**
   * Add data to history buffer using circular buffer pattern
   * @param {number} timestamp - Current time
   * @param {number} delta - Delta time for this frame
   */
  const addToHistory = (timestamp, delta) => {
    // Only record every 3rd frame to reduce memory pressure
    if (instance.frameCount % 3 !== 0) return;

    // Use circular buffer pattern to avoid array operations
    instance.timeHistory.timestamps[instance.historyIndex] = timestamp;
    instance.timeHistory.deltas[instance.historyIndex] = delta;

    // Update index and size tracking
    instance.historyIndex =
      (instance.historyIndex + 1) % instance.maxHistorySize;
    if (instance.historySize < instance.maxHistorySize) {
      instance.historySize++;
    }
  };

  /**
   * Detect timing drift without creating temporary arrays
   * @returns {boolean} - Whether drift was detected
   */
  const hasDrift = () => {
    // Quick return if not enough samples
    if (instance.historySize < 10) return false;

    // Calculate average delta without creating a new array
    let sum = 0;
    let max = 0;
    let count = Math.min(10, instance.historySize);

    // Use the most recent entries from the circular buffer
    for (let i = 0; i < count; i++) {
      // Calculate correct index in circular buffer
      const idx =
        instance.historySize >= instance.maxHistorySize
          ? (instance.historyIndex - 1 - i + instance.maxHistorySize) %
            instance.maxHistorySize
          : instance.historySize - 1 - i;

      const delta = instance.timeHistory.deltas[idx];
      sum += delta;
      max = Math.max(max, delta);
    }

    const avg = sum / count;

    // Check if max is significantly higher than average
    return max > avg * 3 || max > 100;
  };

  /**
   * Reset timing data without allocating new objects
   * @param {number} currentTime - Current timestamp
   */
  const resetTiming = (currentTime) => {
    instance.lastFrameTime = currentTime;

    // Reset the circular buffer
    const value = instance.fixedDeltaTime;
    for (let i = 0; i < instance.deltas.length; i++) {
      instance.deltas[i] = value;
    }

    instance.smoothedDeltaTime = value;
    instance.driftDetected = false;
  };

  // Initialize event handlers only when needed
  const initializeEventHandlers = () => {
    if (instance.eventHandlers || typeof window === "undefined") {
      return;
    }

    instance.eventHandlers = {
      focus: () => {
        instance.hasFocus = true;
        instance.lastInteractionTime = performance.now();
        resetTiming(performance.now());
      },
      blur: () => {
        instance.hasFocus = false;
      },
    };

    // Add event listeners
    window.addEventListener("focus", instance.eventHandlers.focus);
    window.addEventListener("blur", instance.eventHandlers.blur);
  };

  // Clean up event handlers
  const cleanupEventHandlers = () => {
    if (!instance.eventHandlers) return;

    if (typeof window !== "undefined") {
      window.removeEventListener("focus", instance.eventHandlers.focus);
      window.removeEventListener("blur", instance.eventHandlers.blur);
    }

    instance.eventHandlers = null;
  };

  // Initialize data structures
  initializeHistoryStorage();
  initializeEventHandlers();

  // Public interface - keep methods minimal
  return {
    /**
     * Update time values based on current timestamp
     * @param {number} timestamp - Current timestamp (from requestAnimationFrame)
     * @param {string} clientId - ID of the client requesting the update
     * @returns {Object} Time information for this frame
     */
    update(timestamp = performance.now(), clientId = "unknown") {
      // Fast path for disposed state
      if (instance.isDisposed) {
        return { error: "TimeManager disposed" };
      }

      // Store frame start time for FPS capping
      const frameStartTime = performance.now();
      instance.lastFrameStartTime = frameStartTime;

      // First frame initialization
      if (instance.lastFrameTime === 0) {
        const now = timestamp;
        instance.lastFrameTime = now;
        instance.lastFpsUpdate = now;
        instance.smoothedDeltaTime = instance.fixedDeltaTime;
        instance.lastInteractionTime = now;
        instance.lastHistoryCleanup = now;
        instance.lastMemoryManagement = now;

        // Pre-fill the deltas array
        for (let i = 0; i < instance.deltas.length; i++) {
          instance.deltas[i] = instance.fixedDeltaTime;
        }

        // Return default values
        return {
          deltaTime: instance.fixedDeltaTime / 1000,
          fixedDeltaTime: instance.fixedDeltaTime / 1000,
          isIdle: false,
        };
      }

      // Calculate raw delta time - avoid creating properties on function results
      const rawDeltaTime = timestamp - instance.lastFrameTime;
      instance.lastFrameTime = timestamp;

      // Fast path for unreasonable delta times
      if (rawDeltaTime > 500) {
        resetTiming(timestamp);
        return {
          deltaTime: instance.fixedDeltaTime / 1000,
          fixedDeltaTime: instance.fixedDeltaTime / 1000,
          rawDeltaTime: instance.fixedDeltaTime / 1000,
          timeAccumulator: instance.timeAccumulator / 1000,
          isIdle: false,
          fps: instance.currentFps,
          client: clientId,
          hasFocus: instance.hasFocus,
          recovered: true,
        };
      }

      // Fast path for idle state
      if (instance.isIdle && rawDeltaTime < instance.idleThrottle) {
        return { skipFrame: true, client: clientId };
      }

      // Detect focus changes
      const focusChanged = instance.hasFocus !== instance.hadFocus;
      instance.hadFocus = instance.hasFocus;

      // Process delta time
      let finalDelta;

      // Direct timing mode - bypass smoothing
      if (instance.directTimingMode) {
        finalDelta =
          Math.min(Math.max(rawDeltaTime, 1.0), instance.maxDeltaTime) *
          instance.timeScale;
      }
      // Handle special cases that require timing reset
      else if (
        instance.wasIdleLastFrame ||
        focusChanged ||
        rawDeltaTime > instance.maxDeltaTime * 2 ||
        instance.driftDetected
      ) {
        resetTiming(timestamp);
        instance.wasIdleLastFrame = false;
        finalDelta = instance.fixedDeltaTime;
      }
      // Normal smoothing path
      else {
        instance.wasIdleLastFrame = instance.isIdle;

        // Apply constraint to raw delta
        const clampedDelta = Math.min(
          Math.max(rawDeltaTime, 1.0),
          instance.maxDeltaTime
        );

        // Apply filtering - efficient implementation
        const filteredDelta = getFilteredDelta(clampedDelta);

        // Apply exponential smoothing - avoid creating extra variables
        instance.smoothedDeltaTime =
          instance.smoothingFactor * filteredDelta +
          (1 - instance.smoothingFactor) * instance.smoothedDeltaTime;

        // Apply time scale
        finalDelta = instance.smoothedDeltaTime * instance.timeScale;
      }

      // Update final delta time and accumulator
      instance.deltaTime = finalDelta;
      instance.timeAccumulator += finalDelta;

      // Create return object - reuse same structure for GC efficiency
      const frameData = {
        deltaTime: finalDelta / 1000,
        fixedDeltaTime: instance.fixedDeltaTime / 1000,
        rawDeltaTime: rawDeltaTime / 1000,
        timeAccumulator: instance.timeAccumulator / 1000,
        isIdle: instance.isIdle,
        fps: instance.currentFps,
        client: clientId,
        hasFocus: instance.hasFocus,
        // FPS capping info
        frameCappingActive: instance.frameCapping,
      };

      // Update history storage
      addToHistory(timestamp, finalDelta);

      // Update FPS counter - do less frequently
      instance.frameCount++;
      if (timestamp - instance.lastFpsUpdate > instance.fpsUpdateInterval) {
        instance.currentFps = Math.round(
          (instance.frameCount * 1000) / (timestamp - instance.lastFpsUpdate)
        );
        instance.lastFpsUpdate = timestamp;
        instance.frameCount = 0;
      }

      // Periodic drift detection - only check occasionally
      if (timestamp - instance.lastMemoryManagement > 30000) {
        if (hasDrift()) {
          resetTiming(timestamp);
        }
        instance.lastMemoryManagement = timestamp;
      }

      // Calculate frame timing delay for FPS capping
      if (instance.frameCapping) {
        const processingTime = performance.now() - frameStartTime;
        frameData.frameCappingDelay = Math.max(
          0,
          instance.frameTimeLimit - processingTime
        );
      }

      return frameData;
    },

    /**
     * Consume time from the accumulator for fixed timestep simulation
     * @returns {boolean} - Whether there's enough accumulated time for a physics step
     */
    consumeFixedTimestep() {
      if (instance.isDisposed) return false;

      if (instance.timeAccumulator >= instance.fixedDeltaTime) {
        instance.timeAccumulator -= instance.fixedDeltaTime;
        return true;
      }
      return false;
    },

    /**
     * Register user activity
     */
    registerActivity() {
      if (instance.isDisposed) return this;

      instance.lastInteractionTime = performance.now();
      instance.isIdle = false;

      return this;
    },

    /**
     * Configure time manager settings
     * @param {Object} options - Configuration options
     */
    configure(options = {}) {
      if (instance.isDisposed) return this;

      // Only update properties that exist in options
      // Use direct property access rather than conditionals for better performance
      if ("fixedDeltaTime" in options)
        instance.fixedDeltaTime = options.fixedDeltaTime;
      if ("maxDeltaTime" in options)
        instance.maxDeltaTime = options.maxDeltaTime;
      if ("timeScale" in options) instance.timeScale = options.timeScale;
      if ("idleThrottle" in options)
        instance.idleThrottle = options.idleThrottle;
      if ("smoothingFactor" in options)
        instance.smoothingFactor = options.smoothingFactor;
      if ("directTimingMode" in options)
        instance.directTimingMode = options.directTimingMode;

      // Handle special properties that require data structure updates
      if ("deltaSampleSize" in options && options.deltaSampleSize > 0) {
        const newSize = Math.min(options.deltaSampleSize, 5); // Limit maximum size
        const newDeltas = new Float32Array(newSize);

        // Copy existing values or fill with defaults
        const defaultValue = instance.fixedDeltaTime;
        for (let i = 0; i < newSize; i++) {
          newDeltas[i] =
            i < instance.deltas.length ? instance.deltas[i] : defaultValue;
        }

        instance.deltas = newDeltas;
        instance.deltasIndex = 0;
      }

      // Update FPS capping settings
      if ("targetFPS" in options && options.targetFPS > 0) {
        instance.targetFPS = options.targetFPS;
        instance.frameTimeLimit = 1000 / options.targetFPS;
      }

      if ("frameCapping" in options)
        instance.frameCapping = !!options.frameCapping;

      return this;
    },

    /**
     * Get current time configuration - create a minimal object
     */
    getConfig() {
      if (instance.isDisposed) return { error: "TimeManager disposed" };

      return {
        fixedDeltaTime: instance.fixedDeltaTime,
        maxDeltaTime: instance.maxDeltaTime,
        timeScale: instance.timeScale,
        idleThrottle: instance.idleThrottle,
        smoothingFactor: instance.smoothingFactor,
        directTimingMode: instance.directTimingMode,
        targetFPS: instance.targetFPS,
        frameCapping: instance.frameCapping,
      };
    },

    /**
     * Set up integration with user-interaction.js
     * @param {Function} isIdleFunction - Reference to the isIdle function
     * @param {Function} onIdleStateChangeFunction - Reference to register for idle state changes
     */
    setupUserInteractionIntegration(isIdleFunction, onIdleStateChangeFunction) {
      if (instance.isDisposed) {
        console.warn("TimeManager: Attempted to use after disposal");
        return this;
      }

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
     * Get minimal performance metrics
     */
    getPerformanceMetrics() {
      if (instance.isDisposed) return { error: "TimeManager disposed" };

      return {
        fps: instance.currentFps,
        isIdle: instance.isIdle,
        hasFocus: instance.hasFocus,
        driftDetected: instance.driftDetected,
        targetFPS: instance.targetFPS,
        frameCapping: instance.frameCapping,
      };
    },

    /**
     * Reset the time accumulator
     */
    resetAccumulator() {
      if (instance.isDisposed) return this;

      instance.timeAccumulator = 0;
      return this;
    },

    /**
     * Set direct timing mode (bypass smoothing)
     */
    setDirectTimingMode(enable) {
      if (instance.isDisposed) return this;

      instance.directTimingMode = !!enable;
      if (enable) resetTiming(performance.now());

      return this;
    },

    /**
     * Force a frame to be rendered
     */
    forceFrame() {
      if (instance.isDisposed) return this;

      instance.wasIdleLastFrame = true;
      instance.isIdle = false;

      return this;
    },

    /**
     * Check if window has focus
     */
    hasFocus() {
      return instance.isDisposed ? false : instance.hasFocus;
    },

    /**
     * Reset timing to eliminate lag
     */
    resetTiming() {
      if (instance.isDisposed) return this;

      resetTiming(performance.now());
      instance.timeAccumulator = 0;
      instance.driftDetected = false;

      return this;
    },

    /**
     * Set target FPS for frame rate capping
     */
    setTargetFPS(fps) {
      if (instance.isDisposed) return this;

      if (fps <= 0) {
        instance.frameCapping = false;
        return this;
      }

      instance.targetFPS = fps;
      instance.frameTimeLimit = 1000 / fps;
      instance.frameCapping = true;

      return this;
    },

    /**
     * Apply frame rate capping
     */
    applyFrameCapping() {
      if (instance.isDisposed || !instance.frameCapping) {
        return Promise.resolve();
      }

      const frameTime = performance.now() - instance.lastFrameStartTime;
      const delayNeeded = Math.max(0, instance.frameTimeLimit - frameTime);

      if (delayNeeded <= 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        setTimeout(resolve, delayNeeded);
      });
    },

    /**
     * Dispose all resources
     */
    dispose() {
      if (instance.isDisposed) return this;

      // Clean up event handlers
      cleanupEventHandlers();

      // Clear references
      instance.timeHistory = null;
      instance.deltas = null;
      instance.isDisposed = true;

      return this;
    },

    /**
     * Check if the TimeManager has been disposed
     */
    isDisposed() {
      return instance.isDisposed;
    },

    /**
     * Check if drift has been detected
     */
    isDriftDetected() {
      return instance.driftDetected;
    },
  };
})();

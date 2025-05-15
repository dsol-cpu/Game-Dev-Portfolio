import { Clock } from "../extern/three/three.core.min.js";
import { isIdle } from "../user-interaction.js";

// Core timing configuration
const TARGET_FRAME_RATE = 60;
const FRAME_DELAY = 1000 / TARGET_FRAME_RATE;
const FIXED_DELTA_TIME = 1 / TARGET_FRAME_RATE;
const MAX_DELTA_TIME = 0.1; // Cap for extreme frame drops
const MIN_DELTA_TIME = 0.001; // Minimum to prevent zero/negative deltas
const IDLE_FRAME_RATE = 5; // Reduced from 10 to save more resources when idle

// Adaptive performance settings
const ADAPTIVE_FRAME_PACING = true;
const FRAME_BUDGET_MS = 14; // Target ms per frame (16.67ms @ 60fps)
const FRAME_TIME_HISTORY_SIZE = 10;
const PHYSICS_ITERATIONS_MIN = 1;
const PHYSICS_ITERATIONS_MAX = 3;

// Smoothing settings
const DELTA_SMOOTHING = true;
const SMOOTHING_STRENGTH = 0.8; // 0-1, higher = more smoothing
const USE_CONSISTENT_DELTA = true;

// Idle detection
const IDLE_THRESHOLD_MS = 60000; // 1 minute
const USE_REQUEST_IDLE_CALLBACK =
  typeof window.requestIdleCallback === "function";

// Debug settings
const DEBUG_MODE = false;
const MEASURE_PERFORMANCE = DEBUG_MODE && typeof performance !== "undefined";

// State variables
const clock = new Clock();
let accumulator = 0;
let deltaTime = FIXED_DELTA_TIME;
let smoothedDelta = FIXED_DELTA_TIME;
let lastDeltaTimes = Array(5).fill(FIXED_DELTA_TIME);
let frameTimeHistory = Array(FRAME_TIME_HISTORY_SIZE).fill(FRAME_DELAY);
let rafHandle = null;
let frameCallback = null;
let updatesPaused = false;
let fpsHistory = [];
let lastFpsUpdate = 0;
let currentFps = 0;
let lastTimestamp = 0;
let adaptivePhysicsIterations = PHYSICS_ITERATIONS_MAX;
let frameCount = 0;
let consecutiveSlowFrames = 0;
let lastInteractionTime = Date.now();

/**
 * Get the current delta time for rendering (smoothed)
 */
export function getDeltaTime() {
  return DELTA_SMOOTHING ? smoothedDelta : deltaTime;
}

/**
 * Get the fixed timestep used for physics
 */
export function getFixedDeltaTime() {
  return FIXED_DELTA_TIME;
}

/**
 * Run physics updates with fixed timestep
 * @param {Function} stepFn Function to call for each fixed update step
 */
export function runFixedUpdates(stepFn) {
  if (updatesPaused) return;

  let startTime;
  if (MEASURE_PERFORMANCE) {
    startTime = performance.now();
  }

  // Use either adaptive or fixed max steps based on configuration
  const maxSteps = adaptivePhysicsIterations;
  let steps = 0;

  // Always run at least one physics step if there's accumulated time
  if (accumulator >= FIXED_DELTA_TIME) {
    while (accumulator >= FIXED_DELTA_TIME && steps < maxSteps) {
      stepFn(FIXED_DELTA_TIME);
      accumulator -= FIXED_DELTA_TIME;
      steps++;
    }
  }

  // If we've accumulated too much time, handle it intelligently
  if (accumulator > FIXED_DELTA_TIME && steps >= maxSteps) {
    // Keep up to one frame of time to maintain continuity, but avoid spiral of death
    accumulator = Math.min(accumulator, FIXED_DELTA_TIME);

    if (DEBUG_MODE) {
      console.warn(
        `Time manager: Max physics steps (${maxSteps}) exceeded, reducing accumulated time`
      );
    }
  }

  if (MEASURE_PERFORMANCE) {
    const duration = performance.now() - startTime;
    if (duration > 8) {
      console.warn(
        `Physics update took ${duration.toFixed(2)}ms for ${steps} steps`
      );
    }
  }
}

/**
 * Analyze recent performance and adjust settings if needed
 */
function analyzePerformance() {
  // Only run analysis periodically
  if (frameCount % 60 !== 0) return;

  // Calculate average frame time
  const avgFrameTime =
    frameTimeHistory.reduce((sum, time) => sum + time, 0) /
    frameTimeHistory.length;

  if (avgFrameTime > FRAME_BUDGET_MS * 1.2) {
    // System is struggling - reduce physics iterations
    consecutiveSlowFrames++;

    if (consecutiveSlowFrames > 3) {
      adaptivePhysicsIterations = Math.max(
        PHYSICS_ITERATIONS_MIN,
        adaptivePhysicsIterations - 1
      );

      if (DEBUG_MODE) {
        console.log(
          `Reducing physics iterations to ${adaptivePhysicsIterations} due to slow frames`
        );
      }

      // Reset counter after adjustment
      consecutiveSlowFrames = 0;
    }
  } else if (avgFrameTime < FRAME_BUDGET_MS * 0.7) {
    // System is performing well - can potentially increase iterations
    consecutiveSlowFrames = 0;

    adaptivePhysicsIterations = Math.min(
      PHYSICS_ITERATIONS_MAX,
      adaptivePhysicsIterations + 1
    );
  } else {
    // Performance is good enough, reset counter
    consecutiveSlowFrames = 0;
  }
}

/**
 * Update FPS counter and performance tracking
 */
function updateFPS(timestamp, frameDuration) {
  // Track frame time for adaptive adjustments
  frameTimeHistory.push(frameDuration);
  frameTimeHistory.shift();

  // Standard FPS calculation
  if (timestamp - lastFpsUpdate > 500) {
    const fps =
      fpsHistory.length > 0
        ? fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length
        : 0;

    currentFps = Math.round(fps);
    fpsHistory = [];
    lastFpsUpdate = timestamp;

    if (DEBUG_MODE && currentFps < TARGET_FRAME_RATE * 0.8) {
      console.warn(`Low FPS: ${currentFps}`);
    }

    // Analyze performance after updating FPS
    if (ADAPTIVE_FRAME_PACING) {
      analyzePerformance();
    }
  }

  if (deltaTime > 0) {
    fpsHistory.push(1 / deltaTime);
  }
}

/**
 * Check if the system is idle (no user interaction)
 */
function checkIdle() {
  // Use imported isIdle function if available, otherwise use time-based detection
  if (typeof isIdle === "function") {
    return isIdle();
  }
  return Date.now() - lastInteractionTime > IDLE_THRESHOLD_MS;
}

/**
 * Reset the idle timer (call on user interaction)
 */
export function resetIdleTimer() {
  lastInteractionTime = Date.now();
  updatesPaused = false;
}

/**
 * Main frame loop with improved timing stability
 */
function frameLoop(timestamp) {
  // Track frame count
  frameCount++;

  // Measure how long processing this frame takes
  const frameStartTime = performance.now();

  // On first frame, just set timestamp and request next frame
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    clock.getDelta(); // Reset initial delta
    rafHandle = requestAnimationFrame(frameLoop);
    return;
  }

  // Time since last frame in seconds, with safety clamping
  const rawDelta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // Handle tab becoming visible after being hidden
  // If delta is exceptionally large, it likely means the tab was inactive
  if (rawDelta > MAX_DELTA_TIME * 2) {
    // Reset timing info rather than trying to recover
    clock.getDelta(); // Discard large delta
    deltaTime = FIXED_DELTA_TIME;
    smoothedDelta = FIXED_DELTA_TIME;
    accumulator = FIXED_DELTA_TIME; // Ensure at least one physics step
    rafHandle = requestAnimationFrame(frameLoop);
    return;
  }

  // Get delta time and enforce bounds for stability
  deltaTime = Math.max(
    MIN_DELTA_TIME,
    Math.min(clock.getDelta(), MAX_DELTA_TIME)
  );

  // Delta smoothing for consistent motion
  if (DELTA_SMOOTHING) {
    // Store recent delta times
    lastDeltaTimes.push(deltaTime);
    lastDeltaTimes.shift();

    if (USE_CONSISTENT_DELTA) {
      // Use constant delta for maximum stability (but less accuracy)
      smoothedDelta = FIXED_DELTA_TIME;
    } else {
      // Enhanced smoothing with outlier rejection
      const sortedDeltas = [...lastDeltaTimes].sort((a, b) => a - b);
      const filteredDeltas = sortedDeltas.slice(1, -1); // Remove highest and lowest

      const avgDelta =
        filteredDeltas.length > 0
          ? filteredDeltas.reduce((sum, dt) => sum + dt, 0) /
            filteredDeltas.length
          : lastDeltaTimes[lastDeltaTimes.length - 1];

      // Weighted average with configurable strength
      smoothedDelta =
        deltaTime * (1 - SMOOTHING_STRENGTH) + avgDelta * SMOOTHING_STRENGTH;
    }
  } else {
    smoothedDelta = deltaTime;
  }

  // Update accumulator for fixed timestep physics
  accumulator += deltaTime;

  // Check idle state
  const idle = checkIdle();
  updatesPaused = idle;

  // Run frame callback if not idle
  if (frameCallback && !idle) {
    try {
      // Use smoothed delta for rendering
      frameCallback(getDeltaTime(), timestamp);
    } catch (err) {
      console.error("Error in frame callback:", err);
    }
  }

  // Calculate frame duration
  const frameDuration = performance.now() - frameStartTime;

  // Update performance metrics
  if (DEBUG_MODE || ADAPTIVE_FRAME_PACING) {
    updateFPS(timestamp, frameDuration);
  }

  // Schedule next frame with improved timing
  const targetDelay = idle ? 1000 / IDLE_FRAME_RATE : FRAME_DELAY;

  if (USE_REQUEST_IDLE_CALLBACK && idle) {
    window.requestIdleCallback(
      () => {
        rafHandle = requestAnimationFrame(frameLoop);
      },
      { timeout: targetDelay }
    );
  } else {
    // Improved frame pacing with deadline awareness
    const remainingFrameTime = Math.max(0, targetDelay - frameDuration);

    if (remainingFrameTime > 1) {
      // There's time to wait before next frame
      setTimeout(() => {
        rafHandle = requestAnimationFrame(frameLoop);
      }, remainingFrameTime);
    } else {
      // Already running behind, request next frame immediately
      rafHandle = requestAnimationFrame(frameLoop);
    }
  }
}

/**
 * Handle visibility state changes (tab switching)
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Tab is hidden, pause updates and stop requesting animation frames
    updatesPaused = true;
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  } else {
    // Tab is visible again, reset timing and restart loop
    resetIdleTimer();
    clock.getDelta(); // Discard accumulated time
    lastTimestamp = 0;

    if (rafHandle === null && frameCallback) {
      rafHandle = requestAnimationFrame(frameLoop);
    }
  }
}

/**
 * Handle window focus event
 */
function handleFocus() {
  resetIdleTimer();
  clock.getDelta(); // Discard accumulated time
}

/**
 * Handle window blur event
 */
function handleBlur() {
  // Just note that we might want to pause heavy processing
  // but don't actually pause - that happens in visibility change
}

/**
 * Start the time-managed animation loop
 * @param {Function} callback Function to call each frame
 */
export function startFrameCappedLoop(callback) {
  if (rafHandle !== null) {
    console.warn("Frame loop already running");
    return;
  }

  // Set callback and initialize state
  frameCallback = callback;
  accumulator = 0;
  lastDeltaTimes = Array(5).fill(FIXED_DELTA_TIME);
  frameTimeHistory = Array(FRAME_TIME_HISTORY_SIZE).fill(FRAME_DELAY);
  smoothedDelta = FIXED_DELTA_TIME;
  fpsHistory = [];
  lastFpsUpdate = 0;
  currentFps = 0;
  updatesPaused = false;
  lastTimestamp = 0;
  adaptivePhysicsIterations = PHYSICS_ITERATIONS_MAX;
  frameCount = 0;
  consecutiveSlowFrames = 0;
  lastInteractionTime = Date.now();

  // Reset the clock for accurate initial timing
  clock.start();
  clock.getDelta(); // Reset initial delta

  // Start the loop
  rafHandle = requestAnimationFrame(frameLoop);

  // Set up listeners for visibility changes
  if (document) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("mousedown", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("touchstart", resetIdleTimer);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
  }
}

/**
 * Stop the animation loop and clean up
 */
export function stopFrameCappedLoop() {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    frameCallback = null;
    updatesPaused = true;
  }

  // Remove event listeners
  if (document) {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("mousedown", resetIdleTimer);
    document.removeEventListener("keydown", resetIdleTimer);
    document.removeEventListener("touchstart", resetIdleTimer);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("blur", handleBlur);
  }
}

/**
 * Pause/unpause updates
 */
export function setPaused(paused) {
  updatesPaused = paused;
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics() {
  return {
    fps: currentFps,
    frameTimeAvg:
      frameTimeHistory.reduce((sum, t) => sum + t, 0) / frameTimeHistory.length,
    physicsIterations: adaptivePhysicsIterations,
    deltaTime: deltaTime,
    smoothedDelta: smoothedDelta,
    isIdle: checkIdle(),
  };
}

/**
 * Force specific physics iterations
 */
export function forcePhysicsIterations(iterations) {
  if (
    iterations >= PHYSICS_ITERATIONS_MIN &&
    iterations <= PHYSICS_ITERATIONS_MAX
  ) {
    adaptivePhysicsIterations = iterations;
  }
}

/**
 * Set delta time smoothing strength
 */
export function setDeltaSmoothing(strength) {
  if (strength >= 0 && strength <= 1) {
    SMOOTHING_STRENGTH = strength;
  }
}

/**
 * Get the smoothed delta time (for advanced use cases)
 */
export function getSmoothedDeltaTime() {
  return smoothedDelta;
}

/**
 * Get current FPS (for debugging)
 */
export function getCurrentFPS() {
  return currentFps;
}

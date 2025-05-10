import { Clock } from "../extern/three/three.core.min.js";
import { isIdle } from "../user-interaction.js";

// Performance configuration
const TARGET_FRAME_RATE = 60;
const FRAME_DELAY = 1000 / TARGET_FRAME_RATE;
const FIXED_DELTA_TIME = 1 / TARGET_FRAME_RATE;
const MAX_DELTA_TIME = 0.05; // 50ms max per frame
const IDLE_FRAME_RATE = 10;
const USE_REQUEST_IDLE_CALLBACK =
  typeof window.requestIdleCallback === "function";

// Timing utilities
const clock = new Clock();

// State variables
let accumulator = 0;
let deltaTime = FIXED_DELTA_TIME;
let rafHandle = null;
let frameCallback = null;
let updatesPaused = false;
let fpsHistory = [];
let lastFpsUpdate = 0;
let currentFps = 0;

// Debug flags
const DEBUG_MODE = false;
const MEASURE_PERFORMANCE = DEBUG_MODE && typeof performance !== "undefined";

/**
 * Gets the current delta time in seconds
 */
export function getDeltaTime() {
  return deltaTime;
}

/**
 * Gets the fixed time step used for physics
 */
export function getFixedDeltaTime() {
  return FIXED_DELTA_TIME;
}

/**
 * Run physics updates with fixed timestep
 * @param {Function} stepFn Function to call for each fixed update
 */
export function runFixedUpdates(stepFn) {
  if (updatesPaused) return;

  let startTime;
  if (MEASURE_PERFORMANCE) {
    startTime = performance.now();
  }

  const maxSteps = 3;
  let steps = 0;

  while (accumulator >= FIXED_DELTA_TIME && steps < maxSteps) {
    stepFn(FIXED_DELTA_TIME);
    accumulator -= FIXED_DELTA_TIME;
    steps++;
  }

  if (steps >= maxSteps && accumulator > FIXED_DELTA_TIME) {
    accumulator = 0;
    if (DEBUG_MODE) {
      console.warn(
        "Time manager: Max physics steps exceeded, possible lag spike"
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
 * Calculate and store current FPS
 * @param {number} now Current timestamp
 */
function updateFPS(now) {
  if (now - lastFpsUpdate > 500) {
    const fps =
      fpsHistory.length > 0
        ? fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length
        : 0;

    currentFps = Math.round(fps);
    fpsHistory = [];
    lastFpsUpdate = now;

    if (DEBUG_MODE && currentFps < TARGET_FRAME_RATE * 0.8) {
      console.warn(`Low FPS: ${currentFps}`);
    }
  }

  if (deltaTime > 0) {
    fpsHistory.push(1 / deltaTime);
  }
}

/**
 * Main frame loop with consistent timing
 * @param {number} timestamp RAF timestamp
 */
function frameLoop(timestamp) {
  // Get delta time using Three.js Clock
  deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);

  // Update accumulator for fixed timestep
  accumulator += deltaTime;

  // Update FPS counter
  if (DEBUG_MODE) {
    updateFPS(performance.now());
  }

  // Run the frame callback if not idle
  const idle = isIdle();
  updatesPaused = idle;

  if (frameCallback && !idle) {
    try {
      frameCallback(timestamp);
    } catch (err) {
      console.error("Error in frame callback:", err);
    }
  }

  // Schedule next frame
  const targetDelay = idle ? 1000 / IDLE_FRAME_RATE : FRAME_DELAY;

  if (USE_REQUEST_IDLE_CALLBACK && idle) {
    window.requestIdleCallback(
      () => {
        rafHandle = requestAnimationFrame(frameLoop);
      },
      { timeout: 1000 / IDLE_FRAME_RATE }
    );
  } else {
    const elapsed = performance.now() - timestamp;
    const delay = Math.max(0, targetDelay - elapsed);

    setTimeout(() => {
      rafHandle = requestAnimationFrame(frameLoop);
    }, delay);
  }
}

/**
 * Start the frame-capped animation loop
 * @param {Function} callback Function to call each frame
 */
export function startFrameCappedLoop(callback) {
  if (rafHandle !== null) {
    console.warn("Frame capped loop already running");
    return;
  }

  frameCallback = callback;
  accumulator = 0;
  fpsHistory = [];
  lastFpsUpdate = 0;
  currentFps = 0;
  updatesPaused = false;

  clock.start();
  clock.getDelta(); // Reset initial delta

  rafHandle = requestAnimationFrame(frameLoop);
}

/**
 * Stop the animation loop
 */
export function stopFrameCappedLoop() {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    frameCallback = null;
    updatesPaused = true;
  }
}

/**
 * Get current FPS (for debugging)
 */
export function getCurrentFPS() {
  return currentFps;
}

/**
 * Pause/unpause fixed updates
 * @param {boolean} paused Whether updates should be paused
 */
export function setPaused(paused) {
  updatesPaused = paused;
}

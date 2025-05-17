import { Clock } from "../extern/three/three.core.min.js";
import { isIdle } from "../user-interaction.js";

// Core timing configuration
const TARGET_FRAME_RATE = 60;
const FRAME_DELAY = 1000 / TARGET_FRAME_RATE;
const FIXED_DELTA_TIME = 1 / TARGET_FRAME_RATE;
const MAX_DELTA_TIME = 0.1;
const MIN_DELTA_TIME = 0.001;
const IDLE_FRAME_RATE = 5;

// Performance settings
const FRAME_BUDGET_MS = 14;
const FRAME_TIME_HISTORY_SIZE = 10;
const PHYSICS_ITERATIONS_MIN = 1;
const PHYSICS_ITERATIONS_MAX = 3;

// Smoothing settings
const DELTA_SMOOTHING = true;
const USE_CONSISTENT_DELTA = true;
let smoothingStrength = 0.8;

// Idle detection
const IDLE_THRESHOLD_MS = 60000;
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
 * Get the current delta time for rendering
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
 */
export function runFixedUpdates(stepFn) {
  if (updatesPaused) return;

  let startTime;
  if (MEASURE_PERFORMANCE) {
    startTime = performance.now();
  }

  const maxSteps = adaptivePhysicsIterations;
  let steps = 0;

  // Run physics steps
  while (accumulator >= FIXED_DELTA_TIME && steps < maxSteps) {
    stepFn(FIXED_DELTA_TIME);
    accumulator -= FIXED_DELTA_TIME;
    steps++;
  }

  // Handle excessive accumulation
  if (accumulator > FIXED_DELTA_TIME && steps >= maxSteps) {
    accumulator = Math.min(accumulator, FIXED_DELTA_TIME);

    if (DEBUG_MODE) {
      console.warn(
        `Time manager: Max physics steps (${maxSteps}) exceeded, reducing accumulated time`
      );
    }
  }

  if (MEASURE_PERFORMANCE && steps > 0) {
    const duration = performance.now() - startTime;
    if (duration > 8) {
      console.warn(
        `Physics update took ${duration.toFixed(2)}ms for ${steps} steps`
      );
    }
  }
}

/**
 * Analyze performance and adjust settings
 */
function analyzePerformance() {
  if (frameCount % 60 !== 0) return;

  const avgFrameTime =
    frameTimeHistory.reduce((sum, time) => sum + time, 0) /
    frameTimeHistory.length;

  if (avgFrameTime > FRAME_BUDGET_MS * 1.2) {
    consecutiveSlowFrames++;

    if (consecutiveSlowFrames > 3) {
      adaptivePhysicsIterations = Math.max(
        PHYSICS_ITERATIONS_MIN,
        adaptivePhysicsIterations - 1
      );
      consecutiveSlowFrames = 0;

      if (DEBUG_MODE) {
        console.log(
          `Reducing physics iterations to ${adaptivePhysicsIterations} due to slow frames`
        );
      }
    }
  } else if (avgFrameTime < FRAME_BUDGET_MS * 0.7) {
    consecutiveSlowFrames = 0;
    adaptivePhysicsIterations = Math.min(
      PHYSICS_ITERATIONS_MAX,
      adaptivePhysicsIterations + 1
    );
  } else {
    consecutiveSlowFrames = 0;
  }
}

/**
 * Update FPS counter and performance tracking
 */
function updateFPS(timestamp, frameDuration) {
  frameTimeHistory.push(frameDuration);
  frameTimeHistory.shift();

  if (timestamp - lastFpsUpdate > 500) {
    currentFps =
      fpsHistory.length > 0
        ? Math.round(
            fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length
          )
        : 0;

    fpsHistory = [];
    lastFpsUpdate = timestamp;

    if (DEBUG_MODE && currentFps < TARGET_FRAME_RATE * 0.8) {
      console.warn(`Low FPS: ${currentFps}`);
    }

    analyzePerformance();
  }

  if (deltaTime > 0) {
    fpsHistory.push(1 / deltaTime);
  }
}

/**
 * Check if the system is idle
 */
function checkIdle() {
  return typeof isIdle === "function"
    ? isIdle()
    : Date.now() - lastInteractionTime > IDLE_THRESHOLD_MS;
}

/**
 * Reset the idle timer
 */
export function resetIdleTimer() {
  lastInteractionTime = Date.now();
  updatesPaused = false;
}

/**
 * Main frame loop
 */
function frameLoop(timestamp) {
  frameCount++;
  const frameStartTime = performance.now();

  // First frame initialization
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    clock.getDelta();
    rafHandle = requestAnimationFrame(frameLoop);
    return;
  }

  // Calculate delta time
  const rawDelta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // Handle tab becoming active after being inactive
  if (rawDelta > MAX_DELTA_TIME) {
    clock.getDelta();
    deltaTime = FIXED_DELTA_TIME;
    smoothedDelta = FIXED_DELTA_TIME;
    accumulator = FIXED_DELTA_TIME;
    rafHandle = requestAnimationFrame(frameLoop);
    return;
  }

  // Get bounded delta time
  deltaTime = Math.max(
    MIN_DELTA_TIME,
    Math.min(clock.getDelta(), MAX_DELTA_TIME)
  );

  // Apply delta smoothing
  if (DELTA_SMOOTHING) {
    lastDeltaTimes.push(deltaTime);
    lastDeltaTimes.shift();

    if (USE_CONSISTENT_DELTA) {
      smoothedDelta = FIXED_DELTA_TIME;
    } else {
      const sortedDeltas = [...lastDeltaTimes].sort((a, b) => a - b);
      const filteredDeltas = sortedDeltas.slice(1, -1);

      const avgDelta =
        filteredDeltas.length > 0
          ? filteredDeltas.reduce((sum, dt) => sum + dt, 0) /
            filteredDeltas.length
          : lastDeltaTimes[lastDeltaTimes.length - 1];

      smoothedDelta =
        deltaTime * (1 - smoothingStrength) + avgDelta * smoothingStrength;
    }
  } else {
    smoothedDelta = deltaTime;
  }

  // Update accumulator
  accumulator += deltaTime;

  // Check idle state
  const idle = checkIdle();
  updatesPaused = idle;

  // Run frame callback
  if (frameCallback && !idle) {
    try {
      frameCallback(getDeltaTime(), timestamp);
    } catch (err) {
      console.error("Error in frame callback:", err);
    }
  }

  // Performance metrics
  const frameDuration = performance.now() - frameStartTime;
  if (DEBUG_MODE) {
    updateFPS(timestamp, frameDuration);
  }

  // Schedule next frame
  const targetDelay = idle ? 1000 / IDLE_FRAME_RATE : FRAME_DELAY;

  if (USE_REQUEST_IDLE_CALLBACK && idle) {
    window.requestIdleCallback(
      () => {
        rafHandle = requestAnimationFrame(frameLoop);
      },
      { timeout: targetDelay }
    );
  } else {
    const remainingFrameTime = Math.max(0, targetDelay - frameDuration);

    if (remainingFrameTime > 1) {
      setTimeout(() => {
        rafHandle = requestAnimationFrame(frameLoop);
      }, remainingFrameTime);
    } else {
      rafHandle = requestAnimationFrame(frameLoop);
    }
  }
}

/**
 * Handle visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    updatesPaused = true;
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  } else {
    resetIdleTimer();
    clock.getDelta();
    lastTimestamp = 0;

    if (rafHandle === null && frameCallback) {
      rafHandle = requestAnimationFrame(frameLoop);
    }
  }
}

/**
 * Start the animation loop
 */
export function startFrameCappedLoop(callback) {
  if (rafHandle !== null) {
    console.warn("Frame loop already running");
    return;
  }

  // Initialize state
  frameCallback = callback;
  accumulator = 0;
  lastDeltaTimes.fill(FIXED_DELTA_TIME);
  frameTimeHistory.fill(FRAME_DELAY);
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

  // Start the loop
  clock.start();
  clock.getDelta();
  rafHandle = requestAnimationFrame(frameLoop);

  // Set up event listeners
  if (document) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("mousedown", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("touchstart", resetIdleTimer);
    window.addEventListener("focus", resetIdleTimer);
    window.addEventListener("blur", () => {});
  }
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

  // Remove event listeners
  if (document) {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("mousedown", resetIdleTimer);
    document.removeEventListener("keydown", resetIdleTimer);
    document.removeEventListener("touchstart", resetIdleTimer);
    window.removeEventListener("focus", resetIdleTimer);
    window.removeEventListener("blur", () => {});
  }
}

/**
 * Pause/unpause updates
 */
export function setPaused(paused) {
  updatesPaused = paused;
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics() {
  return {
    fps: currentFps,
    frameTimeAvg:
      frameTimeHistory.reduce((sum, t) => sum + t, 0) / frameTimeHistory.length,
    physicsIterations: adaptivePhysicsIterations,
    deltaTime,
    smoothedDelta,
    isIdle: checkIdle(),
  };
}

/**
 * Set physics iterations
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
 * Set delta smoothing strength
 */
export function setDeltaSmoothing(strength) {
  if (strength >= 0 && strength <= 1) {
    smoothingStrength = strength;
  }
}

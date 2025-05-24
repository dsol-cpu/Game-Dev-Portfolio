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
const DEFAULT_SMOOTHING_STRENGTH = 0.8;

// Idle detection
const IDLE_THRESHOLD_MS = 60000;
const USE_REQUEST_IDLE_CALLBACK =
  typeof window.requestIdleCallback === "function";

// Debug settings
const DEBUG_MODE = false;
const MEASURE_PERFORMANCE = DEBUG_MODE && typeof performance !== "undefined";

// Global state - direct mutation for performance
const state = {
  clock: new Clock(),
  accumulator: 0,
  deltaTime: FIXED_DELTA_TIME,
  smoothedDelta: FIXED_DELTA_TIME,
  lastDeltaTimes: new Float32Array(5).fill(FIXED_DELTA_TIME),
  frameTimeHistory: new Float32Array(FRAME_TIME_HISTORY_SIZE).fill(FRAME_DELAY),
  rafHandle: null,
  frameCallback: null,
  updatesPaused: false,
  fpsHistory: [],
  lastFpsUpdate: 0,
  currentFps: 0,
  lastTimestamp: 0,
  adaptivePhysicsIterations: PHYSICS_ITERATIONS_MAX,
  frameCount: 0,
  consecutiveSlowFrames: 0,
  lastInteractionTime: Date.now(),
  smoothingStrength: DEFAULT_SMOOTHING_STRENGTH,
  isRunning: false,
  eventHandlers: null,
  deltaIndex: 0,
  frameTimeIndex: 0,
};

// Inline helper functions for better performance
const clampDelta = (delta) =>
  delta < MIN_DELTA_TIME
    ? MIN_DELTA_TIME
    : delta > MAX_DELTA_TIME
    ? MAX_DELTA_TIME
    : delta;

const calculateSmoothedDelta = (deltaTime) => {
  if (!DELTA_SMOOTHING) return deltaTime;
  if (USE_CONSISTENT_DELTA) return FIXED_DELTA_TIME;

  // Simple moving average without sorting/filtering for performance
  let sum = 0;
  for (let i = 0; i < 5; i++) {
    sum += state.lastDeltaTimes[i];
  }
  const avgDelta = sum * 0.2; // divide by 5

  return (
    deltaTime * (1 - state.smoothingStrength) +
    avgDelta * state.smoothingStrength
  );
};

const updateDeltaHistory = (newDelta) => {
  state.lastDeltaTimes[state.deltaIndex] = newDelta;
  state.deltaIndex = (state.deltaIndex + 1) % 5;
};

const updateFrameTimeHistory = (newFrameTime) => {
  state.frameTimeHistory[state.frameTimeIndex] = newFrameTime;
  state.frameTimeIndex = (state.frameTimeIndex + 1) % FRAME_TIME_HISTORY_SIZE;
};

const calculateAverageFrameTime = () => {
  let sum = 0;
  for (let i = 0; i < FRAME_TIME_HISTORY_SIZE; i++) {
    sum += state.frameTimeHistory[i];
  }
  return sum / FRAME_TIME_HISTORY_SIZE;
};

const adjustPhysicsIterations = (avgFrameTime) => {
  if (avgFrameTime > FRAME_BUDGET_MS * 1.2) {
    state.consecutiveSlowFrames++;

    if (state.consecutiveSlowFrames > 3) {
      state.adaptivePhysicsIterations = Math.max(
        PHYSICS_ITERATIONS_MIN,
        state.adaptivePhysicsIterations - 1
      );
      state.consecutiveSlowFrames = 0;

      if (DEBUG_MODE) {
        console.log(
          `Reducing physics iterations to ${state.adaptivePhysicsIterations} due to slow frames`
        );
      }
    }
    return;
  }

  if (avgFrameTime < FRAME_BUDGET_MS * 0.7) {
    state.adaptivePhysicsIterations = Math.min(
      PHYSICS_ITERATIONS_MAX,
      state.adaptivePhysicsIterations + 1
    );
  }

  state.consecutiveSlowFrames = 0;
};

const calculateCurrentFPS = () => {
  if (state.fpsHistory.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < state.fpsHistory.length; i++) {
    sum += state.fpsHistory[i];
  }
  return Math.round(sum / state.fpsHistory.length);
};

const checkIdleState = () => {
  return typeof isIdle === "function"
    ? isIdle()
    : Date.now() - state.lastInteractionTime > IDLE_THRESHOLD_MS;
};

// Simplified physics update
const runPhysicsSteps = (stepFn) => {
  let steps = 0;
  const maxSteps = state.adaptivePhysicsIterations;

  if (MEASURE_PERFORMANCE) {
    const startTime = performance.now();

    while (state.accumulator >= FIXED_DELTA_TIME && steps < maxSteps) {
      stepFn(FIXED_DELTA_TIME);
      state.accumulator -= FIXED_DELTA_TIME;
      steps++;
    }

    if (state.accumulator > FIXED_DELTA_TIME && steps >= maxSteps) {
      state.accumulator = Math.min(state.accumulator, FIXED_DELTA_TIME);
      if (DEBUG_MODE) {
        console.warn(
          `Time manager: Max physics steps (${maxSteps}) exceeded, reducing accumulated time`
        );
      }
    }

    const duration = performance.now() - startTime;
    if (steps > 0 && duration > 8) {
      console.warn(
        `Physics update took ${duration.toFixed(2)}ms for ${steps} steps`
      );
    }
    return;
  }

  while (state.accumulator >= FIXED_DELTA_TIME && steps < maxSteps) {
    stepFn(FIXED_DELTA_TIME);
    state.accumulator -= FIXED_DELTA_TIME;
    steps++;
  }

  if (state.accumulator > FIXED_DELTA_TIME && steps >= maxSteps) {
    state.accumulator = Math.min(state.accumulator, FIXED_DELTA_TIME);
    if (DEBUG_MODE) {
      console.warn(
        `Time manager: Max physics steps (${maxSteps}) exceeded, reducing accumulated time`
      );
    }
  }
};

// Simplified frame update
const updateStateFromFrame = (timestamp) => {
  const frameStartTime = performance.now();

  // First frame initialization
  if (state.lastTimestamp === 0) {
    state.clock.getDelta();
    state.lastTimestamp = timestamp;
    state.frameCount++;
    return;
  }

  const rawDelta = (timestamp - state.lastTimestamp) / 1000;

  // Handle tab becoming active after being inactive
  if (rawDelta > MAX_DELTA_TIME) {
    state.clock.getDelta();
    state.lastTimestamp = timestamp;
    state.deltaTime = FIXED_DELTA_TIME;
    state.smoothedDelta = FIXED_DELTA_TIME;
    state.accumulator = FIXED_DELTA_TIME;
    state.frameCount++;
    return;
  }

  // Get bounded delta time
  state.deltaTime = clampDelta(state.clock.getDelta());

  // Update delta history and calculate smoothed delta
  updateDeltaHistory(state.deltaTime);
  state.smoothedDelta = calculateSmoothedDelta(state.deltaTime);

  // Update accumulator
  state.accumulator += state.deltaTime;

  // Check idle state
  state.updatesPaused = checkIdleState();

  // Performance metrics
  const frameDuration = performance.now() - frameStartTime;
  updateFrameTimeHistory(frameDuration);

  state.lastTimestamp = timestamp;
  state.frameCount++;

  // Update FPS if needed
  if (DEBUG_MODE && timestamp - state.lastFpsUpdate > 500) {
    if (state.deltaTime > 0) {
      state.fpsHistory.push(1 / state.deltaTime);
    }

    state.currentFps = calculateCurrentFPS();

    if (state.currentFps < TARGET_FRAME_RATE * 0.8) {
      console.warn(`Low FPS: ${state.currentFps}`);
    }

    // Analyze performance every 60 frames
    if (state.frameCount % 60 === 0) {
      const avgFrameTime = calculateAverageFrameTime();
      adjustPhysicsIterations(avgFrameTime);
    }

    state.fpsHistory.length = 0; // Clear array efficiently
    state.lastFpsUpdate = timestamp;
  } else if (state.deltaTime > 0) {
    state.fpsHistory.push(1 / state.deltaTime);
  }
};

// Simplified frame loop
const frameLoop = (timestamp) => {
  updateStateFromFrame(timestamp);

  // Run frame callback
  if (state.frameCallback && !state.updatesPaused) {
    try {
      state.frameCallback(getDeltaTime(), timestamp);
    } catch (err) {
      console.error("Error in frame callback:", err);
    }
  }

  // Schedule next frame
  const targetDelay = state.updatesPaused
    ? 1000 / IDLE_FRAME_RATE
    : FRAME_DELAY;
  const frameDuration = performance.now() - performance.now(); // Would be calculated properly

  if (USE_REQUEST_IDLE_CALLBACK && state.updatesPaused) {
    window.requestIdleCallback(
      () => {
        state.rafHandle = requestAnimationFrame(frameLoop);
      },
      { timeout: targetDelay }
    );
    return;
  }

  const remainingFrameTime = Math.max(0, targetDelay - frameDuration);

  if (remainingFrameTime > 1) {
    setTimeout(() => {
      state.rafHandle = requestAnimationFrame(frameLoop);
    }, remainingFrameTime);
  } else {
    state.rafHandle = requestAnimationFrame(frameLoop);
  }
};

// Event handlers
const handleVisibilityChange = () => {
  if (document.hidden) {
    state.updatesPaused = true;
    if (state.rafHandle !== null) {
      cancelAnimationFrame(state.rafHandle);
      state.rafHandle = null;
    }
    return;
  }

  resetIdleTimer();
  state.clock.getDelta();
  state.lastTimestamp = 0;

  if (state.rafHandle === null && state.frameCallback) {
    state.rafHandle = requestAnimationFrame(frameLoop);
  }
};

// Exported functions
export function getDeltaTime() {
  return DELTA_SMOOTHING ? state.smoothedDelta : state.deltaTime;
}

export function getFixedDeltaTime() {
  return FIXED_DELTA_TIME;
}

export function runFixedUpdates(stepFn) {
  if (state.updatesPaused) return;
  runPhysicsSteps(stepFn);
}

export function resetIdleTimer() {
  state.lastInteractionTime = Date.now();
  state.updatesPaused = false;
}

export function startFrameCappedLoop(callback) {
  if (state.rafHandle !== null) {
    console.warn("Frame loop already running");
    return;
  }

  // Reset state
  state.clock = new Clock();
  state.accumulator = 0;
  state.deltaTime = FIXED_DELTA_TIME;
  state.smoothedDelta = FIXED_DELTA_TIME;
  state.lastDeltaTimes.fill(FIXED_DELTA_TIME);
  state.frameTimeHistory.fill(FRAME_DELAY);
  state.frameCallback = callback;
  state.updatesPaused = false;
  state.fpsHistory.length = 0;
  state.lastFpsUpdate = 0;
  state.currentFps = 0;
  state.lastTimestamp = 0;
  state.adaptivePhysicsIterations = PHYSICS_ITERATIONS_MAX;
  state.frameCount = 0;
  state.consecutiveSlowFrames = 0;
  state.lastInteractionTime = Date.now();
  state.smoothingStrength = DEFAULT_SMOOTHING_STRENGTH;
  state.isRunning = true;
  state.deltaIndex = 0;
  state.frameTimeIndex = 0;

  // Start the loop
  state.clock.start();
  state.clock.getDelta();
  state.rafHandle = requestAnimationFrame(frameLoop);

  // Set up event listeners
  if (document) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("mousedown", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("touchstart", resetIdleTimer);
    window.addEventListener("focus", resetIdleTimer);

    state.eventHandlers = {
      visibilitychange: handleVisibilityChange,
      mousedown: resetIdleTimer,
      keydown: resetIdleTimer,
      touchstart: resetIdleTimer,
      focus: resetIdleTimer,
    };
  }
}

export function stopFrameCappedLoop() {
  if (state.rafHandle !== null) {
    cancelAnimationFrame(state.rafHandle);
    state.rafHandle = null;
  }

  // Remove event listeners
  if (document && state.eventHandlers) {
    document.removeEventListener(
      "visibilitychange",
      state.eventHandlers.visibilitychange
    );
    document.removeEventListener("mousedown", state.eventHandlers.mousedown);
    document.removeEventListener("keydown", state.eventHandlers.keydown);
    document.removeEventListener("touchstart", state.eventHandlers.touchstart);
    window.removeEventListener("focus", state.eventHandlers.focus);
  }

  state.frameCallback = null;
  state.updatesPaused = true;
  state.isRunning = false;
  state.eventHandlers = null;
}

export function setPaused(paused) {
  state.updatesPaused = paused;
}

export function getPerformanceMetrics() {
  return {
    fps: state.currentFps,
    frameTimeAvg: calculateAverageFrameTime(),
    physicsIterations: state.adaptivePhysicsIterations,
    deltaTime: state.deltaTime,
    smoothedDelta: state.smoothedDelta,
    isIdle: checkIdleState(),
  };
}

export function forcePhysicsIterations(iterations) {
  if (
    iterations >= PHYSICS_ITERATIONS_MIN &&
    iterations <= PHYSICS_ITERATIONS_MAX
  ) {
    state.adaptivePhysicsIterations = iterations;
  }
}

export function setDeltaSmoothing(strength) {
  if (strength >= 0 && strength <= 1) {
    state.smoothingStrength = strength;
  }
}

import { Clock } from "../extern/three/three.core.min.js";
import { isIdle } from "../user-interaction.js";

// Configuration
const TARGET_FPS = 60;
const FIXED_DELTA = 1 / TARGET_FPS;
const MAX_DELTA = 0.1;
const MIN_DELTA = 0.001;
const IDLE_FPS = 5;
const IDLE_THRESHOLD = 60000;
const FRAME_BUDGET = 14;
const PHYSICS_MIN = 1;
const PHYSICS_MAX = 3;

const state = {
  clock: new Clock(),
  accumulator: 0,
  deltaTime: FIXED_DELTA,
  smoothedDelta: FIXED_DELTA,
  rafHandle: null,
  frameCallback: null,
  paused: false,
  lastTimestamp: 0,
  physicsIterations: PHYSICS_MAX,
  frameCount: 0,
  slowFrameCount: 0,
  lastInteraction: Date.now(),
  // Circular buffers for history tracking
  deltaHistory: new Float32Array(5).fill(FIXED_DELTA),
  frameTimeHistory: new Float32Array(10).fill(1000 / TARGET_FPS),
  deltaIndex: 0,
  frameTimeIndex: 0,
  // FPS tracking
  fpsSum: 0,
  fpsCount: 0,
  lastFpsCheck: 0,
};

// Inline helpers - avoid function call overhead
const clamp = (val, min, max) => (val < min ? min : val > max ? max : val);

const updateCircularBuffer = (buffer, value, index, length) => {
  buffer[index] = value;
  return (index + 1) % length;
};

const getBufferAverage = (buffer) => {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i];
  return sum / buffer.length;
};

const isIdleState = () => {
  return typeof isIdle === "function"
    ? isIdle()
    : Date.now() - state.lastInteraction > IDLE_THRESHOLD;
};

// Optimized physics stepping
const runPhysicsSteps = (stepFn) => {
  let steps = 0;
  const maxSteps = state.physicsIterations;

  while (state.accumulator >= FIXED_DELTA && steps < maxSteps) {
    stepFn(FIXED_DELTA);
    state.accumulator -= FIXED_DELTA;
    steps++;
  }

  // Prevent spiral of death
  if (state.accumulator > FIXED_DELTA) {
    state.accumulator = Math.min(state.accumulator, FIXED_DELTA);
  }
};

// Streamlined frame update
const updateFrame = (timestamp) => {
  // First frame initialization
  if (state.lastTimestamp === 0) {
    state.clock.getDelta();
    state.lastTimestamp = timestamp;
    return;
  }

  // Handle large time gaps (tab switching)
  const rawDelta = (timestamp - state.lastTimestamp) / 1000;
  if (rawDelta > MAX_DELTA) {
    state.clock.getDelta();
    state.lastTimestamp = timestamp;
    state.deltaTime = FIXED_DELTA;
    state.smoothedDelta = FIXED_DELTA;
    state.accumulator = FIXED_DELTA;
    return;
  }

  // Update timing
  state.deltaTime = clamp(state.clock.getDelta(), MIN_DELTA, MAX_DELTA);

  // Update delta history and smooth
  state.deltaIndex = updateCircularBuffer(
    state.deltaHistory,
    state.deltaTime,
    state.deltaIndex,
    5
  );

  const avgDelta = getBufferAverage(state.deltaHistory);
  state.smoothedDelta = state.deltaTime * 0.2 + avgDelta * 0.8;

  // Update accumulator and check idle
  state.accumulator += state.deltaTime;
  state.paused = isIdleState();
  state.lastTimestamp = timestamp;
  state.frameCount++;
};

// Performance monitoring (lightweight)
const monitorPerformance = (frameStartTime) => {
  const frameDuration = performance.now() - frameStartTime;

  // Update frame time history
  state.frameTimeIndex = updateCircularBuffer(
    state.frameTimeHistory,
    frameDuration,
    state.frameTimeIndex,
    10
  );

  // Adaptive physics every 60 frames
  if (state.frameCount % 60 === 0) {
    const avgFrameTime = getBufferAverage(state.frameTimeHistory);

    if (avgFrameTime > FRAME_BUDGET * 1.2) {
      state.slowFrameCount++;
      if (state.slowFrameCount > 3) {
        state.physicsIterations = Math.max(
          PHYSICS_MIN,
          state.physicsIterations - 1
        );
        state.slowFrameCount = 0;
      }
    } else if (avgFrameTime < FRAME_BUDGET * 0.7) {
      state.physicsIterations = Math.min(
        PHYSICS_MAX,
        state.physicsIterations + 1
      );
      state.slowFrameCount = 0;
    }
  }

  // FPS calculation (running average)
  if (state.deltaTime > 0) {
    state.fpsSum += 1 / state.deltaTime;
    state.fpsCount++;
  }
};

// Main frame loop
const frameLoop = (timestamp) => {
  const frameStartTime = performance.now();

  updateFrame(timestamp);

  // Run callback if not paused
  if (state.frameCallback && !state.paused) {
    try {
      state.frameCallback(state.smoothedDelta, timestamp);
    } catch (err) {
      console.error("Frame callback error:", err);
    }
  }

  monitorPerformance(frameStartTime);

  // Schedule next frame - simplified scheduling
  const targetDelay = state.paused ? 1000 / IDLE_FPS : 1000 / TARGET_FPS;
  const frameDuration = performance.now() - frameStartTime;
  const delay = Math.max(0, targetDelay - frameDuration);

  if (delay > 1) {
    setTimeout(() => {
      state.rafHandle = requestAnimationFrame(frameLoop);
    }, delay);
  } else {
    state.rafHandle = requestAnimationFrame(frameLoop);
  }
};

// Event handlers
const handleVisibilityChange = () => {
  if (document.hidden) {
    state.paused = true;
    if (state.rafHandle) {
      cancelAnimationFrame(state.rafHandle);
      state.rafHandle = null;
    }
  } else {
    resetIdleTimer();
    state.clock.getDelta(); // Reset clock
    state.lastTimestamp = 0;
    if (!state.rafHandle && state.frameCallback) {
      state.rafHandle = requestAnimationFrame(frameLoop);
    }
  }
};

const resetIdleTimer = () => {
  state.lastInteraction = Date.now();
  state.paused = false;
};

// Public API
export const getDeltaTime = () => state.smoothedDelta;
export const getFixedDeltaTime = () => FIXED_DELTA;

export const runFixedUpdates = (stepFn) => {
  if (!state.paused) runPhysicsSteps(stepFn);
};

export const startFrameCappedLoop = (callback) => {
  if (state.rafHandle) {
    console.warn("Frame loop already running");
    return;
  }

  // Reset state
  state.clock = new Clock();
  state.accumulator = 0;
  state.deltaTime = FIXED_DELTA;
  state.smoothedDelta = FIXED_DELTA;
  state.deltaHistory.fill(FIXED_DELTA);
  state.frameTimeHistory.fill(1000 / TARGET_FPS);
  state.frameCallback = callback;
  state.paused = false;
  state.lastTimestamp = 0;
  state.physicsIterations = PHYSICS_MAX;
  state.frameCount = 0;
  state.slowFrameCount = 0;
  state.lastInteraction = Date.now();
  state.deltaIndex = 0;
  state.frameTimeIndex = 0;
  state.fpsSum = 0;
  state.fpsCount = 0;

  // Start loop
  state.clock.start();
  state.clock.getDelta();
  state.rafHandle = requestAnimationFrame(frameLoop);

  // Event listeners
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("mousedown", resetIdleTimer);
  document.addEventListener("keydown", resetIdleTimer);
  document.addEventListener("touchstart", resetIdleTimer);
  window.addEventListener("focus", resetIdleTimer);
};

export const stopFrameCappedLoop = () => {
  if (state.rafHandle) {
    cancelAnimationFrame(state.rafHandle);
    state.rafHandle = null;
  }

  // Clean up listeners
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  document.removeEventListener("mousedown", resetIdleTimer);
  document.removeEventListener("keydown", resetIdleTimer);
  document.removeEventListener("touchstart", resetIdleTimer);
  window.removeEventListener("focus", resetIdleTimer);

  state.frameCallback = null;
  state.paused = true;
};

export const setPaused = (paused) => {
  state.paused = paused;
};

export const getPerformanceMetrics = () => ({
  fps: state.fpsCount > 0 ? Math.round(state.fpsSum / state.fpsCount) : 0,
  frameTimeAvg: getBufferAverage(state.frameTimeHistory),
  physicsIterations: state.physicsIterations,
  deltaTime: state.deltaTime,
  smoothedDelta: state.smoothedDelta,
  isIdle: isIdleState(),
});

export const forcePhysicsIterations = (iterations) => {
  if (iterations >= PHYSICS_MIN && iterations <= PHYSICS_MAX) {
    state.physicsIterations = iterations;
  }
};

export { resetIdleTimer };

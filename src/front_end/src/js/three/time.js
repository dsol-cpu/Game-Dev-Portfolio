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

// Create initial state factory
const createInitialState = () => ({
  clock: new Clock(),
  accumulator: 0,
  deltaTime: FIXED_DELTA_TIME,
  smoothedDelta: FIXED_DELTA_TIME,
  lastDeltaTimes: Array(5).fill(FIXED_DELTA_TIME),
  frameTimeHistory: Array(FRAME_TIME_HISTORY_SIZE).fill(FRAME_DELAY),
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
});

// Global state container (unavoidable for singleton pattern)
let timeState = createInitialState();

// Pure helper functions
const clampDelta = (delta) =>
  Math.max(MIN_DELTA_TIME, Math.min(delta, MAX_DELTA_TIME));

const calculateSmoothedDelta = (
  deltaTime,
  lastDeltaTimes,
  smoothingStrength
) => {
  if (!DELTA_SMOOTHING) return deltaTime;

  if (USE_CONSISTENT_DELTA) {
    return FIXED_DELTA_TIME;
  }

  const sortedDeltas = [...lastDeltaTimes].sort((a, b) => a - b);
  const filteredDeltas = sortedDeltas.slice(1, -1);

  const avgDelta =
    filteredDeltas.length > 0
      ? filteredDeltas.reduce((sum, dt) => sum + dt, 0) / filteredDeltas.length
      : lastDeltaTimes[lastDeltaTimes.length - 1];

  return deltaTime * (1 - smoothingStrength) + avgDelta * smoothingStrength;
};

const updateDeltaHistory = (lastDeltaTimes, newDelta) => {
  const updated = [...lastDeltaTimes];
  updated.push(newDelta);
  updated.shift();
  return updated;
};

const updateFrameTimeHistory = (frameTimeHistory, newFrameTime) => {
  const updated = [...frameTimeHistory];
  updated.push(newFrameTime);
  updated.shift();
  return updated;
};

const calculateAverageFrameTime = (frameTimeHistory) =>
  frameTimeHistory.reduce((sum, time) => sum + time, 0) /
  frameTimeHistory.length;

const adjustPhysicsIterations = (
  currentIterations,
  avgFrameTime,
  consecutiveSlowFrames
) => {
  if (avgFrameTime > FRAME_BUDGET_MS * 1.2) {
    const newConsecutiveSlowFrames = consecutiveSlowFrames + 1;

    if (newConsecutiveSlowFrames > 3) {
      const newIterations = Math.max(
        PHYSICS_ITERATIONS_MIN,
        currentIterations - 1
      );

      if (DEBUG_MODE) {
        console.log(
          `Reducing physics iterations to ${newIterations} due to slow frames`
        );
      }

      return { iterations: newIterations, consecutiveSlowFrames: 0 };
    }

    return {
      iterations: currentIterations,
      consecutiveSlowFrames: newConsecutiveSlowFrames,
    };
  }

  if (avgFrameTime < FRAME_BUDGET_MS * 0.7) {
    return {
      iterations: Math.min(PHYSICS_ITERATIONS_MAX, currentIterations + 1),
      consecutiveSlowFrames: 0,
    };
  }

  return { iterations: currentIterations, consecutiveSlowFrames: 0 };
};

const calculateCurrentFPS = (fpsHistory) =>
  fpsHistory.length > 0
    ? Math.round(
        fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length
      )
    : 0;

const shouldUpdateFPS = (timestamp, lastFpsUpdate) =>
  timestamp - lastFpsUpdate > 500;

const checkIdleState = (lastInteractionTime) =>
  typeof isIdle === "function"
    ? isIdle()
    : Date.now() - lastInteractionTime > IDLE_THRESHOLD_MS;

// Pure physics update function
const runPhysicsSteps = (accumulator, fixedDeltaTime, maxSteps, stepFn) => {
  if (MEASURE_PERFORMANCE) {
    const startTime = performance.now();
    let steps = 0;
    let currentAccumulator = accumulator;

    while (currentAccumulator >= fixedDeltaTime && steps < maxSteps) {
      stepFn(fixedDeltaTime);
      currentAccumulator -= fixedDeltaTime;
      steps++;
    }

    if (currentAccumulator > fixedDeltaTime && steps >= maxSteps) {
      currentAccumulator = Math.min(currentAccumulator, fixedDeltaTime);

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

    return currentAccumulator;
  }

  let steps = 0;
  let currentAccumulator = accumulator;

  while (currentAccumulator >= fixedDeltaTime && steps < maxSteps) {
    stepFn(fixedDeltaTime);
    currentAccumulator -= fixedDeltaTime;
    steps++;
  }

  if (currentAccumulator > fixedDeltaTime && steps >= maxSteps) {
    currentAccumulator = Math.min(currentAccumulator, fixedDeltaTime);

    if (DEBUG_MODE) {
      console.warn(
        `Time manager: Max physics steps (${maxSteps}) exceeded, reducing accumulated time`
      );
    }
  }

  return currentAccumulator;
};

// State update functions
const updateStateFromFrame = (state, timestamp) => {
  const frameStartTime = performance.now();

  // First frame initialization
  if (state.lastTimestamp === 0) {
    state.clock.getDelta();
    return {
      ...state,
      lastTimestamp: timestamp,
      frameCount: state.frameCount + 1,
    };
  }

  // Calculate delta time
  const rawDelta = (timestamp - state.lastTimestamp) / 1000;

  // Handle tab becoming active after being inactive
  if (rawDelta > MAX_DELTA_TIME) {
    state.clock.getDelta();
    return {
      ...state,
      lastTimestamp: timestamp,
      deltaTime: FIXED_DELTA_TIME,
      smoothedDelta: FIXED_DELTA_TIME,
      accumulator: FIXED_DELTA_TIME,
      frameCount: state.frameCount + 1,
    };
  }

  // Get bounded delta time
  const deltaTime = clampDelta(state.clock.getDelta());

  // Update delta history and calculate smoothed delta
  const updatedDeltaTimes = updateDeltaHistory(state.lastDeltaTimes, deltaTime);
  const smoothedDelta = calculateSmoothedDelta(
    deltaTime,
    updatedDeltaTimes,
    state.smoothingStrength
  );

  // Update accumulator
  const newAccumulator = state.accumulator + deltaTime;

  // Check idle state
  const idle = checkIdleState(state.lastInteractionTime);

  // Performance metrics
  const frameDuration = performance.now() - frameStartTime;
  const updatedFrameTimeHistory = updateFrameTimeHistory(
    state.frameTimeHistory,
    frameDuration
  );

  let updatedState = {
    ...state,
    lastTimestamp: timestamp,
    deltaTime,
    smoothedDelta,
    lastDeltaTimes: updatedDeltaTimes,
    accumulator: newAccumulator,
    updatesPaused: idle,
    frameTimeHistory: updatedFrameTimeHistory,
    frameCount: state.frameCount + 1,
  };

  // Update FPS if needed
  if (DEBUG_MODE && shouldUpdateFPS(timestamp, state.lastFpsUpdate)) {
    const newFpsHistory =
      deltaTime > 0 ? [...state.fpsHistory, 1 / deltaTime] : state.fpsHistory;
    const currentFps = calculateCurrentFPS(newFpsHistory);

    if (currentFps < TARGET_FRAME_RATE * 0.8) {
      console.warn(`Low FPS: ${currentFps}`);
    }

    // Analyze performance every 60 frames
    if (state.frameCount % 60 === 0) {
      const avgFrameTime = calculateAverageFrameTime(updatedFrameTimeHistory);
      const { iterations, consecutiveSlowFrames } = adjustPhysicsIterations(
        state.adaptivePhysicsIterations,
        avgFrameTime,
        state.consecutiveSlowFrames
      );

      updatedState = {
        ...updatedState,
        adaptivePhysicsIterations: iterations,
        consecutiveSlowFrames,
      };
    }

    updatedState = {
      ...updatedState,
      currentFps,
      fpsHistory: [],
      lastFpsUpdate: timestamp,
    };
  } else if (deltaTime > 0) {
    updatedState = {
      ...updatedState,
      fpsHistory: [...state.fpsHistory, 1 / deltaTime],
    };
  }

  return updatedState;
};

// Frame loop factory
const createFrameLoop = () => {
  const frameLoop = (timestamp) => {
    const updatedState = updateStateFromFrame(timeState, timestamp);
    timeState = updatedState;

    // Run frame callback
    if (timeState.frameCallback && !timeState.updatesPaused) {
      try {
        timeState.frameCallback(getDeltaTime(), timestamp);
      } catch (err) {
        console.error("Error in frame callback:", err);
      }
    }

    // Schedule next frame
    const idle = timeState.updatesPaused;
    const targetDelay = idle ? 1000 / IDLE_FRAME_RATE : FRAME_DELAY;
    const frameDuration = performance.now() - performance.now(); // This would be calculated in updateStateFromFrame

    if (USE_REQUEST_IDLE_CALLBACK && idle) {
      window.requestIdleCallback(
        () => {
          timeState.rafHandle = requestAnimationFrame(frameLoop);
        },
        { timeout: targetDelay }
      );
    } else {
      const remainingFrameTime = Math.max(0, targetDelay - frameDuration);

      if (remainingFrameTime > 1) {
        setTimeout(() => {
          timeState.rafHandle = requestAnimationFrame(frameLoop);
        }, remainingFrameTime);
      } else {
        timeState.rafHandle = requestAnimationFrame(frameLoop);
      }
    }
  };

  return frameLoop;
};

// Event handler factories
const createVisibilityChangeHandler = () => () => {
  if (document.hidden) {
    timeState = { ...timeState, updatesPaused: true };
    if (timeState.rafHandle !== null) {
      cancelAnimationFrame(timeState.rafHandle);
      timeState = { ...timeState, rafHandle: null };
    }
  } else {
    resetIdleTimer();
    timeState.clock.getDelta();
    timeState = { ...timeState, lastTimestamp: 0 };

    if (timeState.rafHandle === null && timeState.frameCallback) {
      const frameLoop = createFrameLoop();
      timeState = { ...timeState, rafHandle: requestAnimationFrame(frameLoop) };
    }
  }
};

// Exported functions (maintaining original API)
export function getDeltaTime() {
  return DELTA_SMOOTHING ? timeState.smoothedDelta : timeState.deltaTime;
}

export function getFixedDeltaTime() {
  return FIXED_DELTA_TIME;
}

export function runFixedUpdates(stepFn) {
  if (timeState.updatesPaused) return;

  const newAccumulator = runPhysicsSteps(
    timeState.accumulator,
    FIXED_DELTA_TIME,
    timeState.adaptivePhysicsIterations,
    stepFn
  );

  timeState = { ...timeState, accumulator: newAccumulator };
}

export function resetIdleTimer() {
  timeState = {
    ...timeState,
    lastInteractionTime: Date.now(),
    updatesPaused: false,
  };
}

export function startFrameCappedLoop(callback) {
  if (timeState.rafHandle !== null) {
    console.warn("Frame loop already running");
    return;
  }

  // Reset to initial state with new callback
  timeState = {
    ...createInitialState(),
    frameCallback: callback,
    isRunning: true,
  };

  // Start the loop
  timeState.clock.start();
  timeState.clock.getDelta();

  const frameLoop = createFrameLoop();
  timeState.rafHandle = requestAnimationFrame(frameLoop);

  // Set up event listeners
  if (document) {
    const visibilityHandler = createVisibilityChangeHandler();

    document.addEventListener("visibilitychange", visibilityHandler);
    document.addEventListener("mousedown", resetIdleTimer);
    document.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("touchstart", resetIdleTimer);
    window.addEventListener("focus", resetIdleTimer);
    window.addEventListener("blur", () => {});

    // Store handlers for cleanup
    timeState = {
      ...timeState,
      eventHandlers: {
        visibilitychange: visibilityHandler,
        mousedown: resetIdleTimer,
        keydown: resetIdleTimer,
        touchstart: resetIdleTimer,
        focus: resetIdleTimer,
        blur: () => {},
      },
    };
  }
}

export function stopFrameCappedLoop() {
  if (timeState.rafHandle !== null) {
    cancelAnimationFrame(timeState.rafHandle);
  }

  // Remove event listeners
  if (document && timeState.eventHandlers) {
    const handlers = timeState.eventHandlers;
    document.removeEventListener("visibilitychange", handlers.visibilitychange);
    document.removeEventListener("mousedown", handlers.mousedown);
    document.removeEventListener("keydown", handlers.keydown);
    document.removeEventListener("touchstart", handlers.touchstart);
    window.removeEventListener("focus", handlers.focus);
    window.removeEventListener("blur", handlers.blur);
  }

  timeState = {
    ...timeState,
    rafHandle: null,
    frameCallback: null,
    updatesPaused: true,
    isRunning: false,
    eventHandlers: null,
  };
}

export function setPaused(paused) {
  timeState = { ...timeState, updatesPaused: paused };
}

export function getPerformanceMetrics() {
  return {
    fps: timeState.currentFps,
    frameTimeAvg: calculateAverageFrameTime(timeState.frameTimeHistory),
    physicsIterations: timeState.adaptivePhysicsIterations,
    deltaTime: timeState.deltaTime,
    smoothedDelta: timeState.smoothedDelta,
    isIdle: checkIdleState(timeState.lastInteractionTime),
  };
}

export function forcePhysicsIterations(iterations) {
  if (
    iterations >= PHYSICS_ITERATIONS_MIN &&
    iterations <= PHYSICS_ITERATIONS_MAX
  ) {
    timeState = { ...timeState, adaptivePhysicsIterations: iterations };
  }
}

export function setDeltaSmoothing(strength) {
  if (strength >= 0 && strength <= 1) {
    timeState = { ...timeState, smoothingStrength: strength };
  }
}

import { isIdle } from "../user-interaction.js";

const TARGET_FRAME_RATE = 60;
const FRAME_DELAY = 1000 / TARGET_FRAME_RATE;
const FIXED_DELTA_TIME = 1 / TARGET_FRAME_RATE; // 60Hz physics step
const FPS_SMOOTHING_ALPHA = 0.1;
const MAX_DELTA_TIME = 0.05; // 50ms max per frame

let accumulator = 0;
let lastFrameTime = performance.now();
let deltaTime = FIXED_DELTA_TIME;
let smoothedDeltaTime = deltaTime;
let smoothedFPS = TARGET_FRAME_RATE;
let rafHandle = null;
let frameCallback = null;

let lastActualFrameTimes = Array(10).fill(FRAME_DELAY);
let frameTimeIndex = 0;

export function getDeltaTime() {
  return deltaTime;
}

export function getSmoothedDeltaTime() {
  return smoothedDeltaTime;
}

export function getFixedDeltaTime() {
  return FIXED_DELTA_TIME;
}

export function runFixedUpdates(stepFn) {
  while (accumulator >= FIXED_DELTA_TIME) {
    stepFn(FIXED_DELTA_TIME);
    accumulator -= FIXED_DELTA_TIME;
  }
}

export function getEstimatedFPS() {
  if (isIdle()) return 0;

  const avgFrameTime =
    lastActualFrameTimes.reduce((sum, time) => sum + time, 0) /
    lastActualFrameTimes.length;
  smoothedFPS =
    FPS_SMOOTHING_ALPHA * (1000 / avgFrameTime) +
    (1 - FPS_SMOOTHING_ALPHA) * smoothedFPS;

  return Math.min(smoothedFPS, TARGET_FRAME_RATE);
}

function recordActualFrameTime(frameTime) {
  lastActualFrameTimes[frameTimeIndex] = frameTime;
  frameTimeIndex = (frameTimeIndex + 1) % lastActualFrameTimes.length;
}

function frameLoop(timestamp) {
  const now = performance.now();
  const actualElapsed = now - lastFrameTime;
  lastFrameTime = now;

  deltaTime = FIXED_DELTA_TIME;
  smoothedDeltaTime = FIXED_DELTA_TIME;
  accumulator += FIXED_DELTA_TIME;

  if (frameCallback) {
    frameCallback(timestamp);
  }

  recordActualFrameTime(actualElapsed);
  setTimeout(() => {
    rafHandle = requestAnimationFrame(frameLoop);
  }, Math.max(0, FRAME_DELAY - (performance.now() - now)));
}

export function startFrameCappedLoop(callback) {
  if (rafHandle !== null) {
    console.warn("Frame capped loop already running");
    return;
  }

  frameCallback = callback;
  lastFrameTime = performance.now();
  rafHandle = requestAnimationFrame(frameLoop);
}

export function stopFrameCappedLoop() {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    frameCallback = null;
  }
}

import { isIdle } from "../user-interaction";

let lastTime = performance.now();
let deltaTime = 0;
let frameRate = 60;
let frameCap = true;
let frameDelay = 1000 / frameRate;
const MAX_DELTA = 0.2; // Maximum allowed delta (in seconds)
const DEFAULT_DELTA = 0.016; // ~60 FPS fallback delta

/**
 * Updates time values and enforces frame rate if needed
 * @returns {number|null} Delta time in seconds or null if frame should be skipped
 */
export function updateTime() {
  const currentTime = performance.now();
  const rawDeltaTime = currentTime - lastTime;

  if (isIdle() || (frameCap && rawDeltaTime < frameDelay)) {
    return null; // Skip frame during idle or when under frame delay
  }

  lastTime = currentTime;
  deltaTime = Math.min(rawDeltaTime / 1000, MAX_DELTA) || DEFAULT_DELTA;

  return deltaTime;
}

/**
 * Gets the current delta time value
 * @returns {number} Delta time in seconds
 */
export function getDeltaTime() {
  return deltaTime;
}

/**
 * Resets the time tracking values
 */
export function resetTime() {
  lastTime = performance.now();
  deltaTime = 0;
}

/**
 * Sets the target frame rate for framecapping.
 * @param {number} fps - Frames per second.
 */
export function setFrameRate(fps) {
  frameRate = fps;
  frameDelay = 1000 / frameRate;
}

/**
 * Enables or disables framecapping.
 * @param {boolean} enabled - Whether framecapping should be enabled.
 */
export function setFrameCap(enabled) {
  frameCap = enabled;
}

/**
 * Gets the current target frame rate.
 * @returns {number} The target frames per second.
 */
export function getFrameRate() {
  return frameRate;
}

export function isFrameCapped() {
  return frameCap;
}

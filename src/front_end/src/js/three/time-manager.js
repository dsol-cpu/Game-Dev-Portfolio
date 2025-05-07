import { isIdle } from "../user-interaction.js";

let frameRate = 60;
let frameDelay = 1000 / frameRate;
let frameDeltaTime = 1 / frameRate; // Fixed delta time per frame to stabilize fps
let lastFrameTime = performance.now();
let nextFrameTime = lastFrameTime + frameDelay;

/**
 * Updates time values and enforces frame rate if needed
 * @returns {number|null} Delta time in seconds or null if frame should be skipped
 */
export function updateTime() {
  const currentTime = performance.now();

  // If idle, skip frame and do NOT update any timing state
  if (isIdle() && currentTime < nextFrameTime) return null;

  // Schedule next frame
  nextFrameTime = currentTime + frameDelay;

  // Update last frame time (used in FPS estimation)
  lastFrameTime = currentTime;

  // Return fixed delta time (for logic/physics steps)
  return frameDeltaTime;
}

/**
 * Gets the current delta time value
 * @returns {number} Delta time in seconds
 */
export function getDeltaTime() {
  return frameDeltaTime;
}

/**
 * Gets the current target frame rate.
 * @returns {number} The target frames per second.
 */
export function getFrameRate() {
  return frameRate;
}

/**
 * Checks if frame capping is enabled
 * @returns {boolean} True if frame capping is enabled
 */
export function isFrameCapped() {
  return true;
}

/**
 * Gets the estimated actual framerate based on most recent frame timing
 * @returns {number} Estimated FPS
 */
export function getEstimatedFPS() {
  // No new calculations if idle so 0 new frames rendered.
  if (isIdle()) return 0;
  return frameRate;
}

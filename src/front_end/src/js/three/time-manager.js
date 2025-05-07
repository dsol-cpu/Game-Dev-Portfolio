import { isIdle } from "../user-interaction";

let lastTime = performance.now();
let deltaTime = 0;
let frameRate = 60; // Default frame rate (FPS)
let frameCap = true; // Whether to cap the frame rate
let frameDelay = 1000 / frameRate; // Time in ms per frame

/**
 * Updates the time values and returns the delta time.
 * With framecapping, this can limit how often your game loop runs.
 * @returns {number} The delta time in seconds.
 */
export function updateTime() {
  const currentTime = performance.now();
  let rawDeltaTime = currentTime - lastTime;
  if (isIdle()) return null;
  // If framecapping is enabled, enforce the frame rate
  if (frameCap && rawDeltaTime < frameDelay) {
    // Return null to indicate that the frame should be skipped
    return null;
  }

  // Convert ms to seconds
  deltaTime = rawDeltaTime / 1000;

  // Safeguard against extremely large delta times (e.g. after tab switch)
  if (deltaTime > 0.2) {
    deltaTime = 0.016; // Default to ~60 FPS
  }

  lastTime = currentTime;
  return deltaTime;
}

/**
 * Gets the most recent delta time value.
 * @returns {number} The delta time in seconds.
 */
export function getDeltaTime() {
  return deltaTime;
}

/**
 * Resets the time values.
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

/**
 * Checks if framecapping is currently enabled.
 * @returns {boolean} Whether framecapping is enabled.
 */
export function isFrameCapEnabled() {
  return frameCap;
}

/**
 * @fileoverview Utility helpers
 */

const PERF =
  typeof performance !== "undefined" && performance.now
    ? performance
    : { now: Date.now };

const ONE_SECOND = 1000;

const getViewportSize = () => ({
  w: window.innerWidth || document.documentElement.clientWidth,
  h: window.innerHeight || document.documentElement.clientHeight,
});

function debounce(fn, wait, immediate = false) {
  let timeout;

  return function (...args) {
    if (timeout) clearTimeout(timeout);

    const callNow = immediate && !timeout;
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) fn.apply(this, args);
    }, wait);

    if (callNow) fn.apply(this, args);
  };
}

// Throttle: timestamp-based, low overhead
function throttle(fn, limit) {
  let lastCall = 0;

  return function (...args) {
    const now = PERF.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/**
 * Check if an element is visible in the viewport
 * @param {HTMLElement} element - The element to check
 * @param {number} threshold - Percentage (0-1) of element that must be visible
 * @returns {boolean} - Whether the element is visible
 */
function isElementInViewport(element, threshold = 0.1) {
  if (!element?.getBoundingClientRect) return false;

  const rect = element.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // Calculate the percentage of the element that is visible
  const visibleHeight =
    Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
  const visibleWidth =
    Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);

  const visibleArea = visibleHeight * visibleWidth;
  const totalArea = rect.height * rect.width;

  // Element is considered visible if the visible area is at least the threshold percentage
  return totalArea > 0 && visibleArea / totalArea >= threshold;
}

// FPS tracking
let frameCount = 0,
  lastTime = 0,
  fps = 0;

function updateFPS(timestamp) {
  frameCount++;
  const delta = timestamp - lastTime;

  if (delta >= ONE_SECOND) {
    fps = (frameCount * ONE_SECOND) / delta;
    frameCount = 0;
    lastTime = timestamp;
  }

  return fps;
}

/**
 * Safely call a function with error handling
 * @param {Function} fn - The function to call
 * @param {Array} args - Arguments to pass to the function
 * @param {any} defaultValue - Default value to return if function fails
 * @returns {any} - The result of the function or the default value
 */
function safeCall(fn, args = [], defaultValue = null) {
  try {
    return fn(...args);
  } catch (error) {
    console.error("Error in safeCall:", error);
    return defaultValue;
  }
}

const getFPS = () => fps;

export { debounce, throttle, isElementInViewport, updateFPS, getFPS, safeCall };

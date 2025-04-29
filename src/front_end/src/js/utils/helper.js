/**
 * @fileoverview Utility helper functions
 */

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The time to wait in milliseconds
 * @param {boolean} immediate - Whether to call the function immediately
 * @returns {Function} The debounced function
 */
function debounce(func, wait, immediate = false) {
  let timeout;

  return function executedFunction(...args) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);

    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle function to limit how often a function is called
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} The throttled function
 */
function throttle(func, limit) {
  let inThrottle;

  return function (...args) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Check if element is in viewport with improved calculation
 */
function isElementInViewport(el) {
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  // Element is at least partially visible
  return (
    rect.top <= windowHeight &&
    rect.bottom >= 0 &&
    rect.left <= windowWidth &&
    rect.right >= 0
  );
}

/**
 * Simple performance monitoring
 */
let frameCounter = 0;
let lastFPSUpdate = 0;
let fpsValue = 0;

function updateFPS(timestamp) {
  frameCounter++;

  const elapsedTime = timestamp - lastFPSUpdate;

  // Update FPS counter if 1 second has passed or more
  if (elapsedTime >= 1000) {
    fpsValue = frameCounter / (elapsedTime / 1000);
    frameCounter = 0;
    lastFPSUpdate = timestamp;
  }

  return fpsValue;
}

/**
 * Get current FPS value
 */
function getFPS() {
  return fpsValue;
}

export { debounce, throttle, isElementInViewport, updateFPS, getFPS };

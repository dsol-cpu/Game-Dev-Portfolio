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

// Viewport detection with cached dimensions
function isElementInViewport(el) {
  const rect = el?.getBoundingClientRect?.();
  if (!rect) return false;

  const { top, bottom, left, right } = rect;
  const { w, h } = getViewportSize();

  return top <= h && bottom >= 0 && left <= w && right >= 0;
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

const getFPS = () => fps;

export { debounce, throttle, isElementInViewport, updateFPS, getFPS };

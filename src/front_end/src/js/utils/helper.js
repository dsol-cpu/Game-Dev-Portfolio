/**
 * @fileoverview Utility helpers
 */

const PERF =
  typeof performance !== "undefined" ? performance : { now: Date.now };
const ONE_SECOND = 1000;

export function getViewportSize() {
  return {
    w: window.innerWidth || document.documentElement.clientWidth,
    h: window.innerHeight || document.documentElement.clientHeight,
  };
}

export function debounce(fn, wait, immediate = false) {
  let timeout;
  return function (...args) {
    const callNow = immediate && !timeout;
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) fn.apply(this, args);
    }, wait);

    if (callNow) fn.apply(this, args);
  };
}

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

function isElementInViewport(element, threshold = 0.1) {
  if (!element?.getBoundingClientRect) return false;

  const rect = element.getBoundingClientRect();
  const viewport = getViewportSize();

  const visibleHeight =
    Math.min(rect.bottom, viewport.h) - Math.max(rect.top, 0);
  const visibleWidth =
    Math.min(rect.right, viewport.w) - Math.max(rect.left, 0);

  const visibleArea = visibleHeight * visibleWidth;
  const totalArea = rect.height * rect.width;

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

function safeCall(fn, args = [], defaultValue = null) {
  try {
    return fn(...args);
  } catch (error) {
    console.error("Error in safeCall:", error);
    return defaultValue;
  }
}

const getFPS = () => fps;

export { throttle, isElementInViewport, updateFPS, getFPS, safeCall };

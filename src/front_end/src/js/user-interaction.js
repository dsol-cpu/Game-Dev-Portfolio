/**
 * @fileoverview Handles user interaction tracking for performance optimizations
 */

// Constants
const INTERACTION_TIMEOUT = 6000; // ms before switching to idle framerate
const INTERACTION_THROTTLE = 16; // ~60fps
const KEY_PRESS_TIMEOUT = 1000; // ms to consider user actively typing

// Global state
let lastInteractionTime = 0;
let lastInteractionCallTime = 0;
let lastKeyPressTime = 0;
let userActive = false;
let onInteractionCallbacks = new Set();
let onIdleStateChangeCallbacks = new Set();
let isCurrentlyIdle = false;
let windowHasFocus = true;

/**
 * Initialize user interaction tracking
 */
export function initUserInteraction() {
  // Add passive flag for better performance
  const passiveOpts = { passive: true };

  window.addEventListener("focus", handleWindowFocus, passiveOpts);
  window.addEventListener("blur", handleWindowBlur, passiveOpts);
  document.addEventListener("mousemove", handleUserInteraction, passiveOpts);
  document.addEventListener("touchstart", handleUserInteraction, passiveOpts);
  document.addEventListener("keydown", handleKeyPress, passiveOpts);
  document.addEventListener("scroll", handleUserInteraction, passiveOpts);
  document.addEventListener("wheel", handleUserInteraction, passiveOpts);
  document.addEventListener("click", handleUserInteraction, passiveOpts);

  // Handle visibility changes
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Initialize state
  userActive = !document.hidden;
  windowHasFocus = document.hasFocus();

  // Consider user active initially
  handleUserInteraction();

  // Start idle check interval
  startIdleCheck();
}

/**
 * Register a callback to be called on user interaction
 * @param {Function} callback - Function to call on interaction
 */
export function onUserInteraction(callback) {
  if (typeof callback === "function") {
    onInteractionCallbacks.add(callback);
  }
}

/**
 * Register a callback for idle state changes
 * @param {Function} callback - Function(isIdle) to call when idle state changes
 */
export function onIdleStateChange(callback) {
  if (typeof callback === "function") {
    onIdleStateChangeCallbacks.add(callback);
  }
}

/**
 * Handle window focus
 */
function handleWindowFocus() {
  windowHasFocus = true;
  userActive = true;
  notifyInteraction();
}

/**
 * Handle window blur
 */
function handleWindowBlur() {
  windowHasFocus = false;
  userActive = false;
}

/**
 * Handle key presses and track typing activity
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyPress(event) {
  lastKeyPressTime = performance.now();
  handleUserInteraction(event);
}

/**
 * Track user interaction for adaptive framerate
 * @param {Event} [event] - Optional event that triggered the interaction
 */
export function handleUserInteraction(event) {
  const now = performance.now();

  // Throttle frequent events like mousemove
  if (
    event &&
    (event.type === "mousemove" ||
      event.type === "wheel" ||
      event.type === "keypress") &&
    now - lastInteractionCallTime < INTERACTION_THROTTLE
  ) {
    return;
  }

  lastInteractionCallTime = now;
  lastInteractionTime = now;

  notifyInteraction();
}

/**
 * Notify all registered callbacks about an interaction
 */
function notifyInteraction() {
  onInteractionCallbacks.forEach((callback) => {
    try {
      callback();
    } catch (e) {
      console.error("Error in interaction callback:", e);
    }
  });

  // If we were idle and now we're not, notify about state change
  if (isCurrentlyIdle) {
    isCurrentlyIdle = false;
    notifyIdleStateChange(false);
  }
}

/**
 * Check if user is actively typing
 * @returns {boolean} True if user is actively typing
 */
function isActivelyTyping() {
  return (
    windowHasFocus && performance.now() - lastKeyPressTime < KEY_PRESS_TIMEOUT
  );
}

/**
 * Check if we should be in idle mode (lower framerate)
 * @returns {boolean} True if in idle mode
 */
export function isIdle() {
  // User is not idle if they're actively typing with window focus
  if (isActivelyTyping()) {
    return false;
  }

  return (
    !userActive ||
    document.hidden ||
    performance.now() - lastInteractionTime > INTERACTION_TIMEOUT
  );
}

/**
 * Notify idle state change callbacks
 * @param {boolean} idleState - Whether system is now idle
 */
function notifyIdleStateChange(idleState) {
  onIdleStateChangeCallbacks.forEach((callback) => {
    try {
      callback(idleState);
    } catch (e) {
      console.error("Error in idle state change callback:", e);
    }
  });
}

/**
 * Start periodic idle state check
 */
function startIdleCheck() {
  // Check idle state every second
  setInterval(() => {
    const currentIdleState = isIdle();

    // Only notify if state changed
    if (currentIdleState !== isCurrentlyIdle) {
      isCurrentlyIdle = currentIdleState;
      notifyIdleStateChange(currentIdleState);
    }
  }, 1000);
}

/**
 * Handle document visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    userActive = false;
  } else {
    userActive = true;
    handleUserInteraction();
  }

  // Notify about possible idle state change
  const currentIdleState = isIdle();
  if (currentIdleState !== isCurrentlyIdle) {
    isCurrentlyIdle = currentIdleState;
    notifyIdleStateChange(currentIdleState);
  }
}

/**
 * Clean up all event listeners
 */
export function cleanupUserInteraction() {
  window.removeEventListener("focus", handleWindowFocus);
  window.removeEventListener("blur", handleWindowBlur);
  document.removeEventListener("mousemove", handleUserInteraction);
  document.removeEventListener("touchstart", handleUserInteraction);
  document.removeEventListener("keydown", handleKeyPress);
  document.removeEventListener("scroll", handleUserInteraction);
  document.removeEventListener("wheel", handleUserInteraction);
  document.removeEventListener("click", handleUserInteraction);
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  onInteractionCallbacks.clear();
  onIdleStateChangeCallbacks.clear();
}

/**
 * @fileoverview Enhanced OrbitControls with additional functionality
 */

import { OrbitControls } from "../extern/three/OrbitControls.js";
import { handleUserInteraction } from "../user-interaction.js";
import { C } from "../constants/constants.js";

/**
 * Default orbit controls configuration
 */
export const orbitControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  autoRotate: true,
  autoRotateSpeed: C.AUTO_ROTATE_SPEED,
  enableZoom: true,
  minDistance: C.MIN_DISTANCE,
  maxDistance: C.MAX_DISTANCE,
};

/**
 * Patch OrbitControls with enhanced functionality
 */
export function patchOrbitControls() {
  if (OrbitControls.prototype._patched) return OrbitControls;

  OrbitControls.prototype._patched = true;

  // Add _initListeners helper method
  OrbitControls.prototype._initListeners = function () {
    this._listeners = {
      start: new Set(),
      end: new Set(),
      change: new Set(),
      control: new Set(),
    };
  };

  // Patch methods with safety wrappers
  const methods = {
    onMouseDown(event) {
      if (!this._listeners) this._initListeners();
      this._dragging = true;
      this._lastDragTime = performance.now();
      handleUserInteraction();
    },
    onMouseUp() {
      this._dragging = false;
    },
    onMouseMove(event) {
      const now = performance.now();
      if (this._lastMoveTime && now - this._lastMoveTime <= 16)
        event.preventDefault();
      this._lastMoveTime = now;
      if (this._dragging) this._lastDragTime = now;
    },
    onTouchStart(event) {
      if (!this._listeners) this._initListeners();
      this._dragging = true;
      this._lastDragTime = performance.now();
      handleUserInteraction();
    },
    onTouchEnd() {
      this._dragging = false;
    },
    onTouchMove(event) {
      const now = performance.now();
      if (!this._lastMoveTime || now - this._lastMoveTime > 16) {
        this._lastMoveTime = now;
        this._lastDragTime = now;
      } else {
        event.preventDefault();
      }
    },
  };

  // Apply patches
  Object.entries(methods).forEach(([key, fn]) => {
    const original = OrbitControls.prototype[key];
    OrbitControls.prototype[key] = function (event) {
      fn.call(this, event);
      if (original) original.call(this, event);
    };
  });

  // Safer event handling
  OrbitControls.prototype.addEventListener = function (type, listener) {
    if (!this._listeners) this._initListeners();
    this._listeners[type]?.add(listener);
  };

  OrbitControls.prototype.removeEventListener = function (type, listener) {
    this._listeners?.[type]?.delete(listener);
  };

  OrbitControls.prototype.dispatchEvent = function (e) {
    if (!e?.type || !this._listeners?.[e.type]) return false;

    e.target = this;
    Array.from(this._listeners[e.type]).forEach((fn) => {
      if (typeof fn === "function") {
        try {
          fn.call(this, e);
        } catch {}
      }
    });

    return true;
  };

  const originalDispose = OrbitControls.prototype.dispose || function () {};
  OrbitControls.prototype.dispose = function () {
    originalDispose.call(this);
    if (this._listeners) {
      Object.keys(this._listeners).forEach((type) => {
        this._listeners[type].clear();
      });
      this._listeners = null;
    }
  };

  return OrbitControls;
}

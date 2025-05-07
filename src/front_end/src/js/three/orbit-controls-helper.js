import { OrbitControls } from "../extern/three/OrbitControls.js";
import { handleUserInteraction } from "../user-interaction.js";
import { C } from "../constants/constants.js";

// Default configuration object
export const orbitControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  autoRotate: true,
  autoRotateSpeed: C.AUTO_ROTATE_SPEED,
  enableZoom: true,
  minDistance: C.MIN_DISTANCE,
  maxDistance: C.MAX_DISTANCE,
};

// Main enhancement function
export function patchOrbitControls() {
  // Skip if already patched
  if (OrbitControls.prototype._patched) return OrbitControls;

  OrbitControls.prototype._patched = true;

  // Initialize listeners container
  OrbitControls.prototype._initListeners = function () {
    this._listeners = {
      start: new Set(),
      end: new Set(),
      change: new Set(),
      control: new Set(),
    };
  };

  // Enhanced mouse/touch event handlers
  OrbitControls.prototype.onMouseDown = function (event) {
    if (!this._listeners) this._initListeners();
    this._dragging = true;
    this._lastDragTime = performance.now();
    handleUserInteraction();

    // Original handler executed by Three.js
  };

  OrbitControls.prototype.onMouseUp = function () {
    this._dragging = false;

    // Original handler executed by Three.js
  };

  OrbitControls.prototype.onMouseMove = function (event) {
    const now = performance.now();
    if (this._lastMoveTime && now - this._lastMoveTime <= 16) {
      event.preventDefault();
    }
    this._lastMoveTime = now;
    if (this._dragging) this._lastDragTime = now;

    // Original handler executed by Three.js
  };

  OrbitControls.prototype.onTouchStart = function (event) {
    if (!this._listeners) this._initListeners();
    this._dragging = true;
    this._lastDragTime = performance.now();
    handleUserInteraction();

    // Original handler executed by Three.js
  };

  OrbitControls.prototype.onTouchEnd = function () {
    this._dragging = false;

    // Original handler executed by Three.js
  };

  OrbitControls.prototype.onTouchMove = function (event) {
    const now = performance.now();
    if (!this._lastMoveTime || now - this._lastMoveTime > 16) {
      this._lastMoveTime = now;
      this._lastDragTime = now;
    } else {
      event.preventDefault();
    }

    // Original handler executed by Three.js
  };

  // Simplified event handling
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
    this._listeners[e.type].forEach((fn) => {
      if (typeof fn === "function") {
        try {
          fn.call(this, e);
        } catch (error) {
          // Silently handle errors
        }
      }
    });

    return true;
  };

  // Enhanced dispose method
  OrbitControls.prototype.dispose = function () {
    // Call original dispose if it exists
    if (OrbitControls.prototype.dispose) {
      OrbitControls.prototype.dispose.call(this);
    }

    // Clean up listeners
    if (this._listeners) {
      Object.keys(this._listeners).forEach((type) => {
        this._listeners[type].clear();
      });
      this._listeners = null;
    }
  };

  return OrbitControls;
}

/**
 * @fileoverview Orbit camera system
 */

import { Vector3, Spherical } from "../extern/three/three.module.min.js";

// Orbit camera constants
const ORBIT = {
  MIN_DISTANCE: 2,
  MAX_DISTANCE: 15,
  DEFAULT_DISTANCE: 5,
  HEIGHT_OFFSET: 2,
  ROTATION_SPEED: 0.01,
  ZOOM_SPEED: 0.1,
  SMOOTHING: 0.1,
};

// State tracking
const cameraState = {
  targetPosition: new Vector3(),
  spherical: new Spherical(),
  isDragging: false,
  previousMouseX: 0,
  previousMouseY: 0,
  currentDistance: ORBIT.DEFAULT_DISTANCE,
};

// Temp working vectors
const tempTargetPosition = new Vector3();
const tempCameraPosition = new Vector3();

/**
 * Initialize orbit camera controls
 * @param {PerspectiveCamera} camera - The camera to control
 * @param {Object3D} target - The target to orbit around
 */
export function initOrbitControls(camera, target) {
  if (!camera || !target) return;

  // Initialize spherical coordinates
  cameraState.targetPosition.copy(target.position);
  cameraState.currentDistance = ORBIT.DEFAULT_DISTANCE;
  cameraState.spherical.set(
    ORBIT.DEFAULT_DISTANCE,
    Math.PI / 4, // theta (polar angle)
    0 // phi (azimuthal angle)
  );

  // Set initial camera position
  updateCameraPosition(camera);

  // Add event listeners for mouse/touch interaction
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("wheel", onMouseWheel);

  // Touch events for mobile
  document.addEventListener("touchstart", onTouchStart);
  document.addEventListener("touchmove", onTouchMove);
  document.addEventListener("touchend", onTouchEnd);
}

/**
 * Update orbit camera to follow a target
 * @param {PerspectiveCamera} camera - The camera to control
 * @param {Object3D} target - The target to orbit around
 * @param {number} deltaTime - Time since last update in milliseconds
 */
export function updateOrbitCamera(camera, target, deltaTime) {
  if (!camera || !target) return;

  // Smoothly update target position
  tempTargetPosition.copy(target.position);
  tempTargetPosition.y += ORBIT.HEIGHT_OFFSET;
  cameraState.targetPosition.lerp(
    tempTargetPosition,
    ORBIT.SMOOTHING * (deltaTime / 16)
  );

  // Update camera position based on spherical coordinates
  updateCameraPosition(camera);

  // Make camera look at target
  camera.lookAt(cameraState.targetPosition);
}

/**
 * Update the camera position based on spherical coordinates
 * @param {PerspectiveCamera} camera - The camera to control
 */
function updateCameraPosition(camera) {
  // Convert spherical coordinates to cartesian
  tempCameraPosition.setFromSpherical(cameraState.spherical);

  // Add to target position
  tempCameraPosition.add(cameraState.targetPosition);

  // Update camera position
  camera.position.copy(tempCameraPosition);
}

/**
 * Handle mouse down event
 * @param {MouseEvent} event - The mouse event
 */
function onMouseDown(event) {
  cameraState.isDragging = true;
  cameraState.previousMouseX = event.clientX;
  cameraState.previousMouseY = event.clientY;
}

/**
 * Handle mouse move event
 * @param {MouseEvent} event - The mouse event
 */
function onMouseMove(event) {
  if (!cameraState.isDragging) return;

  const deltaX = event.clientX - cameraState.previousMouseX;
  const deltaY = event.clientY - cameraState.previousMouseY;

  // Update spherical coordinates based on mouse movement
  cameraState.spherical.phi -= deltaX * ORBIT.ROTATION_SPEED;
  cameraState.spherical.theta = Math.max(
    0.1,
    Math.min(
      Math.PI - 0.1,
      cameraState.spherical.theta + deltaY * ORBIT.ROTATION_SPEED
    )
  );

  cameraState.previousMouseX = event.clientX;
  cameraState.previousMouseY = event.clientY;
}

/**
 * Handle mouse up event
 */
function onMouseUp() {
  cameraState.isDragging = false;
}

/**
 * Handle mouse wheel event for zooming
 * @param {WheelEvent} event - The wheel event
 */
function onMouseWheel(event) {
  // Adjust distance based on wheel direction
  cameraState.currentDistance += event.deltaY * ORBIT.ZOOM_SPEED * 0.01;

  // Clamp distance between min and max
  cameraState.currentDistance = Math.max(
    ORBIT.MIN_DISTANCE,
    Math.min(ORBIT.MAX_DISTANCE, cameraState.currentDistance)
  );

  // Update spherical radius
  cameraState.spherical.radius = cameraState.currentDistance;

  event.preventDefault();
}

/**
 * Handle touch start event
 * @param {TouchEvent} event - The touch event
 */
function onTouchStart(event) {
  if (event.touches.length === 1) {
    cameraState.isDragging = true;
    cameraState.previousMouseX = event.touches[0].clientX;
    cameraState.previousMouseY = event.touches[0].clientY;
  }
}

/**
 * Handle touch move event
 * @param {TouchEvent} event - The touch event
 */
function onTouchMove(event) {
  if (!cameraState.isDragging || event.touches.length !== 1) return;

  const deltaX = event.touches[0].clientX - cameraState.previousMouseX;
  const deltaY = event.touches[0].clientY - cameraState.previousMouseY;

  // Update spherical coordinates based on touch movement
  cameraState.spherical.phi -= deltaX * ORBIT.ROTATION_SPEED;
  cameraState.spherical.theta = Math.max(
    0.1,
    Math.min(
      Math.PI - 0.1,
      cameraState.spherical.theta + deltaY * ORBIT.ROTATION_SPEED
    )
  );

  cameraState.previousMouseX = event.touches[0].clientX;
  cameraState.previousMouseY = event.touches[0].clientY;

  event.preventDefault();
}

/**
 * Handle touch end event
 */
function onTouchEnd() {
  cameraState.isDragging = false;
}

/**
 * Create an orbit camera controller for a specific target
 * @param {PerspectiveCamera} camera - The camera to control
 * @param {Object3D} target - The target to orbit around
 * @returns {Function} Update function to be called each frame
 */
export function createOrbitController(camera, target) {
  initOrbitControls(camera, target);

  let lastTime = performance.now();

  return function updateController() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    updateOrbitCamera(camera, target, deltaTime);
  };
}

import { createSignal, onCleanup } from "solid-js";
import * as THREE from "three";
import { SHIP } from "../constants/ship";
import { HEIGHT } from "../constants/world";
import { CAMERA } from "../constants/camera";
import { getLevelOrientation } from "../utils/math";
import { navigationStore } from "../stores/navigation";

/**
 * Hook for managing ship controls and movement with smooth turning
 */
export function useShipControls(ship, setShipHeight) {
  const { shipSpeed } = navigationStore;

  // Core state signals
  const [keysPressed, setKeysPressed] = createSignal({});
  const [currentVelocity, setCurrentVelocity] = createSignal(0);
  const [currentVerticalVelocity, setCurrentVerticalVelocity] = createSignal(0);
  const [targetPitch, setTargetPitch] = createSignal(0);
  const [currentPitch, setCurrentPitch] = createSignal(0);
  const [currentTurnRate, setCurrentTurnRate] = createSignal(0);
  const [shipYawRotation, setShipYawRotation] = createSignal(
    new THREE.Quaternion()
  );
  const [resetOrientationInProgress, setResetOrientationInProgress] =
    createSignal(false);
  const [originalOrientation, setOriginalOrientation] = createSignal(
    new THREE.Quaternion()
  );
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  // Mobile controls state
  const [mobileMovementX, setMobileMovementX] = createSignal(0);
  const [mobileMovementY, setMobileMovementY] = createSignal(0);
  const [mobileAltitudeChange, setMobileAltitudeChange] = createSignal(0);

  // Control keys that should prevent default browser behavior
  const CONTROL_KEYS = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ShiftLeft",
    "ShiftRight",
    "ControlLeft",
    "ControlRight",
  ];

  // Event handlers
  const handleKeyDown = (e) => {
    if (CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();

      // Prevent browser shortcuts with modifiers
      if (
        (e.ctrlKey || e.metaKey) &&
        ["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)
      ) {
        e.stopPropagation();
        return false;
      }
    }

    setKeysPressed((prev) => ({ ...prev, [e.code]: true }));
  };

  const handleKeyUp = (e) => {
    if (CONTROL_KEYS.includes(e.code)) {
      e.preventDefault();
    }

    setKeysPressed((prev) => ({ ...prev, [e.code]: false }));
  };

  const preventBrowserShortcuts = (e) => {
    if (e.type === "contextmenu") {
      e.preventDefault();
    }
  };

  const updateFullscreenState = () => {
    setIsFullscreen(
      document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );
  };

  // Set up all event listeners immediately
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  document.addEventListener("keydown", preventBrowserShortcuts, true);
  document.addEventListener("keyup", preventBrowserShortcuts, true);
  document.addEventListener("contextmenu", preventBrowserShortcuts);
  document.addEventListener("fullscreenchange", updateFullscreenState);
  document.addEventListener("webkitfullscreenchange", updateFullscreenState);
  document.addEventListener("mozfullscreenchange", updateFullscreenState);
  document.addEventListener("MSFullscreenChange", updateFullscreenState);

  // Clean up all event listeners when component unmounts
  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("keyup", handleKeyUp, true);
    document.removeEventListener("keydown", preventBrowserShortcuts, true);
    document.removeEventListener("keyup", preventBrowserShortcuts, true);
    document.removeEventListener("contextmenu", preventBrowserShortcuts);
    document.removeEventListener("fullscreenchange", updateFullscreenState);
    document.removeEventListener(
      "webkitfullscreenchange",
      updateFullscreenState
    );
    document.removeEventListener("mozfullscreenchange", updateFullscreenState);
    document.removeEventListener("MSFullscreenChange", updateFullscreenState);
  });

  // Mobile control functions
  const setMobileMovement = (x, y) => {
    setMobileMovementX(x);
    setMobileMovementY(y);
  };

  const controlAltitude = (change) => setMobileAltitudeChange(change);

  // Ship update functions
  const updateShipControls = () => {
    const shipObj = typeof ship === "function" ? ship() : ship;
    if (!shipObj || resetOrientationInProgress()) return false;

    const keys = keysPressed();
    const speedMultiplier = shipSpeed();

    // Get directional vectors
    const yawOnlyRotation = shipYawRotation();
    const shipForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(yawOnlyRotation)
      .normalize();

    // Movement processing
    const moveVector = new THREE.Vector3();

    // Forward/backward movement
    updateForwardMovement(keys, shipForward, speedMultiplier, moveVector);

    // Vertical movement
    updateVerticalMovement(keys, shipObj, speedMultiplier, moveVector);

    // Rotation handling
    updateRotation(keys, shipObj, speedMultiplier);

    // Apply position and tilt
    if (!moveVector.equals(new THREE.Vector3(0, 0, 0))) {
      shipObj.position.add(moveVector);
      setShipHeight(shipObj.position.y);
    }

    updateShipTilt(shipObj, speedMultiplier);

    return true;
  };

  // Helper functions to break down updateShipControls
  const updateForwardMovement = (
    keys,
    direction,
    speedMultiplier,
    moveVector
  ) => {
    let velocity = currentVelocity();
    const maxSpeed = SHIP.MAX_SPEED * speedMultiplier;
    const acceleration = SHIP.ACCELERATION * speedMultiplier;
    const deceleration = SHIP.DECELERATION * speedMultiplier;

    const movingForward =
      keys["ArrowUp"] || keys["KeyW"] || mobileMovementY() > 0.2;
    const movingBackward =
      keys["ArrowDown"] || keys["KeyS"] || mobileMovementY() < -0.2;

    if (movingForward) {
      const inputStrength = Math.max(
        keys["ArrowUp"] || keys["KeyW"] ? 1 : 0,
        mobileMovementY() > 0.2 ? mobileMovementY() : 0
      );
      velocity = Math.min(maxSpeed * inputStrength, velocity + acceleration);
    } else if (movingBackward) {
      const inputStrength = Math.max(
        keys["ArrowDown"] || keys["KeyS"] ? 1 : 0,
        mobileMovementY() < -0.2 ? -mobileMovementY() : 0
      );
      velocity = Math.max(-maxSpeed * inputStrength, velocity - acceleration);
    } else {
      // Apply deceleration
      velocity =
        Math.abs(velocity) < deceleration
          ? 0
          : velocity > 0
            ? velocity - deceleration
            : velocity + deceleration;
    }

    setCurrentVelocity(velocity);

    if (velocity !== 0) {
      moveVector.add(direction.clone().multiplyScalar(velocity));
    }
  };

  const updateVerticalMovement = (
    keys,
    shipObj,
    speedMultiplier,
    moveVector
  ) => {
    let verticalVelocity = currentVerticalVelocity();
    const verticalMaxSpeed = SHIP.VERTICAL_MAX_SPEED * speedMultiplier;
    const verticalAcceleration = SHIP.VERTICAL_ACCELERATION * speedMultiplier;
    const verticalDeceleration = SHIP.VERTICAL_DECELERATION * speedMultiplier;

    const movingUp =
      (keys["Space"] || mobileAltitudeChange() > 0) &&
      shipObj.position.y < HEIGHT.MAX;
    const movingDown =
      (keys["ShiftLeft"] || keys["ShiftRight"] || mobileAltitudeChange() < 0) &&
      shipObj.position.y > HEIGHT.MIN;

    if (movingUp) {
      verticalVelocity = Math.min(
        verticalMaxSpeed,
        verticalVelocity + verticalAcceleration
      );
      setTargetPitch(
        currentVelocity() > 0
          ? SHIP.TILT_AMOUNT
          : currentVelocity() < 0
            ? -SHIP.TILT_AMOUNT
            : 0
      );
    } else if (movingDown) {
      verticalVelocity = Math.max(
        -verticalMaxSpeed,
        verticalVelocity - verticalAcceleration
      );
      setTargetPitch(
        currentVelocity() > 0
          ? -SHIP.TILT_AMOUNT
          : currentVelocity() < 0
            ? SHIP.TILT_AMOUNT
            : 0
      );
    } else {
      verticalVelocity =
        Math.abs(verticalVelocity) < verticalDeceleration
          ? 0
          : verticalVelocity > 0
            ? verticalVelocity - verticalDeceleration
            : verticalVelocity + verticalDeceleration;
      setTargetPitch(0);
    }

    // Enforce height limits
    if (
      (shipObj.position.y >= HEIGHT.MAX && verticalVelocity > 0) ||
      (shipObj.position.y <= HEIGHT.MIN && verticalVelocity < 0)
    ) {
      verticalVelocity = 0;
    }

    setCurrentVerticalVelocity(verticalVelocity);

    if (verticalVelocity !== 0) {
      const nextHeight = shipObj.position.y + verticalVelocity;
      moveVector.y =
        nextHeight > HEIGHT.MAX
          ? HEIGHT.MAX - shipObj.position.y
          : nextHeight < HEIGHT.MIN
            ? HEIGHT.MIN - shipObj.position.y
            : verticalVelocity;
    }
  };

  const updateRotation = (keys, shipObj, speedMultiplier) => {
    const turnAcceleration = 0.0025 * speedMultiplier;
    const maxTurnRate = SHIP.ROTATION_SPEED * speedMultiplier;
    const turnDeceleration = 0.0025 * speedMultiplier;
    let turnRate = currentTurnRate();

    const turningLeft =
      keys["ArrowLeft"] || keys["KeyA"] || mobileMovementX() < -0.2;
    const turningRight =
      keys["ArrowRight"] || keys["KeyD"] || mobileMovementX() > 0.2;

    if (turningLeft) {
      const inputStrength = Math.max(
        keys["ArrowLeft"] || keys["KeyA"] ? 1 : 0,
        mobileMovementX() < -0.2 ? -mobileMovementX() : 0
      );
      turnRate = Math.min(
        maxTurnRate * inputStrength,
        turnRate + turnAcceleration
      );
    } else if (turningRight) {
      const inputStrength = Math.max(
        keys["ArrowRight"] || keys["KeyD"] ? 1 : 0,
        mobileMovementX() > 0.2 ? mobileMovementX() : 0
      );
      turnRate = Math.max(
        -maxTurnRate * inputStrength,
        turnRate - turnAcceleration
      );
    } else {
      turnRate =
        Math.abs(turnRate) < turnDeceleration
          ? 0
          : turnRate > 0
            ? turnRate - turnDeceleration
            : turnRate + turnDeceleration;
    }

    setCurrentTurnRate(turnRate);

    if (turnRate !== 0) {
      const rotationY = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        turnRate
      );
      shipObj.quaternion.premultiply(rotationY);
      setShipYawRotation(shipYawRotation().clone().premultiply(rotationY));
    }
  };

  const updateShipTilt = (shipObj, speedMultiplier) => {
    const tiltSpeed = SHIP.TILT_SPEED * speedMultiplier;
    const newPitch =
      currentPitch() + (targetPitch() - currentPitch()) * tiltSpeed;
    setCurrentPitch(newPitch);

    const euler = new THREE.Euler().setFromQuaternion(shipYawRotation(), "YXZ");
    shipObj.quaternion.copy(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(newPitch, euler.y, 0, "YXZ")
      )
    );
  };

  const updateCamera = (camera) => {
    const shipObj = typeof ship === "function" ? ship() : ship;
    if (!shipObj || !camera) return;

    const useRotation = resetOrientationInProgress()
      ? shipObj.quaternion
      : shipYawRotation();
    const shipForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(useRotation)
      .normalize();
    const shipUp = new THREE.Vector3(0, 1, 0);

    camera.position.copy(
      shipObj.position
        .clone()
        .add(shipForward.clone().multiplyScalar(-CAMERA.DISTANCE))
        .add(shipUp.clone().multiplyScalar(CAMERA.HEIGHT))
    );

    camera.lookAt(
      shipObj.position
        .clone()
        .add(shipForward.clone().multiplyScalar(CAMERA.LOOK_AHEAD))
    );
  };

  const startOrientationReset = () => {
    const shipObj = typeof ship === "function" ? ship() : ship;
    if (!shipObj) return;

    setResetOrientationInProgress(true);
    setOriginalOrientation(shipObj.quaternion.clone());
    setCurrentTurnRate(0);
  };

  const updateOrientationReset = () => {
    const shipObj = typeof ship === "function" ? ship() : ship;
    if (!resetOrientationInProgress() || !shipObj) return false;

    const levelOrientation = getLevelOrientation(shipObj.quaternion);
    shipObj.quaternion.slerp(levelOrientation, SHIP.ORIENTATION_RESET_SPEED);
    setShipYawRotation(levelOrientation.clone());

    if (shipObj.quaternion.angleTo(levelOrientation) < 0.01) {
      setResetOrientationInProgress(false);
      shipObj.quaternion.copy(levelOrientation);
      setShipYawRotation(levelOrientation.clone());
      setCurrentPitch(0);
      setTargetPitch(0);
    }

    return true;
  };

  // Return public API
  return {
    keysPressed,
    shipYawRotation,
    resetOrientationInProgress,
    isFullscreen,
    updateShipControls,
    updateOrientationReset,
    updateCamera,
    startOrientationReset,
    setMobileMovement,
    increaseAltitude: () => controlAltitude(1),
    decreaseAltitude: () => controlAltitude(-1),
    stopAltitudeChange: () => controlAltitude(0),
  };
}

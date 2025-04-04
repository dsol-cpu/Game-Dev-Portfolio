import { createSignal, onCleanup } from "solid-js";
import * as THREE from "three";
import { SHIP } from "../constants/ship";
import { HEIGHT } from "../constants/world";
import { CAMERA } from "../constants/camera";
import { getLevelOrientation } from "../utils/math";
import { navigationStore } from "../stores/navigationStore";

/**
 * Hook for managing ship controls and movement with smooth turning
 */
export function useShipControls(ship, setShipHeight) {
  const { shipSpeed } = navigationStore; // Import shipSpeed from navigationStore
  const [keysPressed, setKeysPressed] = createSignal({});
  const [currentVelocity, setCurrentVelocity] = createSignal(0);
  const [currentVerticalVelocity, setCurrentVerticalVelocity] = createSignal(0);
  const [targetPitch, setTargetPitch] = createSignal(0);
  const [currentPitch, setCurrentPitch] = createSignal(0);
  const [currentTurnRate, setCurrentTurnRate] = createSignal(0); // New: current turning rate
  const [shipYawRotation, setShipYawRotation] = createSignal(
    new THREE.Quaternion()
  );
  const [resetOrientationInProgress, setResetOrientationInProgress] =
    createSignal(false);
  const [originalOrientation, setOriginalOrientation] = createSignal(
    new THREE.Quaternion()
  );

  // Mobile controls state
  const [mobileMovementX, setMobileMovementX] = createSignal(0); // -1 to 1, left to right
  const [mobileMovementY, setMobileMovementY] = createSignal(0); // -1 to 1, forward to backward
  const [mobileAltitudeChange, setMobileAltitudeChange] = createSignal(0); // -1, 0, or 1

  // Setup keyboard controls
  const setupControls = () => {
    const handleKeyDown = (e) => {
      const newKeys = { ...keysPressed() };
      newKeys[e.code] = true;
      setKeysPressed(newKeys);

      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "ControlLeft",
          "ControlRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      const newKeys = { ...keysPressed() };
      newKeys[e.code] = false;
      setKeysPressed(newKeys);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    });
  };

  // Reset ship orientation
  const startOrientationReset = () => {
    if (!ship()) return;
    setResetOrientationInProgress(true);
    setOriginalOrientation(ship().quaternion.clone());
    setCurrentTurnRate(0); // Reset turn rate when resetting orientation
  };

  // Update ship orientation reset
  const updateOrientationReset = () => {
    if (!resetOrientationInProgress() || !ship()) return;

    // Create a level orientation that preserves yaw
    const levelOrientation = getLevelOrientation(ship().quaternion);

    // Interpolate toward level orientation
    ship().quaternion.slerp(levelOrientation, SHIP.ORIENTATION_RESET_SPEED);
    setShipYawRotation(levelOrientation.clone());

    // Check if we're close enough to consider reset complete
    if (ship().quaternion.angleTo(levelOrientation) < 0.01) {
      setResetOrientationInProgress(false);
      ship().quaternion.copy(levelOrientation);
      setShipYawRotation(levelOrientation.clone());
      setCurrentPitch(0);
      setTargetPitch(0);
    }

    return true; // Orientation reset was processed
  };

  // Set mobile movement values (from joystick)
  const setMobileMovement = (x, y) => {
    setMobileMovementX(x);
    setMobileMovementY(y);
  };

  // Altitude control functions for mobile
  const increaseAltitude = () => {
    setMobileAltitudeChange(1);
  };

  const decreaseAltitude = () => {
    setMobileAltitudeChange(-1);
  };

  const stopAltitudeChange = () => {
    setMobileAltitudeChange(0);
  };

  // Ship controls update
  const updateShipControls = () => {
    if (!ship() || resetOrientationInProgress()) return false;
    const keys = keysPressed();

    // Get current speed multiplier from navigationStore
    const speedMultiplier = shipSpeed();

    // Get the ship's directional vectors based on yaw-only rotation
    const yawOnlyRotation = shipYawRotation();
    const shipForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(yawOnlyRotation)
      .normalize();

    // Process forward/backward movement with speed multiplier
    let velocity = currentVelocity();
    const maxSpeed = SHIP.MAX_SPEED * speedMultiplier;
    const acceleration = SHIP.ACCELERATION * speedMultiplier;
    const deceleration = SHIP.DECELERATION * speedMultiplier;

    // Combine keyboard and mobile inputs for movement
    const movingForward = keys["ArrowUp"] || mobileMovementY() > 0.2;
    const movingBackward = keys["ArrowDown"] || mobileMovementY() < -0.2;

    if (movingForward) {
      // Use the stronger of the two inputs
      const inputStrength = Math.max(
        keys["ArrowUp"] ? 1 : 0,
        mobileMovementY() > 0.2 ? mobileMovementY() : 0
      );
      velocity = Math.min(maxSpeed * inputStrength, velocity + acceleration);
    } else if (movingBackward) {
      // Use the stronger of the two inputs
      const inputStrength = Math.max(
        keys["ArrowDown"] ? 1 : 0,
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

    // Process vertical movement with speed multiplier
    let verticalVelocity = currentVerticalVelocity();
    let targetP = targetPitch();

    const verticalMaxSpeed = SHIP.VERTICAL_MAX_SPEED * speedMultiplier;
    const verticalAcceleration = SHIP.VERTICAL_ACCELERATION * speedMultiplier;
    const verticalDeceleration = SHIP.VERTICAL_DECELERATION * speedMultiplier;

    // Combine keyboard and mobile inputs for vertical movement
    const movingUp =
      (keys["Space"] || mobileAltitudeChange() > 0) &&
      ship().position.y < HEIGHT.MAX;
    const movingDown =
      (keys["ControlLeft"] ||
        keys["ControlRight"] ||
        mobileAltitudeChange() < 0) &&
      ship().position.y > HEIGHT.MIN;

    if (movingUp) {
      verticalVelocity = Math.min(
        verticalMaxSpeed,
        verticalVelocity + verticalAcceleration
      );

      // Apply tilt based on movement direction
      targetP =
        velocity > 0 ? SHIP.TILT_AMOUNT : velocity < 0 ? -SHIP.TILT_AMOUNT : 0;
    } else if (movingDown) {
      verticalVelocity = Math.max(
        -verticalMaxSpeed,
        verticalVelocity - verticalAcceleration
      );

      // Apply tilt based on movement direction
      targetP =
        velocity > 0 ? -SHIP.TILT_AMOUNT : velocity < 0 ? SHIP.TILT_AMOUNT : 0;
    } else {
      // Apply vertical deceleration
      verticalVelocity =
        Math.abs(verticalVelocity) < verticalDeceleration
          ? 0
          : verticalVelocity > 0
            ? verticalVelocity - verticalDeceleration
            : verticalVelocity + verticalDeceleration;
      targetP = 0;
    }

    setCurrentVerticalVelocity(verticalVelocity);
    setTargetPitch(targetP);

    // Enforce height limits
    if (
      (ship().position.y >= HEIGHT.MAX && verticalVelocity > 0) ||
      (ship().position.y <= HEIGHT.MIN && verticalVelocity < 0)
    ) {
      setCurrentVerticalVelocity(0);
      verticalVelocity = 0;
    }

    // Handle rotation with smooth turning - apply speed multiplier
    const turnAcceleration = 0.0025 * speedMultiplier;
    const maxTurnRate = SHIP.ROTATION_SPEED * speedMultiplier;
    const turnDeceleration = 0.0025 * speedMultiplier;

    let turnRate = currentTurnRate();

    // Combine keyboard and mobile inputs for turning
    const turningLeft = keys["ArrowLeft"] || mobileMovementX() < -0.2;
    const turningRight = keys["ArrowRight"] || mobileMovementX() > 0.2;

    if (turningLeft) {
      // Use the stronger of the two inputs for left turn
      const inputStrength = Math.max(
        keys["ArrowLeft"] ? 1 : 0,
        mobileMovementX() < -0.2 ? -mobileMovementX() : 0
      );
      turnRate = Math.min(
        maxTurnRate * inputStrength,
        turnRate + turnAcceleration
      );
    } else if (turningRight) {
      // Use the stronger of the two inputs for right turn
      const inputStrength = Math.max(
        keys["ArrowRight"] ? 1 : 0,
        mobileMovementX() > 0.2 ? mobileMovementX() : 0
      );
      turnRate = Math.max(
        -maxTurnRate * inputStrength,
        turnRate - turnAcceleration
      );
    } else {
      // Decelerate turning when no keys pressed
      if (Math.abs(turnRate) < turnDeceleration) {
        turnRate = 0;
      } else if (turnRate > 0) {
        turnRate -= turnDeceleration;
      } else {
        turnRate += turnDeceleration;
      }
    }

    setCurrentTurnRate(turnRate);

    // Apply the turn if there's any turn rate
    if (turnRate !== 0) {
      const rotationY = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        turnRate
      );
      ship().quaternion.premultiply(rotationY);
      const newYawRotation = shipYawRotation().clone().premultiply(rotationY);
      setShipYawRotation(newYawRotation);
    }

    // Calculate and apply movement
    const moveVector = new THREE.Vector3();

    // Forward/backward movement
    if (velocity !== 0) {
      moveVector.add(shipForward.clone().multiplyScalar(velocity));
    }

    // Vertical movement with limits
    if (verticalVelocity !== 0) {
      const nextHeight = ship().position.y + verticalVelocity;
      if (nextHeight > HEIGHT.MAX) {
        moveVector.y = HEIGHT.MAX - ship().position.y;
      } else if (nextHeight < HEIGHT.MIN) {
        moveVector.y = HEIGHT.MIN - ship().position.y;
      } else {
        moveVector.y = verticalVelocity;
      }
    }

    // Apply movement
    ship().position.add(moveVector);
    setShipHeight(ship().position.y);

    // Smooth pitch updates with speed consideration
    const tiltSpeed = SHIP.TILT_SPEED * speedMultiplier;
    const newPitch = currentPitch() + (targetP - currentPitch()) * tiltSpeed;
    setCurrentPitch(newPitch);

    // Apply pitch while preserving yaw
    const euler = new THREE.Euler().setFromQuaternion(shipYawRotation(), "YXZ");
    const newRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(newPitch, euler.y, 0, "YXZ")
    );
    ship().quaternion.copy(newRotation);

    return true; // Controls were processed
  };

  // Update camera to follow ship
  const updateCamera = (camera) => {
    if (!ship() || !camera) return;

    // Use navigation quaternion if resetting orientation, otherwise use stored yaw
    const useRotation = resetOrientationInProgress()
      ? ship().quaternion
      : shipYawRotation();
    const shipForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(useRotation)
      .normalize();
    const shipUp = new THREE.Vector3(0, 1, 0);

    // Position camera behind and above ship
    const cameraPos = ship()
      .position.clone()
      .add(shipForward.clone().multiplyScalar(-CAMERA.DISTANCE))
      .add(shipUp.clone().multiplyScalar(CAMERA.HEIGHT));
    camera.position.copy(cameraPos);

    // Look ahead of ship
    const lookAtPos = ship()
      .position.clone()
      .add(shipForward.clone().multiplyScalar(CAMERA.LOOK_AHEAD));
    camera.lookAt(lookAtPos);
  };

  return {
    keysPressed,
    setKeysPressed,
    shipYawRotation,
    resetOrientationInProgress,
    setupControls,
    updateShipControls,
    updateOrientationReset,
    updateCamera,
    startOrientationReset,
    // Mobile control functions
    setMobileMovement,
    increaseAltitude,
    decreaseAltitude,
    stopAltitudeChange,
  };
}

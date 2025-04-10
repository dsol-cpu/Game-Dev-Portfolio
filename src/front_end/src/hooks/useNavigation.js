import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import * as THREE from "three";
import { NAVIGATION, ISLAND_DATA } from "../constants/world";
import { createNavigationPath } from "../utils/math";
import { navigationStore } from "../stores/navigation";

/**
 * Hook for managing ship navigation between islands
 */
export function useNavigation(shipFn, setShipHeight, shipControlsHook) {
  // Use the shared navigation store
  const {
    targetIsland,
    setTargetIsland,
    setIsNavigating,
    isArrived,
    setIsArrived,
    destinationSection,
    setDestinationSection,
    isNavigating,
    navigationProgress,
    setNavigationProgress,
    navigatingSection,
    setNavigatingSection,
    shipSpeed,
    setShipSpeed,
  } = navigationStore;

  const [currentPath, setCurrentPath] = createSignal(null);
  const [pathProgress, setPathProgress] = createSignal(0);
  const [targetPosition, setTargetPosition] = createSignal(null);
  const [currentPosition, setCurrentPosition] = createSignal(null);
  const [isNavigationInProgress, setIsNavigationInProgress] =
    createSignal(false);

  // Start navigation to an island
  const startNavigation = (islandIndex) => {
    // Prevent multiple navigation attempts
    if (isNavigationInProgress()) return;

    const ship = shipFn(); // Get the actual ship object
    if (!ship || islandIndex >= ISLAND_DATA.length) return;

    // If ship is already at the destination, don't start navigation
    if (
      isArrived() &&
      destinationSection() === ISLAND_DATA[islandIndex].section
    ) {
      return;
    }

    setIsNavigationInProgress(true);

    // Store exact target position from island data
    const exactPosition = ISLAND_DATA[islandIndex].position.clone();
    exactPosition.y += 5;
    setTargetPosition(exactPosition);

    // Store current position for movement tracking
    setCurrentPosition(ship.position.clone());

    // Reset arrived state when starting navigation
    setIsArrived(false);

    // Create navigation path from current position to target
    const path = createNavigationPath(
      ship.position.clone(),
      exactPosition,
      NAVIGATION.HEIGHT
    );

    setCurrentPath(path);
    setPathProgress(0);
    setIsNavigating(true);
    setNavigationProgress(0);
    setDestinationSection(ISLAND_DATA[islandIndex].section);
    setNavigatingSection(ISLAND_DATA[islandIndex].section);

    // Reset controls state to prevent continued movement
    if (
      shipControlsHook &&
      typeof shipControlsHook.setKeysPressed === "function"
    ) {
      shipControlsHook.setKeysPressed({});
    }
  };

  // Create an effect to start navigation when targetIsland changes
  createEffect(() => {
    const islandIndex = targetIsland();
    if (islandIndex !== null && islandIndex !== undefined) {
      startNavigation(islandIndex);
    }
  });

  // Expose navigation instance to window for direct access
  onMount(() => {
    window.shipNavigationInstance = { startNavigation };
    onCleanup(() => {
      window.shipNavigationInstance = null;
    });
  });

  // Update ship position along navigation path
  const updateNavigation = () => {
    const ship = shipFn(); // Get the actual ship object
    if (!isNavigating() || !currentPath() || !ship) return false;

    const path = currentPath();
    let progress = pathProgress() + shipSpeed() / 100;

    if (progress >= 1) {
      // Navigation complete - set ship to exact target position
      setIsArrived(true);

      const exactTarget = targetPosition();
      if (exactTarget) {
        // Place the ship exactly at the target island's position
        ship.position.copy(exactTarget);
        setShipHeight(exactTarget.y);
      }

      // Keep a reference to the destination section
      const section = destinationSection();

      // Set navigation progress to 100% before marking navigation as complete
      setPathProgress(1);
      setNavigationProgress(100);

      // Mark navigation as complete
      setIsNavigating(false);
      setTargetIsland(null);
      setTargetPosition(null);
      setIsNavigationInProgress(false);

      // Smoothly reset ship orientation
      if (
        shipControlsHook &&
        typeof shipControlsHook.startOrientationReset === "function"
      ) {
        shipControlsHook.startOrientationReset();
      }

      // Update DOM content if needed
      if (section) {
        const element = document.getElementById(section);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      setCurrentPath(null);
      return true;
    }

    // Update ship position along path
    const newPosition = path.getPoint(progress);
    ship.position.copy(newPosition);

    // Get path tangent to determine direction
    const tangent = path.getTangent(progress);
    if (tangent.length() > 0) {
      const up = new THREE.Vector3(0, 1, 0);
      const lookAt = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        tangent,
        up
      );

      const targetRotation = new THREE.Quaternion().setFromRotationMatrix(
        lookAt
      );
      ship.quaternion.slerp(targetRotation, 0.1);

      // Update yaw rotation if available
      if (
        shipControlsHook &&
        typeof shipControlsHook.shipYawRotation === "function"
      ) {
        shipControlsHook.shipYawRotation().slerp(targetRotation, 0.1);
      } else if (shipControlsHook && shipControlsHook.shipYawRotation) {
        shipControlsHook.shipYawRotation.slerp(targetRotation, 0.1);
      }
    }

    setPathProgress(progress);
    setNavigationProgress(progress * 100);
    setShipHeight(ship.position.y);

    return true; // Navigation was processed
  };

  return {
    isNavigating,
    targetIsland,
    destinationSection,
    isArrived,
    navigationProgress: navigationStore.navigationProgress,
    setTargetIsland,
    setIsNavigating,
    setIsArrived,
    startNavigation,
    updateNavigation,
  };
}

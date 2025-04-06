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

  // Start navigation to an island
  const startNavigation = (islandIndex) => {
    const ship = shipFn(); // Get the actual ship object
    if (!ship || islandIndex >= ISLAND_DATA.length) return;

    const targetPosition = ISLAND_DATA[islandIndex].position.clone();
    targetPosition.y += 5; // Hover above the island

    // Create navigation path
    const path = createNavigationPath(
      ship.position.clone(),
      targetPosition,
      NAVIGATION.HEIGHT
    );

    setCurrentPath(path);
    setPathProgress(0);
    setIsNavigating(true);
    setNavigationProgress(0);
    setDestinationSection(ISLAND_DATA[islandIndex].section);

    // Set the section that's being navigated to
    setNavigatingSection(ISLAND_DATA[islandIndex].section);

    // Reset controls state to prevent continued movement
    // Access setKeysPressed safely, checking its existence first
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
    // Create a global reference to this navigation instance
    window.shipNavigationInstance = {
      startNavigation,
    };

    // Cleanup when component unmounts
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
      // Navigation complete
      progress = 1;

      // Keep a reference to the destination section
      const section = destinationSection();

      // Set navigation progress to 100% before marking navigation as complete
      setPathProgress(progress);
      setNavigationProgress(100);

      // Mark navigation as complete
      setIsNavigating(false);
      setTargetIsland(null);

      // We'll keep the navigating section set until the effect in the sidebar
      // can see both the navigation completed and the destination section
      // This allows the sidebar to properly update the active section

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

    // Update ship position and orientation along path
    const newPosition = path.getPoint(progress);
    ship.position.copy(newPosition);

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

      // Access shipYawRotation safely
      if (
        shipControlsHook &&
        typeof shipControlsHook.shipYawRotation === "function"
      ) {
        shipControlsHook.shipYawRotation().slerp(targetRotation, 0.1);
      } else if (shipControlsHook && shipControlsHook.shipYawRotation) {
        // It might be a signal/value instead of a function
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
    navigationProgress: navigationStore.navigationProgress,
    setTargetIsland,
    setIsNavigating,
    startNavigation,
    updateNavigation,
  };
}

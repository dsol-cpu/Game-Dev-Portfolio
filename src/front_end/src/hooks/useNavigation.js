import { createSignal } from "solid-js";
import * as THREE from "three";
import { NAVIGATION, ISLAND_DATA } from "../constants/world";
import { createNavigationPath } from "../utils/math";
import { navigationStore } from "../stores/navigationStore"; // Import from the correct path

/**
 * Hook for managing ship navigation between islands
 */
export function useNavigation(ship, setShipHeight, shipControlsHook) {
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
    if (!ship() || islandIndex >= ISLAND_DATA.length) return;

    const targetPosition = ISLAND_DATA[islandIndex].position.clone();
    targetPosition.y += 5; // Hover above the island

    // Create navigation path
    const path = createNavigationPath(
      ship().position.clone(),
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
    shipControlsHook.setKeysPressed({});
  };

  // Update ship position along navigation path
  const updateNavigation = () => {
    if (!isNavigating() || !currentPath() || !ship()) return false;

    const path = currentPath();
    let progress = pathProgress() + shipSpeed() / 100;

    if (progress >= 1) {
      // Navigation complete
      progress = 1;
      setIsNavigating(false);
      setTargetIsland(null);
      setNavigatingSection(null); // Reset the navigating section when complete

      // Smoothly reset ship orientation
      shipControlsHook.startOrientationReset();

      // Update DOM content
      const section = destinationSection();
      if (section) {
        const element = document.getElementById(section);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      setCurrentPath(null);
      setPathProgress(progress);
      setNavigationProgress(progress * 100);
      return true;
    }

    // Update ship position and orientation along path
    const newPosition = path.getPoint(progress);
    ship().position.copy(newPosition);

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
      ship().quaternion.slerp(targetRotation, 0.1);
      shipControlsHook.shipYawRotation().slerp(targetRotation, 0.1);
    }

    setPathProgress(progress);
    setNavigationProgress(progress * 100);
    setShipHeight(ship().position.y);

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

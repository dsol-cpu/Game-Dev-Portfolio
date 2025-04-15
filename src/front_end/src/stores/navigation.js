import { createSignal } from "solid-js";

export const createNavigationStore = () => {
  const [targetIsland, setTargetIsland] = createSignal(null);
  const [isNavigating, setIsNavigating] = createSignal(false);
  const [isArrived, setIsArrived] = createSignal(false);
  const [destinationSection, setDestinationSection] = createSignal("home");
  const [navigationProgress, setNavigationProgress] = createSignal(0);
  const [navigatingSection, setNavigatingSection] = createSignal(null);
  const [shipSpeed, setShipSpeed] = createSignal(1.0);

  // Helper function to start navigation
  const startNavigation = (sectionId, islandIndex) => {
    setNavigatingSection(sectionId);
    setDestinationSection(sectionId);
    setTargetIsland(islandIndex);
    setIsArrived(false);
    setIsNavigating(true);
    setNavigationProgress(0);

    // Trigger ship navigation if available
    if (window.shipNavigationInstance?.startNavigation) {
      window.shipNavigationInstance.startNavigation(islandIndex);
    }
  };

  // Helper function to complete navigation
  const completeNavigation = () => {
    setIsNavigating(false);
    setIsArrived(true);
    setNavigationProgress(1);
  };

  return {
    // State
    targetIsland,
    setTargetIsland,
    isNavigating,
    setIsNavigating,
    isArrived,
    setIsArrived,
    destinationSection,
    setDestinationSection,
    navigationProgress,
    setNavigationProgress,
    navigatingSection,
    setNavigatingSection,
    shipSpeed,
    setShipSpeed,

    // Actions
    startNavigation,
    completeNavigation,
  };
};

// Create a singleton instance of the navigation store
const navigationStore = createNavigationStore();
export { navigationStore };

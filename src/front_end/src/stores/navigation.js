import { createSignal } from "solid-js";

export const createNavigationStore = () => {
  const [targetIsland, setTargetIsland] = createSignal(null);
  const [isNavigating, setIsNavigating] = createSignal(false);
  const [isArrived, setIsArrived] = createSignal({});
  const [destinationSection, setDestinationSection] = createSignal("home");
  const [navigationProgress, setNavigationProgress] = createSignal(0);
  const [navigatingSection, setNavigatingSection] = createSignal(null);
  const [shipSpeed, setShipSpeed] = createSignal(1.0); // Default speed (1x)

  return {
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
  };
};

// Create a singleton instance of the navigation store
const navigationStore = createNavigationStore();
export { navigationStore };

import { createEffect, onMount } from "solid-js";
import { navigationStore } from "../stores/navigationStore";
import { useThreeScene } from "../hooks/useThreeScene";
import { useShipControls } from "../hooks/useShipControls";
import { useNavigation } from "../hooks/useNavigation";
import AltitudePanel from "./UI/AltitudePanel";
import SpeedControls from "./UI/SpeedControls";

const ThreeScene = () => {
  let containerRef;

  // Initialize hooks
  const threeScene = useThreeScene(() => containerRef);
  const shipControls = useShipControls(
    threeScene.ship,
    threeScene.setShipHeight
  );
  const navigation = useNavigation(
    threeScene.ship,
    threeScene.setShipHeight,
    shipControls
  );

  // Connect with the navigation store
  const {
    targetIsland,
    setTargetIsland,
    isNavigating,
    setIsNavigating,
    destinationSection,
  } = navigationStore;

  // Effect to handle navigation requests
  createEffect(() => {
    const target = targetIsland();
    if (
      target !== null &&
      threeScene.ship() &&
      threeScene.islands().length > 0
    ) {
      navigation.startNavigation(target);
    }
  });

  // Update function for animation loop
  const update = () => {
    // Check if we're currently navigating
    if (navigation.isNavigating()) {
      navigation.updateNavigation();
    }
    // Check if we're resetting orientation
    else if (shipControls.resetOrientationInProgress()) {
      shipControls.updateOrientationReset();
    }
    // Otherwise process normal controls
    else {
      shipControls.updateShipControls();
    }

    // Update camera to follow ship
    if (threeScene.camera() && threeScene.ship()) {
      shipControls.updateCamera(threeScene.camera());
    }
  };

  onMount(() => {
    // Initialize scene and set up controls
    const cleanup = threeScene.initScene();
    shipControls.setupControls();

    // Start animation loop with our update function
    threeScene.startAnimation([update]);

    return cleanup;
  });

  return (
    <div class="relative w-full h-full">
      <div ref={containerRef} class="w-full h-full" />
      <AltitudePanel shipHeight={threeScene.shipHeight()} />
      <SpeedControls />
    </div>
  );
};

export default ThreeScene;

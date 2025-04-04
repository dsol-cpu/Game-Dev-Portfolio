import { createEffect, onMount, createSignal } from "solid-js";
import { navigationStore } from "../stores/navigationStore";
import { useThreeScene } from "../hooks/useThreeScene";
import { useShipControls } from "../hooks/useShipControls";
import { useNavigation } from "../hooks/useNavigation";
import AltitudePanel from "./UI/AltitudePanel";
import SpeedControls from "./UI/SpeedControls";
import MobileControls from "./UI/MobileControls";
import ControlsInfo from "./UI/ControlsInfo";

const ThreeScene = () => {
  let containerRef;
  // Add resolution state to track screen size changes
  const [resolution, setResolution] = createSignal({ width: 0, height: 0 });

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

  // Effect to handle resize events
  createEffect(() => {
    const handleResize = () => {
      if (threeScene.renderer() && threeScene.camera()) {
        // Update renderer size
        const container = containerRef;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Update resolution state to trigger rerender
        setResolution({ width, height });

        threeScene.renderer().setSize(width, height);

        // Update camera aspect ratio
        threeScene.camera().aspect = width / height;
        threeScene.camera().updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", handleResize);
    // Also listen for sidebar toggle events which might change available space
    window.addEventListener("sidebarToggle", handleResize);

    // Initial resize
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("sidebarToggle", handleResize);
    };
  });

  // Mobile controls handlers
  const handleMobileMove = (x, y) => {
    if (shipControls && !navigation.isNavigating()) {
      shipControls.setMobileMovement(x, y);
    }
  };

  const handleAltitudeUp = () => {
    if (shipControls && !navigation.isNavigating()) {
      shipControls.increaseAltitude();
    }
  };

  const handleAltitudeDown = () => {
    if (shipControls && !navigation.isNavigating()) {
      shipControls.decreaseAltitude();
    }
  };

  const handleAltitudeStop = () => {
    if (shipControls && !navigation.isNavigating()) {
      shipControls.stopAltitudeChange();
    }
  };

  const handleOrientationReset = () => {
    if (shipControls && !navigation.isNavigating()) {
      shipControls.startOrientationReset();
    }
  };

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

    // Initial sizing
    if (threeScene.renderer() && containerRef) {
      const width = containerRef.clientWidth;
      const height = containerRef.clientHeight;

      // Set initial resolution
      setResolution({ width, height });

      threeScene.renderer().setSize(width, height);
      if (threeScene.camera()) {
        threeScene.camera().aspect = width / height;
        threeScene.camera().updateProjectionMatrix();
      }
    }

    return cleanup;
  });

  return (
    <div class="relative h-screen overflow-hidden">
      {/* Use resolution in JSX to make component reactive to resolution changes */}
      <div
        ref={containerRef}
        class="w-full h-full absolute inset-0"
        data-width={resolution().width}
        data-height={resolution().height}
      />
      <AltitudePanel shipHeight={threeScene.shipHeight()} />
      <SpeedControls />
      <ControlsInfo />
      <MobileControls
        onMove={handleMobileMove}
        onAltitudeUp={handleAltitudeUp}
        onAltitudeDown={handleAltitudeDown}
        onAltitudeStop={handleAltitudeStop}
        onOrientationReset={handleOrientationReset}
      />
    </div>
  );
};

export default ThreeScene;

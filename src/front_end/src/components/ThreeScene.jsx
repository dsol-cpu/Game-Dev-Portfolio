import { createEffect, onMount, createSignal, onCleanup } from "solid-js";
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
  // Add state for tracking if game is active
  const [isGameActive, setIsGameActive] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(
    document.fullscreenElement !== null
  );
  const checkFullscreen = () => setIsFullscreen(!!document.fullscreenElement);

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

  // Add fullscreen toggle function
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Additional browser shortcut prevention
  const setupBrowserShortcutPrevention = () => {
    // This function adds additional protections to prevent browser shortcuts

    // Add a beforeunload handler to prevent accidental tab closure
    const beforeUnloadHandler = (e) => {
      if (isGameActive()) {
        // Only prevent when game is active
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    // More aggressive key handler that runs at the document level
    const aggressiveKeyHandler = (e) => {
      if (!isGameActive()) return;

      // Detect Ctrl+W, Ctrl+S combinations
      if (
        (e.ctrlKey || e.metaKey) &&
        ["KeyW", "KeyS", "KeyA", "KeyD"].includes(e.code)
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    document.addEventListener("keydown", aggressiveKeyHandler, true);
    document.addEventListener("keyup", aggressiveKeyHandler, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      document.removeEventListener("keydown", aggressiveKeyHandler, true);
      document.removeEventListener("keyup", aggressiveKeyHandler, true);
    };
  };

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

    // Set up additional browser shortcut prevention
    const cleanupShortcuts = setupBrowserShortcutPrevention();

    // Mark game as active
    setIsGameActive(true);

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

    document.addEventListener("fullscreenchange", checkFullscreen);
    onCleanup(() =>
      document.removeEventListener("fullscreenchange", checkFullscreen)
    );

    return () => {
      cleanup();
      cleanupShortcuts();
      setIsGameActive(false);
    };
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
      <button
        onClick={toggleFullscreen}
        class="absolute top-4 right-4 px-4 py-2 font-bold text-amber-100 transition-transform duration-300 border-2 border-yellow-600 rounded shadow-lg hover:scale-105 bg-gradient-to-b from-blue-800 to-blue-950"
      >
        <div class="flex items-center justify-center space-x-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-yellow-400"
          >
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span>Fullscreen</span>
        </div>
      </button>

      {/* <Show when={!isFullscreen()}>
        <p class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 text-white bg-black/50 px-6 py-3 rounded-lg text-sm shadow-lg backdrop-blur-md transition-opacity duration-500 cursor-pointer hover:opacity-0">
          Scroll down for Single Page Portfolio below.
        </p>
      </Show> */}
    </div>
  );
};

export default ThreeScene;

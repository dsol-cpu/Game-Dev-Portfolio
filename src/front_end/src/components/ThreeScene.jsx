import { createEffect, onMount, createSignal, onCleanup } from "solid-js";
import { navigationStore } from "../stores/navigation";
import { useThreeScene } from "../hooks/useThreeScene";
import { useShipControls } from "../hooks/useShipControls";
import { useNavigation } from "../hooks/useNavigation";
import AltitudePanel from "./UI/AltitudePanel";
import SpeedControls from "./UI/SpeedControls";
import MobileControls from "./UI/MobileControls";
import ControlsInfo from "./UI/ControlsInfo";
import Compass from "./UI/Compass";

const ThreeScene = (props) => {
  let containerRef;
  const [resolution, setResolution] = createSignal({ width: 0, height: 0 });
  const [isGameActive, setIsGameActive] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(
    document.fullscreenElement !== null
  );
  const [shipRotation, setShipRotation] = createSignal(0);
  // Create a separate signal for ship height to ensure it's always a number
  const [shipHeight, setShipHeight] = createSignal(0);

  const checkFullscreen = () => setIsFullscreen(!!document.fullscreenElement);

  const threeScene = useThreeScene(() => containerRef);

  // Update our local shipHeight signal whenever threeScene's shipHeight changes
  createEffect(() => {
    if (threeScene.shipHeight !== undefined && threeScene.shipHeight !== null) {
      // Ensure it's a number
      const height =
        typeof threeScene.shipHeight === "function"
          ? threeScene.shipHeight()
          : Number(threeScene.shipHeight) || 0;
      setShipHeight(height);
    }
  });

  const shipControls = useShipControls(
    () => threeScene.ship(),
    (height) => {
      // When shipHeight is updated through shipControls, update our local signal too
      if (typeof height === "number") {
        setShipHeight(height);
      }
      if (threeScene.setShipHeight) {
        threeScene.setShipHeight(height);
      }
    }
  );

  const navigation = useNavigation(
    () => threeScene.ship(),
    (height) => {
      // When shipHeight is updated through navigation, update our local signal too
      if (typeof height === "number") {
        setShipHeight(height);
      }
      if (threeScene.setShipHeight) {
        threeScene.setShipHeight(height);
      }
    },
    shipControls
  );

  const {
    targetIsland,
    setTargetIsland,
    isNavigating,
    setIsNavigating,
    destinationSection,
  } = navigationStore;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const setupBrowserShortcutPrevention = () => {
    const beforeUnloadHandler = (e) => {
      if (isGameActive()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    const aggressiveKeyHandler = (e) => {
      if (!isGameActive()) return;

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

  createEffect(() => {
    if (
      targetIsland() !== null &&
      threeScene.ship() &&
      threeScene.islands() &&
      threeScene.islands().length > 0
    ) {
      navigation.startNavigation(targetIsland());
    }
  });

  createEffect(() => {
    const handleResize = () => {
      const renderer = threeScene.renderer();
      const camera = threeScene.camera();

      if (renderer && camera) {
        const container = containerRef;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        setResolution({ width, height });
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("sidebarToggle", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("sidebarToggle", handleResize);
    };
  });

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

  const update = () => {
    if (!isGameActive()) return;

    if (
      navigation.isNavigating &&
      typeof navigation.isNavigating === "function" &&
      navigation.isNavigating()
    ) {
      navigation.updateNavigation();
    } else if (
      shipControls.resetOrientationInProgress &&
      typeof shipControls.resetOrientationInProgress === "function" &&
      shipControls.resetOrientationInProgress()
    ) {
      shipControls.updateOrientationReset();
    } else {
      shipControls.updateShipControls();
    }

    const camera = threeScene.camera();
    const ship = threeScene.ship();

    if (camera && ship) {
      shipControls.updateCamera(camera);
      setShipRotation(ship.rotation.y);
    }
  };

  onMount(() => {
    // First initialize the scene
    const cleanup = threeScene.initScene();

    // After scene initialization, setup controls
    setTimeout(() => {
      if (shipControls && shipControls.setupControls) {
        shipControls.setupControls();
      }

      // Start game and animation after controls are setup
      setIsGameActive(true);

      if (threeScene.startAnimation) {
        threeScene.startAnimation([update]);
      }
    }, 100);

    const cleanupShortcuts = setupBrowserShortcutPrevention();

    const renderer = threeScene.renderer();
    if (renderer && containerRef) {
      const width = containerRef.clientWidth;
      const height = containerRef.clientHeight;
      setResolution({ width, height });

      renderer.setSize(width, height);
      const camera = threeScene.camera();
      if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    }

    document.addEventListener("fullscreenchange", checkFullscreen);

    onCleanup(() => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
      if (cleanup && typeof cleanup === "function") cleanup();
      if (cleanupShortcuts && typeof cleanupShortcuts === "function")
        cleanupShortcuts();
      setIsGameActive(false);
    });
  });

  return (
    <div class="relative h-screen overflow-hidden">
      <div
        ref={containerRef}
        class="w-full h-full absolute inset-0"
        data-width={resolution().width}
        data-height={resolution().height}
      />
      {/* Pass our shipHeight signal instead of threeScene.shipHeight */}
      <AltitudePanel shipHeight={shipHeight()} />
      {!props.isScrollView && <SpeedControls />}
      {!props.isScrollView && <ControlsInfo />}
      <Compass rotation={shipRotation()} />
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
    </div>
  );
};

export default ThreeScene;

import {
  createEffect,
  onMount,
  createSignal,
  onCleanup,
  createMemo,
} from "solid-js";
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
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [shipRotation, setShipRotation] = createSignal(0);
  const [shipHeight, setShipHeight] = createSignal(0);
  const [isVisible, setIsVisible] = createSignal(true);
  const [sceneInitialized, setSceneInitialized] = createSignal(false);

  // Check if component is visible in viewport
  const checkVisibility = () => {
    if (!containerRef) return false;

    const rect = containerRef.getBoundingClientRect();
    const isInViewport =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.width > 0 &&
      rect.height > 0;

    setIsVisible(isInViewport);
    return isInViewport;
  };

  // Initialize threeScene with a stable reference function
  const getContainerRef = () => containerRef;
  const threeScene = useThreeScene(getContainerRef);

  // Initialize shipControls with stable function references
  const getShip = () => threeScene.ship();
  const updateShipHeight = (height) => {
    if (typeof height === "number") {
      setShipHeight(height);
      if (threeScene.setShipHeight) {
        threeScene.setShipHeight(height);
      }
    }
  };

  const shipControls = useShipControls(getShip, updateShipHeight);
  const navigation = useNavigation(getShip, updateShipHeight, shipControls);

  const {
    targetIsland,
    setTargetIsland,
    isNavigating,
    setIsNavigating,
    destinationSection,
  } = navigationStore;

  // Derived value for whether controls should be shown
  const showControls = createMemo(() => props.isScrollView !== true);

  // Setup intersection observer to detect when component is visible
  const setupVisibilityObserver = () => {
    if (!containerRef) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting;
        setIsVisible(isIntersecting);

        // Initialize or resume scene when visible
        if (isIntersecting) {
          if (!sceneInitialized()) {
            initializeScene();
          } else {
            resumeScene();
          }
        } else {
          pauseScene();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef);
    return () => observer.disconnect();
  };

  // Initialize scene only when visible
  const initializeScene = () => {
    if (!containerRef || sceneInitialized()) return;

    // Initialize the scene
    const cleanupScene = threeScene.initScene?.() || (() => {});
    setSceneInitialized(true);

    // Setup controls and start animation
    setTimeout(() => {
      shipControls.setupControls?.();
      setIsGameActive(true);
      threeScene.startAnimation?.([update]);
    }, 100);

    // Initial sizing
    updateSceneSize();

    return cleanupScene;
  };

  // Pause scene when not visible
  const pauseScene = () => {
    if (isGameActive()) {
      setIsGameActive(false);
      // Cancel animation frame if it exists
      if (threeScene.cancelAnimation) {
        threeScene.cancelAnimation();
      }
    }
  };

  // Resume scene when visible again
  const resumeScene = () => {
    if (!isGameActive() && sceneInitialized()) {
      setIsGameActive(true);
      updateSceneSize();
      threeScene.startAnimation?.([update]);
    }
  };

  // Update scene size based on container dimensions
  const updateSceneSize = () => {
    if (!containerRef) return;

    const width = containerRef.clientWidth || 1;
    const height = containerRef.clientHeight || 1;

    setResolution({ width, height });

    const renderer = threeScene.renderer();
    const camera = threeScene.camera();

    if (renderer && camera) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  };

  // Sync threeScene's shipHeight to our local state
  createEffect(() => {
    if (!sceneInitialized()) return;

    const sceneShipHeight = threeScene.shipHeight?.();
    if (sceneShipHeight !== undefined && sceneShipHeight !== null) {
      setShipHeight(Number(sceneShipHeight) || 0);
    }
  });

  // Handle target island navigation
  createEffect(() => {
    if (!sceneInitialized() || !isGameActive()) return;

    const currentTargetIsland = targetIsland();
    const currentShip = threeScene.ship();
    const islands = threeScene.islands();

    if (
      currentTargetIsland !== null &&
      currentShip &&
      islands &&
      islands.length > 0
    ) {
      navigation.startNavigation(currentTargetIsland);
    }
  });

  // Handle window resize
  createEffect(() => {
    const handleResize = () => {
      checkVisibility();
      if (isVisible() && sceneInitialized()) {
        updateSceneSize();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", checkVisibility);
    window.addEventListener("sidebarToggle", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("sidebarToggle", handleResize);
    };
  });

  // Check fullscreen status
  const checkFullscreen = () => setIsFullscreen(!!document.fullscreenElement);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Setup keyboard shortcuts prevention
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

  // Handle mobile controls
  const handleMobileMove = (x, y) => {
    if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
      shipControls.setMobileMovement?.(x, y);
    }
  };

  const handleAltitudeUp = () => {
    if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
      shipControls.increaseAltitude?.();
    }
  };

  const handleAltitudeDown = () => {
    if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
      shipControls.decreaseAltitude?.();
    }
  };

  const handleAltitudeStop = () => {
    if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
      shipControls.stopAltitudeChange?.();
    }
  };

  const handleOrientationReset = () => {
    if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
      shipControls.startOrientationReset?.();
    }
  };

  // Update function for animation loop
  const update = () => {
    if (!isGameActive() || !isVisible()) return;

    // Safe function calls with optional chaining
    if (navigation.isNavigating?.()) {
      navigation.updateNavigation?.();
    } else if (shipControls.resetOrientationInProgress?.()) {
      shipControls.updateOrientationReset?.();
    } else {
      shipControls.updateShipControls?.();
    }

    const camera = threeScene.camera();
    const ship = threeScene.ship();

    if (camera && ship) {
      shipControls.updateCamera?.(camera);
      setShipRotation(ship.rotation.y);
    }
  };

  // Component initialization
  onMount(() => {
    // Add fullscreen event listener
    document.addEventListener("fullscreenchange", checkFullscreen);
    checkFullscreen(); // Set initial state

    // Setup browser shortcuts prevention
    const cleanupShortcuts = setupBrowserShortcutPrevention();

    // Check initial visibility and setup observer
    setTimeout(() => {
      const isCurrentlyVisible = checkVisibility();
      setIsVisible(isCurrentlyVisible);

      if (isCurrentlyVisible) {
        initializeScene();
      }

      const cleanupObserver = setupVisibilityObserver();

      onCleanup(() => {
        cleanupObserver();
        document.removeEventListener("fullscreenchange", checkFullscreen);
        cleanupShortcuts();
        setIsGameActive(false);

        // Clean up scene if it was initialized
        if (sceneInitialized()) {
          threeScene.cancelAnimation?.();
          threeScene.cleanup?.();
        }
      });
    }, 10); // Small delay to ensure DOM is ready
  });

  return (
    <div class="relative h-screen overflow-hidden">
      <div
        ref={containerRef}
        class="w-full h-full absolute inset-0"
        data-width={resolution().width}
        data-height={resolution().height}
        data-initialized={sceneInitialized() ? "true" : "false"}
        data-visible={isVisible() ? "true" : "false"}
      />

      {/* Only render UI components when scene is initialized and visible */}
      {sceneInitialized() && (
        <>
          <AltitudePanel shipHeight={shipHeight()} />

          {/* Conditionally render controls based on isScrollView */}
          {showControls() && <SpeedControls />}
          {showControls() && <ControlsInfo />}

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
        </>
      )}
    </div>
  );
};

export default ThreeScene;

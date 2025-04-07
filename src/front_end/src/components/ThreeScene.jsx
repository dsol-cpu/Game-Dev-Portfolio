import {
  createEffect,
  onMount,
  createSignal,
  onCleanup,
  createMemo,
  batch,
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
import LoadingScreen from "./UI/LoadingScreen";

// Extracted SVG component for better reusability
const FullscreenIcon = () => (
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
);

const ThreeScene = (props) => {
  let containerRef;
  const [resolution, setResolution] = createSignal({ width: 0, height: 0 });
  const [isGameActive, setIsGameActive] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [shipRotation, setShipRotation] = createSignal(0);
  const [shipHeight, setShipHeight] = createSignal(0);
  const [isVisible, setIsVisible] = createSignal(true);
  const [sceneInitialized, setSceneInitialized] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadingProgress, setLoadingProgress] = createSignal(0);

  // Memoized functions to ensure stable references
  const getContainerRef = () => containerRef;
  const threeScene = useThreeScene(getContainerRef);

  const getShip = () => threeScene.ship();

  // Memoize this function to avoid recreating it on every render
  const updateShipHeight = (height) => {
    if (typeof height === "number" && threeScene.setShipHeight) {
      batch(() => {
        setShipHeight(height);
        threeScene.setShipHeight(height);
      });
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

  // Preload assets with progress tracking
  const preloadAssets = async () => {
    try {
      setLoadingProgress(0);

      // Start with asset preloading phase - 0% to 60%
      if (threeScene.preloadAssets) {
        // Check if the preloadAssets method supports progress callbacks
        if (threeScene.preloadAssets.length > 0) {
          // If it supports progress callbacks
          await threeScene.preloadAssets((progress) => {
            setLoadingProgress(progress * 60); // Scale to 0-60%
          });
        } else {
          // Simulate progress if no callback support
          const steps = 8;
          for (let i = 1; i <= steps; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            setLoadingProgress((i / steps) * 60);
          }
          await threeScene.preloadAssets();
        }
      } else {
        // Simulate progress if no preloadAssets method
        for (let i = 1; i <= 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          setLoadingProgress(i * 6);
        }
      }

      return true;
    } catch (error) {
      console.error("Error preloading assets:", error);
      return false;
    }
  };

  // Scene initialization with progress tracking
  const initializeScene = async () => {
    if (!containerRef || sceneInitialized()) return;

    setIsLoading(true);
    setLoadingProgress(0);

    // Preload assets first (0-60%)
    await preloadAssets();

    // Scene initialization phase (60-90%)
    setLoadingProgress(60);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Initialize the scene
    const cleanupScene = threeScene.initScene?.() || (() => {});
    setLoadingProgress(75);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Set up controls (90-100%)
    setLoadingProgress(90);

    // Setup controls and finalize loading
    return new Promise((resolve) => {
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(async () => {
        shipControls.setupControls?.();
        setLoadingProgress(95);

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Complete loading
        setLoadingProgress(100);

        // Wait for a brief moment at 100% before removing loading screen
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Ready to activate scene
        setSceneInitialized(true);
        setIsGameActive(true);
        threeScene.startAnimation?.([update]);
        updateSceneSize();
        setIsLoading(false);
        resolve(cleanupScene);
      });
    });
  };

  const pauseScene = () => {
    if (isGameActive()) {
      setIsGameActive(false);
      threeScene.cancelAnimation?.();
    }
  };

  const resumeScene = () => {
    if (!isGameActive() && sceneInitialized()) {
      setIsGameActive(true);
      updateSceneSize();
      threeScene.startAnimation?.([update]);
    }
  };

  const updateSceneSize = () => {
    if (!containerRef) return;

    const width = containerRef.clientWidth || 1;
    const height = containerRef.clientHeight || 1;

    // Only update if dimensions have changed
    if (resolution().width !== width || resolution().height !== height) {
      setResolution({ width, height });

      const renderer = threeScene.renderer();
      const camera = threeScene.camera();

      if (renderer && camera) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    }
  };

  // Update function for animation loop
  const update = () => {
    if (!isGameActive() || !isVisible()) return;

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

  // Setup visibility observer - extracted from onMount for clarity
  const setupVisibilityObserver = () => {
    if (!containerRef) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting;
        setIsVisible(isIntersecting);

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

  // Event handlers for UI interactions
  const checkFullscreen = () => setIsFullscreen(!!document.fullscreenElement);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Mobile control handlers - grouped together for clarity
  const mobileHandlers = {
    handleMobileMove: (x, y) => {
      if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
        shipControls.setMobileMovement?.(x, y);
      }
    },

    handleAltitudeUp: () => {
      if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
        shipControls.increaseAltitude?.();
      }
    },

    handleAltitudeDown: () => {
      if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
        shipControls.decreaseAltitude?.();
      }
    },

    handleAltitudeStop: () => {
      if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
        shipControls.stopAltitudeChange?.();
      }
    },

    handleOrientationReset: () => {
      if (!isGameActive() || (!navigation.isNavigating?.() && shipControls)) {
        shipControls.startOrientationReset?.();
      }
    },
  };

  // Setup browser shortcut prevention
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

  // Effects
  createEffect(() => {
    if (!sceneInitialized()) return;

    // Sync ship height from the scene to our local state
    const sceneShipHeight = threeScene.shipHeight?.();
    if (sceneShipHeight !== undefined && sceneShipHeight !== null) {
      setShipHeight(Number(sceneShipHeight) || 0);
    }
  });

  createEffect(() => {
    if (!sceneInitialized() || !isGameActive()) return;

    // Handle target island navigation
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

  // Handle window events in a single effect
  createEffect(() => {
    const handleResize = () => {
      checkVisibility();
      if (isVisible() && sceneInitialized()) {
        updateSceneSize();
      }
    };

    // Use passive: true for better scroll performance
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("sidebarToggle", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("sidebarToggle", handleResize);
    };
  });

  // Component initialization
  onMount(() => {
    // Add fullscreen event listener
    document.addEventListener("fullscreenchange", checkFullscreen);
    checkFullscreen();

    // Setup browser shortcuts prevention
    const cleanupShortcuts = setupBrowserShortcutPrevention();

    // Store cleanup function references
    let cleanupObserver = () => {};

    // Start initialization based on scroll view property
    if (!props.isScrollView) {
      // For non-scroll views, start initializing immediately
      initializeScene();
    } else {
      // For scroll views, use visibility-based behavior
      const isCurrentlyVisible = checkVisibility();
      setIsVisible(isCurrentlyVisible);

      if (isCurrentlyVisible) {
        initializeScene();
      }

      // Setup the observer
      cleanupObserver = setupVisibilityObserver();
    }

    // Register all cleanups properly with SolidJS
    onCleanup(() => {
      cleanupObserver();
      document.removeEventListener("fullscreenchange", checkFullscreen);
      cleanupShortcuts();

      // Clean up scene if it was initialized
      if (sceneInitialized()) {
        pauseScene();
        threeScene.cleanup?.();
      }
    });
  });

  // Check if we should show the scene (only when loading is complete)
  const showScene = createMemo(() => !isLoading() && sceneInitialized());

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

      {/* Show loading screen until progress reaches 100% and processing completes */}
      {isLoading() && (
        <LoadingScreen
          message={
            loadingProgress() < 60
              ? "Loading assets..."
              : loadingProgress() < 90
                ? "Initializing world..."
                : "Preparing controls..."
          }
          progress={loadingProgress()}
        />
      )}

      {/* Only render UI components when scene is fully initialized and loading is complete */}
      {showScene() && (
        <>
          <AltitudePanel shipHeight={shipHeight()} />

          {/* Conditionally render controls based on showControls memo */}
          {showControls() && <SpeedControls />}
          {showControls() && <ControlsInfo />}

          {/* <Compass rotation={shipRotation()} /> */}

          <MobileControls
            onMove={mobileHandlers.handleMobileMove}
            onAltitudeUp={mobileHandlers.handleAltitudeUp}
            onAltitudeDown={mobileHandlers.handleAltitudeDown}
            onAltitudeStop={mobileHandlers.handleAltitudeStop}
            onOrientationReset={mobileHandlers.handleOrientationReset}
          />

          <button
            onClick={toggleFullscreen}
            class="absolute top-4 right-4 px-4 py-2 font-bold text-amber-100 transition-transform duration-300 border-2 border-yellow-600 rounded shadow-lg hover:scale-105 bg-gradient-to-b from-blue-800 to-blue-950"
          >
            <div class="flex items-center justify-center space-x-2">
              <FullscreenIcon />
              <span>Fullscreen</span>
            </div>
          </button>
        </>
      )}
    </div>
  );
};

export default ThreeScene;

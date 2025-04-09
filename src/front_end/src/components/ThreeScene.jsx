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
import FullscreenButton from "./FullscreenButton";

// Asset caching implementation
const CACHE_KEY = "three-scene-assets-cache";
const CACHE_VERSION = "v1"; // Increment this when assets change

const ThreeScene = (props) => {
  let containerRef;
  const [resolution, setResolution] = createSignal({ width: 0, height: 0 });
  const [isGameActive, setIsGameActive] = createSignal(false);
  const [shipRotation, setShipRotation] = createSignal(0);
  const [shipHeight, setShipHeight] = createSignal(0);
  const [isVisible, setIsVisible] = createSignal(true);
  const [sceneInitialized, setSceneInitialized] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [assetsLoaded, setAssetsLoaded] = createSignal(false);

  // Stable references to avoid recreating on render
  const getContainerRef = () => containerRef;
  const threeScene = useThreeScene(getContainerRef);
  const getShip = () => threeScene.ship(); // Keep original implementation

  // Memoized update function for better performance
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

  // Derived value for showing scene
  const showScene = createMemo(() => !isLoading() && sceneInitialized());

  // Check asset cache status
  const checkCachedAssets = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) return null;

      const data = JSON.parse(cachedData);
      if (data.version !== CACHE_VERSION) {
        // Clear outdated cache
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.warn("Error reading asset cache:", error);
      return null;
    }
  };

  // Save asset load status to cache
  const updateAssetCache = (assets) => {
    try {
      const cacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        assets,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Error saving asset cache:", error);
    }
  };

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

  // Optimized preload assets with caching
  const preloadAssets = async () => {
    try {
      // Check for cached assets first
      const cachedAssets = checkCachedAssets();
      if (cachedAssets) {
        // Simulate faster loading when assets are cached
        setLoadingProgress(30);
        await new Promise((resolve) => setTimeout(resolve, 100));
        setLoadingProgress(60);
        setAssetsLoaded(true);
        return true;
      }

      // No cache available, load normally
      setLoadingProgress(0);

      // Start with asset preloading phase - 0% to 60%
      if (threeScene.preloadAssets) {
        // Check if the preloadAssets method supports progress callbacks
        if (threeScene.preloadAssets.length > 0) {
          // If it supports progress callbacks
          const loadedAssets = await threeScene.preloadAssets((progress) => {
            setLoadingProgress(progress * 60); // Scale to 0-60%
          });

          // Store asset load status in cache
          updateAssetCache(loadedAssets || true);
        } else {
          // Simulate progress if no callback support
          const steps = 8;
          for (let i = 1; i <= steps; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            setLoadingProgress((i / steps) * 60);
          }
          await threeScene.preloadAssets();
          updateAssetCache(true);
        }
      } else {
        // Simulate progress if no preloadAssets method
        for (let i = 1; i <= 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          setLoadingProgress(i * 6);
        }
        updateAssetCache(true);
      }

      setAssetsLoaded(true);
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

    // Step 1: Preload assets (0-60%)
    if (!assetsLoaded()) {
      await preloadAssets();
    }

    // Step 2: Scene initialization phase (60-90%)
    setLoadingProgress(60);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Initialize the scene
    let cleanupScene;
    try {
      cleanupScene = threeScene.initScene?.() || (() => {});
    } catch (error) {
      console.error("Scene initialization error:", error);
      cleanupScene = () => {};
    }

    setLoadingProgress(75);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Step 3: Set up controls (90-100%)
    setLoadingProgress(90);

    // Setup controls and finalize loading
    return new Promise((resolve) => {
      // Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(async () => {
        try {
          shipControls.setupControls?.();
        } catch (error) {
          console.error("Controls setup error:", error);
        }

        setLoadingProgress(95);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Complete loading
        setLoadingProgress(100);
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

  // Optimized scene size update with debouncing
  let resizeTimeout;
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

  // Update function for animation loop - kept similar to original for navigation compatibility
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

  // Setup visibility observer with IntersectionObserver
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

  // Effects - keeping original structure for navigation compatibility
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

  // Handle window events with passive listeners and debouncing
  createEffect(() => {
    const handleResize = () => {
      checkVisibility();
      if (isVisible() && sceneInitialized()) {
        updateSceneSize();
      }
    };

    // Debounced resize handler
    const debouncedResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    // Use passive listeners for better scroll performance
    window.addEventListener("resize", debouncedResize, { passive: true });
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("sidebarToggle", debouncedResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", debouncedResize);
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("sidebarToggle", debouncedResize);
    };
  });

  // Component initialization
  onMount(() => {
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
      cleanupShortcuts();
      clearTimeout(resizeTimeout);

      // Clean up scene if it was initialized
      if (sceneInitialized()) {
        pauseScene();
        threeScene.cleanup?.();
      }
    });
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

      {/* Show loading screen until progress reaches 100% and processing completes */}
      {isLoading() && (
        <LoadingScreen
          message={
            loadingProgress() < 30
              ? "Loading assets..."
              : loadingProgress() < 60
                ? checkCachedAssets()
                  ? "Loading cached assets..."
                  : "Loading assets..."
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

          <FullscreenButton />
        </>
      )}
    </div>
  );
};

export default ThreeScene;

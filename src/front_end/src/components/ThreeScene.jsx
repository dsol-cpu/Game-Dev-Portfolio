import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { navigationStore } from "../stores/navigation";
import { useThreeScene } from "../hooks/useThreeScene";
import { useShipControls } from "../hooks/useShipControls";
import { useNavigation } from "../hooks/useNavigation";
// import { useIslandArrivalPopup } from "../hooks/useIslandArrivalPopup";
import { useVisibilityObserver } from "../hooks/useVisibilityObserver";
import { useAssetCache } from "../hooks/useAssetCache";
import SceneContainer from "./SceneContainer";
import LoadingScreen from "./UI/LoadingScreen";
import SceneControls from "./SceneControls";

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

  // Hook initialization
  const getContainerRef = () => containerRef;
  const threeScene = useThreeScene(getContainerRef);
  const getShip = () => threeScene.ship();
  const getScene = () => threeScene.scene();

  const { checkCachedAssets, updateAssetCache } = useAssetCache();

  const updateShipHeight = (height) => {
    if (typeof height === "number" && threeScene.setShipHeight) {
      setShipHeight(height);
      threeScene.setShipHeight(height);
    }
  };

  const shipControls = useShipControls(getShip, updateShipHeight);
  const navigation = useNavigation(getShip, updateShipHeight, shipControls);
  // const arrivalPopup = useIslandArrivalPopup(getScene());

  const { targetIsland, isNavigating } = navigationStore;

  // Derived values
  const showControls = createMemo(() => props.isScrollView !== true);
  const showScene = createMemo(() => !isLoading() && sceneInitialized());

  // Scene management functions
  const updateSceneSize = () => {
    if (!containerRef) return;

    const width = containerRef.clientWidth || 1;
    const height = containerRef.clientHeight || 1;

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
      // arrivalPopup.update(camera);
    }
  };

  const preloadAssets = async () => {
    try {
      const cachedAssets = checkCachedAssets();
      if (cachedAssets) {
        // Fast load for cached assets
        setLoadingProgress(30);
        await new Promise((resolve) => setTimeout(resolve, 100));
        setLoadingProgress(60);
        return true;
      }

      setLoadingProgress(0);

      if (threeScene.preloadAssets) {
        if (threeScene.preloadAssets.length > 0) {
          const loadedAssets = await threeScene.preloadAssets((progress) => {
            setLoadingProgress(progress * 60);
          });
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
        for (let i = 1; i <= 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          setLoadingProgress(i * 6);
        }
        updateAssetCache(true);
      }

      return true;
    } catch (error) {
      console.error("Error preloading assets:", error);
      return false;
    }
  };

  const initializeScene = async () => {
    if (!containerRef || sceneInitialized()) return;

    setIsLoading(true);
    setLoadingProgress(0);

    // Step 1: Preload assets (0-60%)
    await preloadAssets();

    // Step 2: Scene initialization (60-90%)
    setLoadingProgress(60);
    await new Promise((resolve) => setTimeout(resolve, 300));

    let cleanupScene;
    try {
      cleanupScene = threeScene.initScene?.() || (() => {});
    } catch (error) {
      console.error("Scene initialization error:", error);
      cleanupScene = () => {};
    }

    setLoadingProgress(75);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setLoadingProgress(90);

    return new Promise((resolve) => {
      requestAnimationFrame(async () => {
        try {
          shipControls.setupControls?.();
          // arrivalPopup.initPopup();
        } catch (error) {
          console.error("Controls setup error:", error);
        }

        setLoadingProgress(95);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setLoadingProgress(100);
        await new Promise((resolve) => setTimeout(resolve, 500));

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

  // Visibility management
  const handleVisibilityChange = (isInViewport) => {
    setIsVisible(isInViewport);

    if (isInViewport) {
      if (!sceneInitialized()) {
        initializeScene();
      } else {
        resumeScene();
      }
    } else {
      pauseScene();
    }
  };

  // Effects and lifecycle
  onMount(() => {
    const { setupVisibilityObserver } = useVisibilityObserver(
      containerRef,
      handleVisibilityChange
    );

    const cleanupBrowserShortcuts = setupBrowserShortcuts();
    const cleanupWindowEvents = setupWindowEvents();
    let cleanupObserver = () => {};

    if (props.isScrollView) {
      const initialVisibility = checkVisibility();
      setIsVisible(initialVisibility);

      if (initialVisibility) {
        initializeScene();
      }

      cleanupObserver = setupVisibilityObserver();
    } else {
      initializeScene();
    }

    // Handle navigation when target island changes
    const unsubscribeNavigation = setupNavigationEffects();

    onCleanup(() => {
      cleanupObserver();
      cleanupBrowserShortcuts();
      cleanupWindowEvents();
      unsubscribeNavigation();

      if (sceneInitialized()) {
        pauseScene();
        threeScene.cleanup?.();
      }
    });
  });

  // Setup functions
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

  const setupBrowserShortcuts = () => {
    const beforeUnloadHandler = (e) => {
      if (isGameActive()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    const keyHandler = (e) => {
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
    document.addEventListener("keydown", keyHandler, true);
    document.addEventListener("keyup", keyHandler, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      document.removeEventListener("keydown", keyHandler, true);
      document.removeEventListener("keyup", keyHandler, true);
    };
  };

  let resizeTimeout;
  const setupWindowEvents = () => {
    const handleResize = () => {
      checkVisibility();
      if (isVisible() && sceneInitialized()) {
        updateSceneSize();
      }
    };

    const debouncedResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener("resize", debouncedResize, { passive: true });
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("sidebarToggle", debouncedResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", debouncedResize);
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("sidebarToggle", debouncedResize);
    };
  };

  const setupNavigationEffects = () => {
    // Set up an effect tracking system since we're not using createEffect here
    const checkNavigationChanges = () => {
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
        // arrivalPopup.setupNavigationListener(islands);
      }
    };

    // Set up for ship height sync
    const syncShipHeight = () => {
      if (!sceneInitialized()) return;

      const sceneShipHeight = threeScene.shipHeight?.();
      if (sceneShipHeight !== undefined && sceneShipHeight !== null) {
        setShipHeight(Number(sceneShipHeight) || 0);
      }
    };

    // Initial check
    syncShipHeight();
    checkNavigationChanges();

    // Simple timer-based polling instead of createEffect
    const intervalId = setInterval(() => {
      syncShipHeight();
      checkNavigationChanges();
    }, 500);

    return () => clearInterval(intervalId);
  };

  return (
    <div class="relative h-screen overflow-hidden">
      <SceneContainer
        ref={containerRef}
        resolution={resolution()}
        initialized={sceneInitialized()}
        visible={isVisible()}
      />

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

      {showScene() && (
        <SceneControls
          showControls={showControls()}
          shipHeight={shipHeight()}
          shipRotation={shipRotation()}
          isNavigating={navigation.isNavigating?.()}
          handleMobileMove={(x, y) => {
            if (
              !isGameActive() ||
              (!navigation.isNavigating?.() && shipControls)
            ) {
              shipControls.setMobileMovement?.(x, y);
            }
          }}
          handleAltitudeUp={() => {
            if (
              !isGameActive() ||
              (!navigation.isNavigating?.() && shipControls)
            ) {
              shipControls.increaseAltitude?.();
            }
          }}
          handleAltitudeDown={() => {
            if (
              !isGameActive() ||
              (!navigation.isNavigating?.() && shipControls)
            ) {
              shipControls.decreaseAltitude?.();
            }
          }}
          handleAltitudeStop={() => {
            if (
              !isGameActive() ||
              (!navigation.isNavigating?.() && shipControls)
            ) {
              shipControls.stopAltitudeChange?.();
            }
          }}
          handleOrientationReset={() => {
            if (
              !isGameActive() ||
              (!navigation.isNavigating?.() && shipControls)
            ) {
              shipControls.startOrientationReset?.();
            }
          }}
        />
      )}
    </div>
  );
};

export default ThreeScene;

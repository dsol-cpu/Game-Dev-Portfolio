import { createSignal, createEffect, onCleanup } from "solid-js";

const LoadingScreen = (props) => {
  const [progress, setProgress] = createSignal(props.progress || 0);

  // More efficient props tracking
  createEffect(() => setProgress(props.progress ?? 0));

  return (
    <div class="absolute inset-0 flex items-center justify-center bg-blue-900 bg-opacity-80 z-10">
      <div class="text-center">
        <div class="relative inline-block w-24 h-24">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            class="w-full h-full animate-pulse"
          >
            <path
              fill="none"
              stroke="#FCD34D"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.5 12h17M12 3.5v17M12 12l7.5 7.5M12 12l-7.5 7.5M12 12l7.5-7.5M12 12l-7.5-7.5"
              stroke-dasharray="1, 2"
            />
          </svg>
        </div>
        <p class="mt-4 text-xl text-yellow-300 font-bold">
          {props.message || "Preparing your journey..."}
        </p>
        <div class="mt-3 h-2 w-48 mx-auto bg-blue-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-yellow-400 transition-all duration-300 ease-out"
            style={`width: ${progress()}%`}
          />
        </div>
      </div>
    </div>
  );
};

const preloadAssets = async () => {
  // Start with initial progress
  setLoadingProgress(5);

  let progressIntervalId;

  try {
    // Create a controlled progress animation with cleanup handling
    const startProgressAnimation = () => {
      let currentProgress = 5;
      const targetProgress = 90;

      progressIntervalId = setInterval(() => {
        // Calculate step with diminishing returns for smoother appearance
        const remaining = targetProgress - currentProgress;
        const step = Math.max(0.2, remaining / 20);

        currentProgress = Math.min(targetProgress, currentProgress + step);
        setLoadingProgress(currentProgress);

        if (currentProgress >= targetProgress) {
          clearInterval(progressIntervalId);
        }
      }, 100);
    };

    // Start animation
    startProgressAnimation();

    // Actual asset loading in parallel
    if (
      threeScene.preloadAssets &&
      typeof threeScene.preloadAssets === "function"
    ) {
      await threeScene.preloadAssets();
    }

    return true;
  } catch (error) {
    console.error("Error preloading assets:", error);
    return false;
  } finally {
    // Ensure cleanup of interval
    if (progressIntervalId) {
      clearInterval(progressIntervalId);
    }
  }
};

const initializeScene = async () => {
  if (!containerRef || sceneInitialized()) return;

  setIsLoading(true);
  setLoadingProgress(0);

  try {
    // Preload assets (0-90%)
    await preloadAssets();

    // Initialize scene and get cleanup function
    const cleanupScene = threeScene.initScene?.() || (() => {});

    // Setup controls
    shipControls.setupControls?.();

    // Complete the progress smoothly
    setLoadingProgress(95);

    await new Promise((resolve) => {
      setTimeout(() => {
        setLoadingProgress(100);

        setTimeout(() => {
          setSceneInitialized(true);
          setIsGameActive(true);
          threeScene.startAnimation?.([update]);
          updateSceneSize();
          setIsLoading(false);
          resolve();
        }, 300);
      }, 200);
    });

    return cleanupScene;
  } catch (error) {
    console.error("Error initializing scene:", error);
    setIsLoading(false);
    return () => {};
  }
};

export default LoadingScreen;

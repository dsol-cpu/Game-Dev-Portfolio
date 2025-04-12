import {
  createModelManager,
  loadModelManually,
} from "../components/modelManager";
import { getModelForProject } from "../stores/projectModelMapping";

// Singleton to prevent multiple initializations
let preloaderInitialized = false;

// Initialize the preloader with configuration options
export const initializeModelPreloader = (options = {}) => {
  if (preloaderInitialized) return;

  const defaultOptions = {
    preloadOnIdle: true, // Load models during browser idle time
    preloadOnVisible: true, // Load models when container becomes visible
    lowQuality: false, // Use low quality settings for performance
    priorityModels: [], // Array of model names to load first
  };

  const config = { ...defaultOptions, ...options };

  // Initialize the model manager
  const modelStore = createModelManager();

  // Set up idle loading if enabled
  if (config.preloadOnIdle && window.requestIdleCallback) {
    window.requestIdleCallback(() => {
      preloadPriorityModels(config.priorityModels);
    });
  } else if (config.preloadOnIdle) {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      preloadPriorityModels(config.priorityModels);
    }, 1000);
  }

  // Set up intersection observer for visible loading
  if (config.preloadOnVisible) {
    setupVisibilityPreloader();
  }

  // Set up global model loading tracker
  setupModelLoadTracker();

  // Expose settings globally for components to use
  window.modelSettings = getOptimizedModelSettings();

  // Mark as initialized
  preloaderInitialized = true;

  return {
    modelStore,
    config,
  };
};

// Preload priority models first
const preloadPriorityModels = (priorityModels = []) => {
  if (!priorityModels.length) return;

  // Implement batch loading with delay to avoid blocking the main thread
  let index = 0;

  const loadNextBatch = () => {
    const batch = priorityModels.slice(index, index + 3); // Load 3 at a time

    if (batch.length === 0) return;

    batch.forEach((modelName) => {
      // Use loadModelManually from modelManager
      loadModelManually(modelName, `/assets/models/${modelName}.gltf`);
    });

    index += batch.length;

    if (index < priorityModels.length) {
      setTimeout(loadNextBatch, 200); // Spread out the loading
    }
  };

  loadNextBatch();
};

// Set up intersection observer to load models when containers become visible
const setupVisibilityPreloader = () => {
  // Only run if IntersectionObserver is available
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const modelContainer = entry.target;
          const modelName = modelContainer.dataset.modelName;

          if (modelName) {
            loadModelManually(modelName, `/assets/models/${modelName}.gltf`);
          }

          // Stop observing once we've loaded the model
          observer.unobserve(modelContainer);
        }
      });
    },
    {
      threshold: 0.1, // Start loading when 10% of the element is visible
      rootMargin: "200px", // Load when within 200px of viewport
    }
  );

  // Find model containers and observe them
  setTimeout(() => {
    document.querySelectorAll("[data-model-container]").forEach((container) => {
      observer.observe(container);
    });
  }, 500);
};

// Setup global model loading tracker
const setupModelLoadTracker = () => {
  window.modelLoadTracker = {
    loaded: new Set(),
    errors: new Set(),
    markLoaded: (id) => {
      if (id) window.modelLoadTracker.loaded.add(id);
    },
    markError: (id) => {
      if (id) window.modelLoadTracker.errors.add(id);
    },
    getStats: () => ({
      loaded: Array.from(window.modelLoadTracker.loaded),
      errors: Array.from(window.modelLoadTracker.errors),
      totalLoaded: window.modelLoadTracker.loaded.size,
      totalErrors: window.modelLoadTracker.errors.size,
    }),
  };
};

// Get optimized model settings based on device capabilities
export const getOptimizedModelSettings = () => {
  // Detect device capabilities
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const isLowEnd =
    isMobile ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const browserSupportsWebGL2 = !!document
    .createElement("canvas")
    .getContext("webgl2");

  // Return optimized settings
  return {
    lowQuality: isLowEnd,
    pixelRatio: isLowEnd ? 1 : Math.min(window.devicePixelRatio, 2),
    enableShadows: !isLowEnd && browserSupportsWebGL2,
    maxTextureSize: isLowEnd ? 1024 : 2048,
    targetFPS: isLowEnd ? 30 : 60,
    throttleFPS: isLowEnd ? 30 : 60,
    rotationSpeed: isLowEnd ? 0.5 : 1,
    allowPan: !isLowEnd,
    allowZoom: !isLowEnd,
  };
};

// Function to select the appropriate model for a project
export const selectModelForProject = (project) => {
  if (!project) return { shape: "cube" };

  // Use the existing mapping functionality from projectModelMap
  // This leverages the more sophisticated mapping logic already implemented
  return getModelForProject(project);
};

// Helper function to get models with performance settings
export const getModelWithSettings = (modelName, customSettings = {}) => {
  // Get base settings from device capabilities
  const baseSettings = getOptimizedModelSettings();

  // Merge with custom settings
  const settings = {
    ...baseSettings,
    name: modelName,
    ...customSettings,
  };

  return settings;
};

// Export a higher-level wrapper around the Model component for easier use
export const createOptimizedModelProps = (project, customSettings = {}) => {
  // Get the model recommendation for this project
  const modelRecommendation = selectModelForProject(project);

  // Get optimized settings
  const baseSettings = getOptimizedModelSettings();

  // Return complete props for the Model component
  return {
    name: modelRecommendation.modelName || modelRecommendation.name,
    shape: modelRecommendation.shape || "cube",
    ...baseSettings,
    // Allow custom settings to override defaults
    ...customSettings,
  };
};

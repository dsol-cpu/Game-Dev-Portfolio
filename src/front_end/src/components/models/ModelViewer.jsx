// ModelViewer.jsx - SolidJS component using enhanced resource manager
import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as ResourceManager from "../../stores/modelResourceManager";

const ModelViewer = (props) => {
  const {
    modelId,
    modelUrl,
    width = "100%",
    height = "300px",
    autoRotate = true,
    controlsEnabled = true,
    visible = true,
    onLoaded = () => {},
    onError = () => {},
  } = props;

  // Local state
  const [loading, setLoading] = createSignal(false);
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [error, setError] = createSignal(null);
  const [model, setModel] = createSignal(null);
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(visible);
  const [availableModels, setAvailableModels] = createSignal([]);
  const [currentModelId, setCurrentModelId] = createSignal(modelId); // Track current model ID
  const [currentModelUrl, setCurrentModelUrl] = createSignal(modelUrl); // Track current URL
  const [pendingLoad, setPendingLoad] = createSignal(false); // Flag to prevent reload loops

  // References
  let containerRef;
  let camera = null;
  let controls = null;
  let animationFrameId = null;
  let rendererContainer = null;

  // Animation loop function
  const animate = () => {
    if (!camera || !containerRef || !isVisible()) return;

    if (controls) {
      controls.update();
    }

    // Use the resource manager's render function with our camera and the renderer's DOM element container
    ResourceManager.render(camera, rendererContainer);

    animationFrameId = requestAnimationFrame(animate);
  };

  // Setup the camera and controls
  const setupCameraAndControls = () => {
    if (!containerRef) return;

    // Create perspective camera
    const aspect = containerRef.clientWidth / containerRef.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.z = 5;

    // Get or create the container for the renderer
    rendererContainer = document.createElement("div");
    rendererContainer.style.width = "100%";
    rendererContainer.style.height = "100%";
    rendererContainer.style.position = "absolute";
    rendererContainer.style.top = "0";
    rendererContainer.style.left = "0";

    // Clear the container and add our renderer element
    containerRef.innerHTML = "";
    containerRef.appendChild(rendererContainer);

    // Create orbit controls if enabled
    if (controlsEnabled) {
      controls = new OrbitControls(camera, rendererContainer);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 1.0;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 1;
      controls.maxDistance = 20;
    }

    // Set initial camera position for better viewing
    camera.position.set(3, 2, 3);
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  };

  // Handle container resize
  const handleResize = () => {
    if (!containerRef || !camera) return;

    const width = containerRef.clientWidth;
    const height = containerRef.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  // Monitor loading progress
  const startProgressMonitoring = () => {
    // Poll console logs for progress updates
    const originalConsoleLog = console.log;
    console.log = function (message) {
      if (typeof message === "string" && message.includes("Loading model")) {
        try {
          const progressMatch = message.match(/(\d+)% complete/);
          if (progressMatch && progressMatch[1]) {
            setLoadingProgress(parseInt(progressMatch[1], 10));
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      originalConsoleLog.apply(console, arguments);
    };

    return () => {
      console.log = originalConsoleLog;
    };
  };

  // Load the model using ResourceManager
  const loadModelFromManager = async () => {
    // Exit if already loading or if model data is missing
    if (pendingLoad() || (!modelId && !modelUrl)) {
      return;
    }

    // Set loading flag to prevent re-entrancy
    setPendingLoad(true);

    try {
      setLoading(true);
      setError(null);

      // Save current IDs to prevent reactivity issues
      const id = modelId;
      const url = modelUrl;

      // Store these as current model details
      setCurrentModelId(id);
      setCurrentModelUrl(url);

      // Restore original console log after loading
      const restoreConsoleLog = startProgressMonitoring();

      let loadedModel;
      if (id) {
        // Use the preloaded models from the enhanced manager
        loadedModel = await ResourceManager.getModel(id);
      } else if (url) {
        // Custom URL with generated ID
        const generatedId = `custom-${url.split("/").pop()}`;
        loadedModel = await ResourceManager.loadModel(url, generatedId);
      }

      // Clean up any previous model from the scene
      if (model()) {
        ResourceManager.getScene().remove(model());
      }

      // Center the model in the view
      const box = new THREE.Box3().setFromObject(loadedModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Adjust camera and controls based on model size
      const maxDim = Math.max(size.x, size.y, size.z);
      if (controls) {
        camera.position.set(maxDim * 2, maxDim * 1.5, maxDim * 2);
        controls.target.copy(center);
        controls.update();
      }

      // Add the new model to the scene
      ResourceManager.getScene().add(loadedModel);
      setModel(loadedModel);
      setIsInitialized(true);
      onLoaded(loadedModel);

      // Restore original console log
      restoreConsoleLog();
    } catch (err) {
      setError(err.message || "Failed to load model");
      onError(err);
    } finally {
      setLoading(false);
      setPendingLoad(false);
    }
  };

  // Start or stop animation loop based on visibility
  const updateAnimationLoop = () => {
    if (isVisible()) {
      if (!animationFrameId && camera && containerRef) {
        animate();
      }
    } else if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  // Toggle model visibility without reloading
  const updateModelVisibility = () => {
    const currentModel = model();

    if (currentModel) {
      // If we have a model, just toggle its visibility
      currentModel.visible = isVisible();
    }

    // Update animation loop based on visibility
    updateAnimationLoop();
  };

  // Initialize on mount
  onMount(async () => {
    // Initialize the resource manager if not already done
    if (!ResourceManager.isInitialized()) {
      await ResourceManager.init();

      // Get available models after initialization
      const models = ResourceManager.getAvailableModelIds();
      setAvailableModels(models);
    } else {
      // Get available models if already initialized
      const models = ResourceManager.getAvailableModelIds();
      setAvailableModels(models);
    }

    // Setup camera and controls
    setupCameraAndControls();

    // Add resize listener
    window.addEventListener("resize", handleResize);

    // Set initial visibility state
    setIsVisible(visible);

    // Start animation loop if visible
    if (isVisible()) {
      animate();
    }

    // Initial model load - only if we have a model to load
    if (modelId || modelUrl) {
      loadModelFromManager();
    }
  });

  // Clean up on unmount
  onCleanup(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    window.removeEventListener("resize", handleResize);

    // Remove model from scene, but don't dispose it as it's managed
    if (model()) {
      ResourceManager.getScene().remove(model());
    }

    // Dispose controls
    if (controls) {
      controls.dispose();
    }
  });

  // Effect to handle changes to modelId or modelUrl props
  createEffect(() => {
    // Extract new values
    const newId = props.modelId;
    const newUrl = props.modelUrl;

    // Only reload if the model has actually changed and we're not already loading
    const hasModelChanged =
      !pendingLoad() &&
      (newId !== currentModelId() || newUrl !== currentModelUrl());

    if (hasModelChanged && (newId || newUrl)) {
      // Trigger a model reload
      loadModelFromManager();
    }
  });

  // Effect to handle visibility changes
  createEffect(() => {
    // Check if visibility has changed
    const newVisibility = props.visible;

    if (isVisible() !== newVisibility) {
      setIsVisible(newVisibility);

      // If becoming visible and we need to load the model, do it now
      if (newVisibility && !isInitialized() && (modelId || modelUrl)) {
        loadModelFromManager();
      } else {
        // Just update visibility of existing model
        updateModelVisibility();
      }
    }
  });

  // Effect to update controls when autoRotate prop changes
  createEffect(() => {
    if (controls) {
      controls.autoRotate = props.autoRotate;
    }
  });

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: "relative",
        visibility: isVisible() ? "visible" : "hidden",
        opacity: isVisible() ? 1 : 0,
        overflow: "hidden", // Prevent scrollbars
      }}
      data-model-id={modelId || "custom"}
    >
      <Show when={loading() && isVisible()}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            fontSize: "14px",
            zIndex: 10,
          }}
        >
          Loading: {loadingProgress()}%
        </div>
      </Show>

      <Show when={error() && isVisible()}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(255,0,0,0.7)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            fontSize: "14px",
            zIndex: 10,
          }}
        >
          Error: {error()}
        </div>
      </Show>
    </div>
  );
};

export default ModelViewer;

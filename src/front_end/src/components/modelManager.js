import * as THREE from "three";
import { createStore } from "solid-js/store";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // Create a store for managing models
const [modelStore, setModelStore] = createStore({
  models: {},
  loading: {},
  errors: {},
  primitiveGeometries: {},
  manager: new THREE.LoadingManager(),
  initialized: false,

  // Animation-related state
  renderers: [],
  scenes: [],
  cameras: [],
  activeModels: {},
  mixers: {},
  controls: {},
  animationSettings: {},
  animationFrameId: null,
  clock: new THREE.Clock(),
  lastFrameTime: 0,
});

// Setup model manager
export const createModelManager = () => {
  if (modelStore.initialized) return modelStore;

  // Initialize primitive geometries
  initializePrimitiveGeometries();

  // Scan the assets directory for models
  scanAndPreloadModels();

  // Initialize animation clock
  modelStore.clock.start();

  setModelStore("initialized", true);
  return modelStore;
};

// Initialize primitive shapes for fallbacks
const initializePrimitiveGeometries = () => {
  const primitives = {
    cube: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.8, 32, 32),
    cylinder: new THREE.CylinderGeometry(0.7, 0.7, 1.2, 32),
    cone: new THREE.ConeGeometry(0.8, 1.5, 32),
    torus: new THREE.TorusGeometry(0.7, 0.3, 16, 32),
    plane: new THREE.PlaneGeometry(1.5, 1.5),
  };

  setModelStore("primitiveGeometries", primitives);
};

// Scan for models and preload them
const scanAndPreloadModels = async () => {
  try {
    // In a real environment, this would scan the directory
    // For demo purposes, we'll hardcode some model paths
    const modelFiles = [
      { name: "cube", path: "/assets/models/cube.gltf" },
      { name: "rocket", path: "/assets/models/rocket.gltf" },
      { name: "laptop", path: "/assets/models/laptop.gltf" },
      { name: "robot", path: "/assets/models/robot.gltf" },
      // More models would be defined here or fetched from an API
    ];

    // Set up batch loading
    modelFiles.forEach((model) => {
      setModelStore("loading", model.name, true);
      loadModel(model.name, model.path);
    });
  } catch (error) {
    console.error("Error scanning model directory:", error);
  }
};

// Load a single model
const loadModel = (name, path) => {
  // Determine file type and use appropriate loader
  const loader = getLoaderForFile(path);

  if (!loader) {
    console.error(`No loader available for model: ${path}`);
    setModelStore("errors", name, "Unsupported file format");
    setModelStore("loading", name, false);
    return;
  }

  loader.load(
    path,
    (result) => {
      console.log(`Model loaded: ${name}`);
      setModelStore("models", name, result);
      setModelStore("loading", name, false);
    },
    (progress) => {
      // Optional progress callback
      console.debug(
        `Loading ${name}: ${Math.round((progress.loaded / progress.total) * 100)}%`
      );
    },
    (error) => {
      console.error(`Error loading model ${name}:`, error);
      setModelStore("errors", name, error.message || "Failed to load");
      setModelStore("loading", name, false);
    }
  );
};

const getLoaderForFile = (path) => {
  const extension = path.split(".").pop().toLowerCase();

  switch (extension) {
    case "gltf":
    case "glb":
      return new GLTFLoader(modelStore.manager);
    case "obj":
      return new OBJLoader(modelStore.manager);
    case "fbx":
      return new FBXLoader(modelStore.manager);
    // Add more loaders as needed
    default:
      return null;
  }
};

export const createScene = (container, config) => {
  if (!container) return null;

  const containerId = container.id;

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.backgroundColor);

  // Setup camera
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.position.z = 3;

  // Setup renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: !config.lowPolyMode,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(config.pixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(1, 2, 3);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dirLight2.position.set(-1, -1, -1);
  scene.add(dirLight2);

  const pointLight = new THREE.PointLight(0xffffff, 0.5);
  pointLight.position.set(0, 2, 0);
  scene.add(pointLight);

  // Add controls if enabled
  let controls = null;
  if (config.allowPan || config.allowZoom) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = config.allowZoom;
    controls.enablePan = config.allowPan;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
  }

  // Store everything in our state
  setModelStore("scenes", { ...modelStore.scenes, [containerId]: scene });
  setModelStore("cameras", { ...modelStore.cameras, [containerId]: camera });

  // Add renderer to array if not already present
  if (!modelStore.renderers.includes(renderer)) {
    setModelStore("renderers", [...modelStore.renderers, renderer]);
  }

  if (controls) {
    setModelStore("controls", {
      ...modelStore.controls,
      [containerId]: controls,
    });
  }

  // Handle window resize
  const handleResize = () => {
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener("resize", handleResize);

  return {
    containerId,
    cleanup: () => {
      window.removeEventListener("resize", handleResize);
      unregisterModelFromAnimation(containerId);

      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }

      renderer.dispose();
    },
  };
};

export const loadModelForScene = (containerId, modelName, options = {}) => {
  // Get the scene data for this container
  const scene = modelStore.scenes[containerId];
  if (!scene) {
    console.error(`No scene found for container: ${containerId}`);
    return;
  }

  // Try to get the model
  const loadedModel = getModel(modelName);

  if (loadedModel) {
    // Model is loaded, display it
    displayModelInScene(containerId, loadedModel, options);
  } else if (isModelLoading(modelName)) {
    // Model is still loading, use primitive for now
    displayPrimitiveInScene(containerId, options.shape || "cube", options);

    // Set up a watcher to replace with actual model when ready
    const checkInterval = setInterval(() => {
      const model = getModel(modelName);
      if (model) {
        displayModelInScene(containerId, model, options);
        clearInterval(checkInterval);
      } else if (!isModelLoading(modelName)) {
        // Loading finished but model not available (error)
        clearInterval(checkInterval);
      }
    }, 300);
  } else {
    // Model not found or error occurred, use primitive
    displayPrimitiveInScene(containerId, options.shape || "cube", options);

    if (options.onError) {
      options.onError(`Failed to load model: ${modelName}`);
    }
  }
};

// Display a loaded model in a specific scene
const displayModelInScene = (containerId, loadedModel, options = {}) => {
  const scene = modelStore.scenes[containerId];
  if (!scene) return;

  // Remove any existing model from this scene
  removeModelFromScene(containerId);

  // Clone the model to avoid modifying the cached one
  const model = loadedModel.scene.clone();

  // Center model and adjust scale
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1.5 / maxDim;

  model.position.sub(center);
  model.scale.multiplyScalar(scale);

  scene.add(model);

  // Set up animation mixer if model has animations
  let mixer = null;
  if (loadedModel.animations && loadedModel.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(loadedModel.animations[0]);
    action.play();
  }

  // Register with animation system
  registerModelForScene(containerId, model, mixer, options);

  // Notify of successful load if callback provided
  if (options.onLoaded) {
    options.onLoaded();
  }
};

// Display a primitive shape in a scene
const displayPrimitiveInScene = (containerId, shape = "cube", options = {}) => {
  const scene = modelStore.scenes[containerId];
  if (!scene) return;

  // Remove any existing model
  removeModelFromScene(containerId);

  const geometry = getPrimitiveGeometry(shape);

  // Create material based on variant
  let material;
  switch (options.variant) {
    case "wireframe":
      material = new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0x00aaff,
      });
      break;
    case "shiny":
      material = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        metalness: 0.9,
        roughness: 0.1,
      });
      break;
    case "primary":
    default:
      material = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        metalness: 0.5,
        roughness: 0.5,
      });
  }

  const model = new THREE.Mesh(geometry, material);
  scene.add(model);

  // Register with animation system
  registerModelForScene(containerId, model, null, options);
};

// Remove any existing model from a scene
const removeModelFromScene = (containerId) => {
  const scene = modelStore.scenes[containerId];
  if (!scene) return;

  // Find and remove the current model if it exists
  if (modelStore.activeModels[containerId]?.model) {
    const model = modelStore.activeModels[containerId].model;
    scene.remove(model);

    // Clean up geometry and materials
    model.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
};

// Register a model with the animation system, using scene data from the store
const registerModelForScene = (
  containerId,
  model,
  mixer = null,
  options = {}
) => {
  // Store the new model reference
  setModelStore("activeModels", containerId, {
    model,
    instanceId: containerId,
  });

  // Store mixer if provided
  if (mixer) {
    setModelStore("mixers", {
      ...modelStore.mixers,
      [containerId]: mixer,
    });
  }

  // Store animation settings
  setModelStore("animationSettings", {
    ...modelStore.animationSettings,
    [containerId]: {
      rotate: options.rotate !== undefined ? options.rotate : true,
      rotationSpeed: options.rotationSpeed || 1,
      pulse: options.pulse !== undefined ? options.pulse : false,
      throttleFPS: options.throttleFPS || 60,
    },
  });

  // Apply initial transformations
  if (model) {
    if (options.rotate) {
      model.rotation.y = globalAnimationState.rotationY * options.rotationSpeed;
    }
    if (options.pulse) {
      const pulseFactor = Math.sin(globalAnimationState.pulsePhase) * 0.05 + 1;
      model.scale.set(pulseFactor, pulseFactor, pulseFactor);
    }
  }

  // Start animation loop if not already running
  if (!modelStore.animationFrameId) {
    startAnimationLoop();
  }
};

// Manually load a model that wasn't preloaded
export const loadModelManually = (name, path) => {
  if (modelStore.models[name] || modelStore.loading[name]) {
    return; // Already loaded or loading
  }

  setModelStore("loading", name, true);
  loadModel(name, path);
};

// Get a model by name
export const getModel = (name) => {
  return modelStore.models[name];
};

// Check if a model is loading
export const isModelLoading = (name) => {
  return !!modelStore.loading[name];
};

// Check if there was an error loading a model
export const hasModelError = (name) => {
  return !!modelStore.errors[name];
};

// Get primitive geometry for fallbacks
export const getPrimitiveGeometry = (shape = "cube") => {
  return (
    modelStore.primitiveGeometries[shape] || modelStore.primitiveGeometries.cube
  );
};

export const createModelScene = (containerId, config) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.backgroundColor);

  // Setup camera
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.position.z = 3;

  // Setup renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: !config.lowPolyMode,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(config.pixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Add lighting
  // ... lighting setup code ...

  // Add controls
  let controls = null;
  if (config.allowPan || config.allowZoom) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = config.allowZoom;
    controls.enablePan = config.allowPan;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
  }

  // Store in our state
  const id = containerId;
  setModelStore("scenes", { ...modelStore.scenes, [id]: scene });
  setModelStore("cameras", { ...modelStore.cameras, [id]: camera });
  setModelStore("renderers", [...modelStore.renderers, renderer]);
  if (controls) {
    setModelStore("controls", { ...modelStore.controls, [id]: controls });
  }

  // Setup resize handler
  const handleResize = () => {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener("resize", handleResize);

  // Return scene info for further use
  return {
    id,
    scene,
    camera,
    renderer,
    controls,
    cleanup: () => {
      window.removeEventListener("resize", handleResize);
      unregisterModelFromAnimation(id);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
};

// Register a rendered model instance for animation
export const registerModelForAnimation = (id, sceneData) => {
  const { model, config } = sceneData;

  setModelStore("activeModels", id, { model, instanceId: id });

  if (model) {
    if (config.rotate) {
      model.rotation.y = globalAnimationState.rotationY * config.rotationSpeed;
    }
    if (config.pulse) {
      const pulseFactor = Math.sin(globalAnimationState.pulsePhase) * 0.05 + 1;
      model.scale.set(pulseFactor, pulseFactor, pulseFactor);
    }
  }

  if (renderer) {
    // Store renderer in array if not already present
    if (!modelStore.renderers.includes(renderer)) {
      setModelStore("renderers", [...modelStore.renderers, renderer]);
    }
  }

  if (scene) {
    setModelStore("scenes", { ...modelStore.scenes, [id]: scene });
  }

  if (camera) {
    setModelStore("cameras", { ...modelStore.cameras, [id]: camera });
  }

  if (mixer) {
    setModelStore("mixers", { ...modelStore.mixers, [id]: mixer });
  }

  if (controls) {
    setModelStore("controls", { ...modelStore.controls, [id]: controls });
  }

  // Store animation settings
  setModelStore("animationSettings", {
    ...modelStore.animationSettings,
    [id]: {
      rotate: config.rotate !== undefined ? config.rotate : true,
      rotationSpeed: config.rotationSpeed || 1,
      pulse: config.pulse !== undefined ? config.pulse : false,
      throttleFPS: config.throttleFPS || 60,
    },
  });

  // Start animation loop if not already running
  if (!modelStore.animationFrameId) {
    startAnimationLoop();
  }

  return id;
};

// Unregister a model from animation
export const unregisterModelFromAnimation = (id) => {
  // Remove model from active models
  const { activeModels, scenes, cameras, mixers, controls, animationSettings } =
    modelStore;

  const updatedActiveModels = { ...activeModels };
  delete updatedActiveModels[id];
  setModelStore("activeModels", updatedActiveModels);

  const updatedScenes = { ...scenes };
  delete updatedScenes[id];
  setModelStore("scenes", updatedScenes);

  const updatedCameras = { ...cameras };
  delete updatedCameras[id];
  setModelStore("cameras", updatedCameras);

  const updatedMixers = { ...mixers };
  delete updatedMixers[id];
  setModelStore("mixers", updatedMixers);

  const updatedControls = { ...controls };
  delete updatedControls[id];
  setModelStore("controls", updatedControls);

  const updatedAnimationSettings = { ...animationSettings };
  delete updatedAnimationSettings[id];
  setModelStore("animationSettings", updatedAnimationSettings);

  // Stop animation loop if no models left to animate
  if (
    Object.keys(updatedActiveModels).length === 0 &&
    modelStore.animationFrameId
  ) {
    stopAnimationLoop();
  }
};

// Global animation state
const globalAnimationState = {
  rotationY: 0,
  pulsePhase: 0,
  lastUpdateTime: Date.now(),
};

// Global animation loop
const startAnimationLoop = () => {
  let localAnimationFrameId = null;

  const animate = () => {
    const currentTime = Date.now();
    const deltaTime =
      (currentTime - globalAnimationState.lastUpdateTime) / 1000;

    // Update global animation state
    globalAnimationState.rotationY += 0.005 * deltaTime * 60; // Base rotation speed
    globalAnimationState.pulsePhase = (currentTime * 0.003) % (Math.PI * 2);
    globalAnimationState.lastUpdateTime = currentTime;

    // Only process visible models for rendering
    Object.entries(modelStore.activeModels).forEach(([id, { model }]) => {
      if (!model) return;

      const settings = modelStore.animationSettings[id];
      if (!settings) return;

      // Apply synchronized rotation
      if (settings.rotate) {
        model.rotation.y =
          globalAnimationState.rotationY * settings.rotationSpeed;
      }

      // Apply synchronized pulse
      if (settings.pulse) {
        const pulseFactor =
          Math.sin(globalAnimationState.pulsePhase) * 0.05 + 1;
        model.scale.set(pulseFactor, pulseFactor, pulseFactor);
      }

      // Update mixer for animations
      const mixer = modelStore.mixers[id];
      if (mixer) {
        mixer.update(modelStore.clock.getDelta());
      }

      // Update controls
      const controls = modelStore.controls[id];
      if (controls) {
        controls.update();
      }

      // Render scene
      const scene = modelStore.scenes[id];
      const camera = modelStore.cameras[id];
      const renderer = modelStore.renderers.find(
        (r) =>
          r.domElement.parentElement && r.domElement.parentElement.id === id
      );

      if (scene && camera && renderer) {
        renderer.render(scene, camera);
      }
    });

    // Continue animation loop
    localAnimationFrameId = requestAnimationFrame(animate);
    setModelStore("animationFrameId", localAnimationFrameId);
  };

  // Start the animation loop
  localAnimationFrameId = requestAnimationFrame(animate);
  setModelStore("animationFrameId", localAnimationFrameId);
};

const stopAnimationLoop = () => {
  if (modelStore.animationFrameId) {
    cancelAnimationFrame(modelStore.animationFrameId);
    setModelStore("animationFrameId", null);
  }
};

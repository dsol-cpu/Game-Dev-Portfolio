// stores/modelResourceManager.js - Function-based Three.js resource management with Vite preloading
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// Use Vite's import.meta.glob to automatically find all GLB files in the assets directory
const modelFiles = import.meta.glob("/src/assets/models/*.glb", {
  eager: false,
});

// Create a module object to hold our state
const ResourceManager = {
  // Private variables
  _renderer: null,
  _scene: null,
  _initialized: false,

  // Model cache for reusing loaded models
  _modelCache: new Map(),
  _loadingPromises: new Map(),
  _gltfLoader: new GLTFLoader(),
  _modelMap: new Map(), // Maps model IDs to their file paths

  // Initialize shared resources
  async init() {
    if (this._initialized) return;

    console.log("[ResourceManager] Initializing shared Three.js resources");

    // Build model map from Vite glob imports
    for (const path in modelFiles) {
      // Extract ID from filename (remove path and extension)
      const filename = path.split("/").pop();
      const id = filename.replace(".glb", "");
      this._modelMap.set(id, path);
      console.log(`[ResourceManager] Registered model: ${id} -> ${path}`);
    }

    // Create shared WebGLRenderer with good defaults for performance
    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    this._renderer.outputEncoding = THREE.sRGBEncoding;
    this._renderer.physicallyCorrectLights = true;
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit for performance

    // Create shared scene
    this._scene = new THREE.Scene();
    this._scene.background = null; // Transparent background

    // Add ambient light to the scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this._scene.add(ambientLight);

    // Add directional lights for better model visibility
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight1.position.set(1, 2, 3);
    this._scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight2.position.set(-1, -1, -2);
    this._scene.add(dirLight2);

    // Begin preloading all models
    this._preloadModels();

    this._initialized = true;
    console.log("[ResourceManager] Initialization complete");
  },

  // Preload all models found by Vite's import.meta.glob
  async _preloadModels() {
    console.log(
      `[ResourceManager] Starting preload of ${this._modelMap.size} models`
    );

    // Create an array of load promises
    const loadPromises = [];

    for (const [id, path] of this._modelMap.entries()) {
      // Only start preloading if not already in cache or loading
      if (!this._modelCache.has(id) && !this._loadingPromises.has(id)) {
        loadPromises.push(this._preloadSingleModel(id, path));
      }
    }

    // Wait for all models to preload
    try {
      await Promise.allSettled(loadPromises);
      console.log("[ResourceManager] All models preloaded");
    } catch (error) {
      console.warn("[ResourceManager] Some models failed to preload:", error);
    }
  },

  // Preload a single model
  async _preloadSingleModel(id, path) {
    console.log(`[ResourceManager] Preloading model: ${id}`);
    try {
      // Import the module (this triggers the actual dynamic import)
      const moduleLoader = modelFiles[path];
      const module = await moduleLoader();
      const url = module.default; // The default export is the URL

      // Load the model using its URL
      await this.loadModel(url, id);
      console.log(`[ResourceManager] Successfully preloaded model: ${id}`);
    } catch (error) {
      console.error(`[ResourceManager] Failed to preload model ${id}:`, error);
      throw error;
    }
  },

  // Load a model and store in cache
  loadModel(url, id) {
    // Return cached promise if this model is currently loading
    if (this._loadingPromises.has(id)) {
      console.log(
        `[ResourceManager] Model ${id} is already loading, returning existing promise`
      );
      return this._loadingPromises.get(id);
    }

    // Return cached model if available
    if (this._modelCache.has(id)) {
      console.log(
        `[ResourceManager] Model ${id} found in cache, returning clone`
      );
      return Promise.resolve(this._modelCache.get(id).clone());
    }

    console.log(`[ResourceManager] Loading model from URL: ${url}`);

    // Load the model
    const loadPromise = new Promise((resolve, reject) => {
      this._gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Add resource tracking
          model._resourceId = id;
          model._resourceUrl = url;

          // Center and scale the model to fit in view
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          // Use the largest dimension to normalize scale
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1 / maxDim;

          model.position.sub(center);
          model.scale.multiplyScalar(scale);

          // Enable shadows on model
          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Improve material quality if needed
              if (node.material) {
                node.material.depthWrite = true;
                node.material.needsUpdate = true;
              }
            }
          });

          // Store in cache
          this._modelCache.set(id, model);
          this._loadingPromises.delete(id);

          console.log(`[ResourceManager] Model ${id} loaded successfully`);
          resolve(model.clone());
        },
        // Progress callback
        (xhr) => {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          console.log(
            `Loading model ${id}: ${Math.round(percentComplete)}% complete`
          );
        },
        // Error callback
        (error) => {
          console.error(`Error loading model ${id}:`, error);
          this._loadingPromises.delete(id);
          reject(error);
        }
      );
    });

    // Store the promise to avoid duplicate loads
    this._loadingPromises.set(id, loadPromise);
    return loadPromise;
  },

  // Get model by ID (returns a promise for a model clone)
  async getModel(id) {
    console.log(`[ResourceManager] Getting model with ID: ${id}`);

    // Check if we have this model registered
    if (!this._modelMap.has(id)) {
      console.error(`[ResourceManager] No model found with ID: ${id}`);
      return Promise.reject(new Error(`Model with ID '${id}' not found`));
    }

    if (this._modelCache.has(id)) {
      // Return a clone of the cached model
      console.log(`[ResourceManager] Returning cached model ${id}`);
      return Promise.resolve(this._modelCache.get(id).clone());
    } else if (this._loadingPromises.has(id)) {
      // Wait for model to finish loading
      console.log(`[ResourceManager] Model ${id} is currently loading`);
      return this._loadingPromises.get(id);
    } else {
      // Load the model on demand
      console.log(`[ResourceManager] Loading model ${id} on demand`);
      const path = this._modelMap.get(id);

      try {
        // Import the module
        const moduleLoader = modelFiles[path];
        const module = await moduleLoader();
        const url = module.default;

        // Load the model using its URL
        return this.loadModel(url, id);
      } catch (error) {
        console.error(`[ResourceManager] Failed to load model ${id}:`, error);
        return Promise.reject(error);
      }
    }
  },

  // Get all available model IDs
  getAvailableModelIds() {
    return Array.from(this._modelMap.keys());
  },

  // Get the shared scene
  getScene() {
    return this._scene;
  },

  // Render with specific camera to a specific canvas
  render(camera, canvas) {
    if (!this._renderer || !this._scene || !canvas) return;

    // Resize renderer if necessary
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const needsResize = canvas.width !== width || canvas.height !== height;

    if (needsResize) {
      this._renderer.setSize(width, height, false);
      canvas.width = width;
      canvas.height = height;
    }

    // Set the canvas as the output target
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this._renderer.domElement !== canvas) {
      canvas.appendChild(this._renderer.domElement);
    }

    // Render the scene
    this._renderer.render(this._scene, camera);
  },

  // Check if manager is initialized
  isInitialized() {
    return this._initialized;
  },

  // Clean up resources
  dispose() {
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }

    if (this._scene) {
      this._scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this._scene = null;
    }

    this._modelCache.clear();
    this._loadingPromises.clear();
    this._modelMap.clear();
    this._initialized = false;
  },
};

// Export individual functions to maintain the function-based API
export const init = () => ResourceManager.init();
export const loadModel = (url, id) => ResourceManager.loadModel(url, id);
export const getModel = (id) => ResourceManager.getModel(id);
export const getScene = () => ResourceManager.getScene();
export const render = (camera, canvas) =>
  ResourceManager.render(camera, canvas);
export const isInitialized = () => ResourceManager.isInitialized();
export const dispose = () => ResourceManager.dispose();
export const getAvailableModelIds = () =>
  ResourceManager.getAvailableModelIds();

// Export the manager as default for convenience
export default ResourceManager;

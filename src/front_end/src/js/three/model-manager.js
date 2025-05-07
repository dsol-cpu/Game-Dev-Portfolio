/**
 * @fileoverview Simplified model manager for Three.js applications.
 * Handles model loading, caching, and memory management.
 */

import {
  BoxGeometry,
  MeshNormalMaterial,
  Mesh,
  Box3,
  Vector3,
} from "../extern/three/three.module.min.js";

import { GLTFLoader } from "../extern/three/GLTFLoader.js";

// Configuration constants
const CONFIG = {
  FALLBACK_CUBE_NAME: "fallbackCube",
  MODEL_LOAD_TIMEOUT: 10000, // ms
};

// Create a single shared fallback cube
const FALLBACK_CUBE = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshNormalMaterial()
);

// Simple state management
const state = {
  models: {},
  modelLoadPromises: {},
  modelPositions: {},
};

/**
 * Get the shared fallback cube
 */
function getFallbackCube() {
  return FALLBACK_CUBE;
}

/**
 * Get a model with simplified caching
 * If the model is already loaded or loading, returns the existing instance
 */
async function getModel(modelName) {
  // Use fallback if no model name provided
  if (!modelName) return getFallbackCube();

  // Return from cache if available
  if (state.models[modelName]) {
    return state.models[modelName];
  }

  // Return existing promise if already loading
  if (state.modelLoadPromises[modelName]) {
    return state.modelLoadPromises[modelName];
  }

  // Start new load process
  const modelUrl = `/models/${modelName}.glb`;
  const loadPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();

    // Setup loading timeout
    const timeoutId = setTimeout(() => {
      if (!state.models[modelName]) {
        console.warn(`Model load timeout: ${modelName}`);
        const fallback = getFallbackCube();
        state.models[modelName] = fallback;
        resolve(fallback);
      }
    }, CONFIG.MODEL_LOAD_TIMEOUT);

    // Load the model
    loader.load(
      modelUrl,
      (gltf) => {
        clearTimeout(timeoutId);
        const model = gltf.scene;
        state.models[modelName] = model;
        setupModel(model);
        console.log(`Loaded model: ${modelName}`);
        resolve(model);
      },
      undefined,
      (error) => {
        clearTimeout(timeoutId);
        console.error(`Model failed to load: ${modelName}`, error);
        const fallback = getFallbackCube();
        state.models[modelName] = fallback;
        resolve(fallback);
      }
    );
  });

  state.modelLoadPromises[modelName] = loadPromise;

  // Clean up the promise reference once loaded
  loadPromise.then(() => {
    delete state.modelLoadPromises[modelName];
  });

  return loadPromise;
}

/**
 * Setup model transformations
 */
function setupModel(model) {
  if (!model) return;

  // Center and normalize model size
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  // Center the model
  model.position.sub(center);
  model.position.y += size.y * 0.1;

  // Scale to normalized size if needed
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && (maxDim < 0.5 || maxDim > 2)) {
    const scale = 1 / maxDim;
    model.scale.multiplyScalar(scale);
  }

  // Add random rotation for variety
  model.rotation.y = Math.random() * Math.PI * 2;
}

/**
 * Dispose model and free resources
 */
function disposeModel(modelName, scene = null) {
  if (!state.models[modelName]) return;

  const model = state.models[modelName];

  // Don't dispose the fallback cube
  if (model === FALLBACK_CUBE) {
    delete state.models[modelName];
    return;
  }

  // Remove from scene if provided
  if (scene && model.parent === scene) {
    scene.remove(model);
  }

  // Dispose geometries and materials
  model.traverse((child) => {
    if (child.isMesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose material
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });

  delete state.models[modelName];
}

/**
 * Calculate model positions in a grid layout
 */
function calculateModelPositions(modelNames = [], gridSize = 525) {
  // If no model names provided, use existing models
  if (modelNames.length === 0) {
    modelNames = Object.keys(state.models);
  }

  // Calculate grid dimensions
  const gridSide = Math.ceil(Math.sqrt(modelNames.length));

  // Position models in grid
  modelNames.forEach((name, index) => {
    const row = Math.floor(index / gridSide);
    const col = index % gridSide;

    const offsetX = (col - (gridSide - 1) / 2) * gridSize;
    const offsetZ = (row - (gridSide - 1) / 2) * gridSize;

    state.modelPositions[name] = new Vector3(offsetX, 0, offsetZ);
  });

  // Ensure fallback cube is at origin
  state.modelPositions[CONFIG.FALLBACK_CUBE_NAME] = new Vector3(0, 0, 0);
}

/**
 * Get model position by name
 */
function getModelPosition(modelName) {
  return state.modelPositions[modelName] || new Vector3(0, 0, 0);
}

/**
 * Update model position based on stored positions
 */
function updateModelPosition(modelName) {
  if (modelName && state.models[modelName] && state.modelPositions[modelName]) {
    const model = state.models[modelName];
    const position = state.modelPositions[modelName];
    model.position.set(position.x, position.y, position.z);
    return;
  }

  // Update all models' positions
  Object.entries(state.models).forEach(([name, model]) => {
    const position = state.modelPositions[name];
    if (position) {
      model.position.set(position.x, position.y, position.z);
    }
  });
}

/**
 * Update model scale
 */
function updateModelScale(modelName, scale) {
  const model = state.models[modelName];
  if (model) {
    model.scale.set(scale, scale, scale);
  }
}

/**
 * Preload a list of models
 */
function preloadModels(modelNames = []) {
  if (!Array.isArray(modelNames) || modelNames.length === 0) return;

  // Load each model in parallel
  modelNames.forEach((name) => {
    if (typeof name === "string" && name.trim() !== "") {
      getModel(name).catch((err) => {
        console.warn(`Failed to preload model: ${name}`, err);
      });
    }
  });
}

/**
 * Get all currently loaded models
 */
function getLoadedModels() {
  return { ...state.models };
}

// Export public API
export {
  getModel,
  preloadModels,
  calculateModelPositions,
  getModelPosition,
  updateModelPosition,
  updateModelScale,
  getFallbackCube,
  getLoadedModels,
  disposeModel,
};

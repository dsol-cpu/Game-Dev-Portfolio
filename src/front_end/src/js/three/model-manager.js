/**
 * @fileoverview Model manager for Three.js applications.
 * Handles model loading, caching, optimization, and memory management.
 */

import {
  BoxGeometry,
  MeshNormalMaterial,
  Mesh,
  Box3,
  Vector3,
  LinearFilter,
} from "../extern/three/three.module.min.js";

// Constants
const BATCH_SIZE = 3;
const GRID_SIZE = 512;
const FALLBACK_CUBE_NAME = "fallbackCube";
const MODEL_CLEANUP_THRESHOLD = 10000; // ms to keep unused models in memory

// State
const models = {};
const modelLoadPromises = {};
const disposedModels = new Set();
const unusedModelTimers = {};
const modelPositions = {};
const modelCache = new Map();
let sharedFallbackCube = null;
let GLTFLoader = null;

/**
 * Create and return a shared fallback cube for failed model loads
 * @returns {Mesh} The fallback cube
 */
function createSharedFallbackCube() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshNormalMaterial();
  sharedFallbackCube = new Mesh(geometry, material);
  sharedFallbackCube.name = FALLBACK_CUBE_NAME;
  return sharedFallbackCube;
}

/**
 * Create a fallback cube for a specific model
 * @param {string} modelName - The name of the model
 * @returns {Mesh} A fallback cube for the model
 */
function createFallbackCube(modelName) {
  // Create a unique fallback cube for this model
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshNormalMaterial();
  const cube = new Mesh(geometry, material);
  cube.name = `${modelName}-fallback`;

  // Position it based on the model grid
  const position = getModelPosition(modelName);
  cube.position.set(position.x, position.y, position.z);

  return cube;
}

/**
 * Get a model with caching
 * @param {string} modelName - The name of the model to load
 * @returns {Promise<THREE.Object3D>} The loaded model
 */
async function getModel(modelName) {
  // Use fallback if no model name provided
  if (!modelName) return getFallbackCube();

  // Return from cache if available
  if (modelCache.has(modelName)) {
    // Clear unused timer if it exists
    if (unusedModelTimers[modelName]) {
      clearTimeout(unusedModelTimers[modelName]);
      delete unusedModelTimers[modelName];
    }
    return modelCache.get(modelName);
  }

  try {
    // Load the model
    const model = await loadModel(modelName);

    if (model) {
      modelCache.set(modelName, model);

      // Clear unused timer if it exists
      if (unusedModelTimers[modelName]) {
        clearTimeout(unusedModelTimers[modelName]);
        delete unusedModelTimers[modelName];
      }
    }
    return model;
  } catch (e) {
    console.warn(`Failed to load model: ${modelName}`, e);
    return getFallbackCube();
  }
}

/**
 * Load a model with improved caching and error handling
 * @param {string} modelName - The name of the model to load
 * @returns {Promise<THREE.Object3D>} The loaded model
 */
async function loadModel(modelName) {
  // If model was disposed, remove from disposed list
  if (disposedModels.has(modelName)) {
    disposedModels.delete(modelName);
  }

  // Return cached model if available
  if (models[modelName]) return models[modelName];
  if (modelLoadPromises[modelName]) return modelLoadPromises[modelName];

  // Load the GLTFLoader if not already loaded
  if (!GLTFLoader) {
    try {
      const module = await import("../extern/three/GLTFLoader.js");
      GLTFLoader = module.GLTFLoader;
    } catch (error) {
      console.error("Failed to load GLTFLoader:", error);
      return createFallbackCube(modelName);
    }
  }

  // Create loading promise with timeout
  const modelUrl = `/models/${modelName}.glb`;
  const loadPromise = Promise.race([
    new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          models[modelName] = model;
          setupModel(model);
          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`Model failed to load: ${modelName}`, error);
          const fallback = createFallbackCube(modelName);
          models[modelName] = fallback;
          resolve(fallback);
        }
      );
    }),
    // Timeout after 10 seconds
    new Promise((resolve) => {
      setTimeout(() => {
        if (!models[modelName]) {
          const fallback = createFallbackCube(modelName);
          models[modelName] = fallback;
          resolve(fallback);
        }
      }, 10000);
    }),
  ]);

  modelLoadPromises[modelName] = loadPromise;
  return loadPromise;
}

/**
 * Load models in batches with priority and scheduling
 * @param {Array<string>} priorityModels - Models to load first
 * @returns {Promise<void>} Promise that resolves when priorityModels are loaded
 */
async function preloadProjectModels(priorityModels = [], allModelNames = []) {
  if (allModelNames.length === 0) return;

  // Create load queue with priority models first
  const loadQueue = [
    ...priorityModels.filter((name) => allModelNames.includes(name)),
    ...allModelNames.filter((name) => !priorityModels.includes(name)),
  ];

  // Load in batches using requestIdleCallback for background loading
  const loadBatch = async (startIndex) => {
    const batch = loadQueue.slice(startIndex, startIndex + BATCH_SIZE);
    if (batch.length === 0) return;

    try {
      await Promise.allSettled(batch.map((name) => loadModel(name)));

      // Schedule next batch during idle time
      if (startIndex + BATCH_SIZE < loadQueue.length) {
        if (window.requestIdleCallback) {
          requestIdleCallback(() => loadBatch(startIndex + BATCH_SIZE));
        } else {
          setTimeout(() => loadBatch(startIndex + BATCH_SIZE), 100);
        }
      }
    } catch (error) {
      console.error("Error loading model batch:", error);
    }
  };

  // Start loading priority models immediately
  const priorityBatchSize = Math.min(BATCH_SIZE, priorityModels.length);
  await loadBatch(0);

  // Schedule remaining models for idle time
  if (loadQueue.length > priorityBatchSize) {
    if (window.requestIdleCallback) {
      requestIdleCallback(() => loadBatch(priorityBatchSize));
    } else {
      setTimeout(() => loadBatch(priorityBatchSize), 100);
    }
  }
}

/**
 * Setup model transformations with optimized normalization
 * @param {THREE.Object3D} model - The model to setup
 * @param {Object} options - Setup options
 */
function setupModel(model, options = { randomRotation: true }) {
  if (!model) return;

  // Optimize model geometry
  optimizeModel(model);

  // Center and normalize model size efficiently
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  // Only adjust position if significantly off-center
  if (center.length() > 0.01) {
    model.position.sub(center);
  }

  model.position.y += size.y * 0.1;

  // Scale to normalized size only if needed
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && (maxDim < 0.5 || maxDim > 2)) {
    const scale = 1 / maxDim;
    model.scale.multiplyScalar(scale);
  }

  // Add random rotation if requested
  if (options.randomRotation) {
    model.rotation.y = Math.random() * Math.PI * 2;
  }

  // Enable shadows only if needed
  if (options.enableShadows) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
}

/**
 * Optimize model geometry and materials with advanced techniques
 * @param {THREE.Object3D} model - The model to optimize
 */
function optimizeModel(model) {
  if (!model) return;

  const geometries = {};
  const materials = {};

  model.traverse((child) => {
    if (!child.isMesh) return;

    // Optimize geometry
    const geo = child.geometry;
    if (geo) {
      const geoKey = geo.uuid;
      if (geometries[geoKey]) {
        child.geometry = geometries[geoKey];
      } else if (geo.attributes?.position) {
        if (!geo.attributes?.normal) geo.computeVertexNormals();

        // Optimize buffers
        if (!geo.attributes.position.normalized) {
          geo.attributes.position.normalized = true;
        }

        // Remove unused attributes to save memory
        ["color", "uv2", "uv3"].forEach((attr) => {
          if (geo.attributes[attr] && !child.material.map) {
            geo.deleteAttribute(attr);
          }
        });

        geometries[geoKey] = geo;
      }
    }

    // Optimize material
    const material = child.material;
    if (material) {
      if (Array.isArray(material)) {
        child.material = material.map((mat) => {
          const matKey = mat?.uuid;
          if (!matKey) return mat;
          if (!materials[matKey]) {
            optimizeMaterial(mat);
            materials[matKey] = mat;
          }
          return materials[matKey];
        });
      } else {
        const matKey = material?.uuid;
        if (matKey) {
          if (!materials[matKey]) {
            optimizeMaterial(material);
            materials[matKey] = material;
          }
          child.material = materials[matKey];
        }
      }
    }

    // Optimize mesh
    child.frustumCulled = true;
    child.matrixAutoUpdate = true;
    child.matrixWorldAutoUpdate = false;
  });
}

/**
 * Optimize individual material properties
 * @param {THREE.Material} material - The material to optimize
 */
function optimizeMaterial(material) {
  if (!material) return;

  // Performance optimizations
  material.precision = "lowp"; // lower shader precision
  material.fog = false; // disable fog calculations

  // Reduce texture quality if needed
  if (material.map) {
    material.map.anisotropy = 1;
    material.map.minFilter = LinearFilter;
    material.map.generateMipmaps = false;
  }
}

/**
 * Mark a model as unused for potential cleanup
 * @param {string} modelName - The name of the model to mark as unused
 */
function markModelUnused(modelName) {
  // Clear any existing timer
  if (unusedModelTimers[modelName]) {
    clearTimeout(unusedModelTimers[modelName]);
  }

  // Set timer to clean up model if it remains unused
  unusedModelTimers[modelName] = setTimeout(() => {
    disposeModel(modelName);
  }, MODEL_CLEANUP_THRESHOLD);
}

/**
 * Dispose of a 3D model and free memory
 * @param {string} modelName - The name of the model to dispose
 * @param {THREE.Scene} scene - Optional scene to remove the model from
 */
function disposeModel(modelName, scene = null) {
  if (!models[modelName] || disposedModels.has(modelName)) return;

  const model = models[modelName];

  // Remove from scene if provided
  if (scene && model.parent === scene) {
    scene.remove(model);
  }

  // Dispose geometries and materials
  model.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            disposeMaterial(mat);
          });
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });

  // Mark as disposed but keep reference for reloading
  disposedModels.add(modelName);

  // Log memory cleanup
  console.log(`Disposed model: ${modelName}`);
}

/**
 * Dispose of a material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
  if (!material) return;

  // Dispose textures
  Object.keys(material).forEach((prop) => {
    if (material[prop]?.isTexture) {
      material[prop].dispose();
    }
  });

  // Dispose material
  material.dispose();
}

/**
 * Calculate model positions in a grid layout
 * @param {Array<string>} modelNames - Array of model names
 */
function calculateModelPositions(modelNames = []) {
  // If no model names provided, use existing models
  if (modelNames.length === 0) {
    modelNames = [
      ...Object.keys(models),
      ...Array.from(disposedModels),
      FALLBACK_CUBE_NAME,
    ];
  }

  // Make sure fallback cube is included
  if (!modelNames.includes(FALLBACK_CUBE_NAME)) {
    modelNames.push(FALLBACK_CUBE_NAME);
  }

  // Calculate grid dimensions
  const gridSide = Math.ceil(Math.sqrt(modelNames.length));

  // Position models in grid with better spacing
  modelNames.forEach((name, index) => {
    const row = Math.floor(index / gridSide);
    const col = index % gridSide;

    const offsetX = (col - (gridSide - 1) / 2) * GRID_SIZE;
    const offsetZ = (row - (gridSide - 1) / 2) * GRID_SIZE;

    modelPositions[name] = new Vector3(offsetX, 0, offsetZ);
  });

  // Ensure fallback cube is at origin
  modelPositions[FALLBACK_CUBE_NAME] = new Vector3(0, 0, 0);
}

/**
 * Get model position by name with error handling
 * @param {string} modelName - The name of the model
 * @returns {Vector3} The position of the model
 */
function getModelPosition(modelName) {
  return modelPositions[modelName] || new Vector3(0, 0, 0);
}

/**
 * Update model position based on grid
 * @param {string} modelName - Optional specific model to update
 * @param {THREE.Scene} scene - Optional scene to update model in
 */
function updateModelPosition(modelName = null, scene = null) {
  // Early exit if only one model is being updated
  if (modelName && modelPositions[modelName]) {
    const model = models[modelName];
    if (model) {
      const position = modelPositions[modelName];
      model.position.set(position.x, position.y, position.z);
    }
    return;
  }

  // Update all models' positions
  for (const [name, model] of Object.entries(models)) {
    const position = modelPositions[name];
    if (model && position) {
      model.position.set(position.x, position.y, position.z);
    }
  }
}

/**
 * Get all loaded models
 * @returns {Object} Object containing all loaded models
 */
function getLoadedModels() {
  return models;
}

/**
 * Get shared fallback cube
 * @returns {Mesh} The shared fallback cube
 */
function getFallbackCube() {
  if (!sharedFallbackCube) {
    createSharedFallbackCube();
  }
  return sharedFallbackCube;
}

/**
 * Update model scale
 * @param {string} modelName - The name of the model
 * @param {number} scale - The scale factor
 */
function updateModelScale(modelName, scale) {
  const model = models[modelName];
  if (model) {
    model.scale.set(scale, scale, scale);
  }
}

/**
 * Initialize the model manager
 */
function initModelManager() {
  createSharedFallbackCube();
  calculateModelPositions();
}

export {
  initModelManager,
  getModel,
  preloadProjectModels,
  markModelUnused,
  calculateModelPositions,
  getModelPosition,
  getFallbackCube,
  FALLBACK_CUBE_NAME,
};

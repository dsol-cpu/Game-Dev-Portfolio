/**
 * @fileoverview Optimized model manager for Three.js applications.
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

import { GLTFLoader } from "../extern/three/GLTFLoader.js";

// Constants
const BATCH_SIZE = 3;
const GRID_SIZE = 1024;
const FALLBACK_CUBE_NAME = "fallbackCube";
const MODEL_CLEANUP_THRESHOLD = 10000; // ms
const MODEL_LOAD_TIMEOUT = 10000; // ms

// Shared resources
const sharedFallbackGeometry = new BoxGeometry(1, 1, 1);
const sharedFallbackMaterial = new MeshNormalMaterial();
let sharedFallbackCube = null;

// State
const models = {};
const modelLoadPromises = {};
const disposedModels = new Set();
const unusedModelTimers = {};
const modelPositions = {};
const modelCache = new Map();

/**
 * Create and return a shared fallback cube for failed model loads
 * @returns {Mesh} The fallback cube
 */
function getFallbackCube() {
  if (!sharedFallbackCube) {
    sharedFallbackCube = new Mesh(
      sharedFallbackGeometry,
      sharedFallbackMaterial
    );
    sharedFallbackCube.name = FALLBACK_CUBE_NAME;
  }
  return sharedFallbackCube;
}

/**
 * Create a fallback cube for a specific model
 * @param {string} modelName - The name of the model
 * @returns {Mesh} A fallback cube for the model
 */
function createFallbackCube(modelName) {
  const cube = new Mesh(sharedFallbackGeometry, sharedFallbackMaterial);
  cube.name = `${modelName}-fallback`;
  const position = modelPositions[modelName] || new Vector3(0, 0, 0);
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
    clearModelTimer(modelName);
    return modelCache.get(modelName);
  }

  try {
    const model = await loadModel(modelName);

    if (model) {
      modelCache.set(modelName, model);
      clearModelTimer(modelName);
    }
    return model;
  } catch (e) {
    console.warn(`Failed to load model: ${modelName}`, e);
    return getFallbackCube();
  }
}

/**
 * Clear unused model timer
 * @param {string} modelName - The name of the model
 */
function clearModelTimer(modelName) {
  if (unusedModelTimers[modelName]) {
    clearTimeout(unusedModelTimers[modelName]);
    delete unusedModelTimers[modelName];
  }
}

/**
 * Load a model with improved caching and error handling
 * @param {string} modelName - The name of the model to load
 * @returns {Promise<THREE.Object3D>} The loaded model
 */
async function loadModel(modelName) {
  // If model was disposed, remove from disposed list
  disposedModels.delete(modelName);

  // Return cached model if available
  if (models[modelName]) return models[modelName];
  if (modelLoadPromises[modelName]) return modelLoadPromises[modelName];

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
      }, MODEL_LOAD_TIMEOUT);
    }),
  ]);

  modelLoadPromises[modelName] = loadPromise;
  return loadPromise;
}

/**
 * Load models in batches with priority and scheduling
 * @param {Array<string>} priorityModels - Models to load first
 * @param {Array<string>} allModelNames - All models to potentially load
 * @returns {Promise<void>} Promise that resolves when priorityModels are loaded
 */
async function preloadProjectModels(priorityModels = [], allModelNames = []) {
  if (allModelNames.length === 0) return;
  setPriorityModels(priorityModels);

  // Create load queue with priority models first
  const loadQueue = [
    ...priorityModels.filter((name) => allModelNames.includes(name)),
    ...allModelNames.filter((name) => !priorityModels.includes(name)),
  ];

  // Start loading priority models immediately
  const priorityBatchSize = Math.min(BATCH_SIZE, priorityModels.length);
  await loadBatch(0);

  // Schedule remaining models for idle time
  if (loadQueue.length > priorityBatchSize) {
    scheduleIdleLoad(priorityBatchSize);
  }

  /**
   * Load a batch of models
   * @param {number} startIndex - Starting index in the load queue
   */
  async function loadBatch(startIndex) {
    const batch = loadQueue.slice(startIndex, startIndex + BATCH_SIZE);
    if (batch.length === 0) return;

    try {
      await Promise.allSettled(batch.map((name) => loadModel(name)));

      // Schedule next batch during idle time
      if (startIndex + BATCH_SIZE < loadQueue.length) {
        scheduleIdleLoad(startIndex + BATCH_SIZE);
      }
    } catch (error) {
      console.error("Error loading model batch:", error);
    }
  }

  /**
   * Schedule a load during idle time
   * @param {number} startIndex - Starting index in the load queue
   */
  function scheduleIdleLoad(startIndex) {
    if (window.requestIdleCallback) {
      requestIdleCallback(() => loadBatch(startIndex));
    } else {
      setTimeout(() => loadBatch(startIndex), 100);
    }
  }
}

/**
 * Setup model transformations with optimized normalization
 * @param {THREE.Object3D} model - The model to setup
 * @param {Object} options - Setup options
 */
function setupModel(
  model,
  options = { randomRotation: true, enableShadows: false }
) {
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

    optimizeMesh(child, geometries, materials);
  });
}

/**
 * Optimize an individual mesh
 * @param {THREE.Mesh} mesh - The mesh to optimize
 * @param {Object} geometries - Shared geometries cache
 * @param {Object} materials - Shared materials cache
 */
function optimizeMesh(mesh, geometries, materials) {
  // Optimize geometry
  const geo = mesh.geometry;
  if (geo) {
    const geoKey = geo.uuid;
    if (geometries[geoKey]) {
      mesh.geometry = geometries[geoKey];
    } else if (geo.attributes?.position) {
      if (!geo.attributes?.normal) geo.computeVertexNormals();

      // Optimize buffers
      geo.attributes.position.normalized = true;

      // Remove unused attributes to save memory
      ["color", "uv2", "uv3"].forEach((attr) => {
        if (geo.attributes[attr] && !mesh.material?.map) {
          geo.deleteAttribute(attr);
        }
      });

      geometries[geoKey] = geo;
    }
  }

  // Optimize material
  const material = mesh.material;
  if (!material) return;

  if (Array.isArray(material)) {
    mesh.material = material.map((mat) => {
      const matKey = mat?.uuid;
      if (!matKey) return mat;
      if (!materials[matKey]) {
        optimizeMaterial(mat);
        materials[matKey] = mat;
      }
      return materials[matKey];
    });
  } else {
    const matKey = material.uuid;
    if (!materials[matKey]) {
      optimizeMaterial(material);
      materials[matKey] = material;
    }
    mesh.material = materials[matKey];
  }

  // Optimize mesh
  mesh.frustumCulled = true;
  mesh.matrixAutoUpdate = true;
  mesh.matrixWorldAutoUpdate = false;
}

/**
 * Optimize individual material properties
 * @param {Material} material - The material to optimize
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
  clearModelTimer(modelName);

  // Set timer to clean up model if it remains unused
  unusedModelTimers[modelName] = setTimeout(() => {
    disposeModel(modelName);
  }, MODEL_CLEANUP_THRESHOLD);
}

/**
 *Enhanced model disposal with better memory cleanup
 *@param {string} modelName - The name of the model to dispose
 *@param {THREE.Scene} scene - Optional scene to remove the model from
 */
function disposeModel(modelName, scene = null) {
  if (!models[modelName] || disposedModels.has(modelName)) return;

  const model = models[modelName];

  // Remove from scene if provided
  if (scene && model.parent === scene) {
    scene.remove(model);
  }

  // Dispose geometries and materials with thorough cleanup
  model.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        // Clear geometry buffers
        const attributes = child.geometry.attributes;
        for (const name in attributes) {
          child.geometry.deleteAttribute(name);
        }

        if (child.geometry.index) {
          child.geometry.index = null;
        }

        child.geometry.dispose();
        child.geometry = null;
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            disposeMaterialEnhanced(material);
          });
        } else {
          disposeMaterialEnhanced(child.material);
        }
        child.material = null;
      }
    }

    // Clear any animations, event listeners, or user data
    if (child.animations) {
      child.animations = null;
    }

    child.userData = {};
  });

  // Remove from memory tracking and model cache
  untrackModelMemory(modelName);
  modelCache.delete(modelName);
  delete models[modelName];

  // Mark as disposed
  disposedModels.add(modelName);

  console.log(`Disposed model: ${modelName}`);
}

/**
 * Dispose of a material and its textures
 * @param {Material} material - The material to dispose
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
function updateModelPosition(modelName = null) {
  // Update only specified model
  if (modelName && modelPositions[modelName]) {
    const model = models[modelName];
    if (model) {
      const position = modelPositions[modelName];
      model.position.set(position.x, position.y, position.z);
    }
    return;
  }

  // Update all models' positions
  Object.entries(models).forEach(([name, model]) => {
    const position = modelPositions[name];
    if (model && position) {
      model.position.set(position.x, position.y, position.z);
    }
  });
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

// Memory tracking variables
const memoryUsage = {
  models: {},
  totalBytes: 0,
  lastCleanup: Date.now(),
};

const MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB
const AUTO_GC_INTERVAL = 60000; // 1 minute
let gcIntervalId = null;

/**
 * Start automatic garbage collection
 */
function startAutoGarbageCollection() {
  if (gcIntervalId) return;

  gcIntervalId = setInterval(() => {
    // Only run GC if memory usage is high
    if (memoryUsage.totalBytes > MEMORY_THRESHOLD) {
      collectGarbage();
    }
  }, AUTO_GC_INTERVAL);

  // Add event listeners for detecting when page is hidden
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", () => scheduleGarbageCollection());
  }
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    scheduleGarbageCollection();
  }
}

/**
 * Schedule garbage collection for next idle period
 */
function scheduleGarbageCollection() {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => collectGarbage());
  } else {
    setTimeout(() => collectGarbage(), 1000);
  }
}

/**
 * Run garbage collection on all unused models
 * @param {boolean} aggressive - Whether to use aggressive collection
 */
function collectGarbage(aggressive = false) {
  const now = Date.now();
  const unusedThreshold = aggressive ? 3000 : MODEL_CLEANUP_THRESHOLD;

  console.log(`Running garbage collection. Aggressive: ${aggressive}`);

  // Find models to dispose
  const modelsToDispose = Object.keys(models).filter((modelName) => {
    // Always keep priority models
    if (priorityModelSet.has(modelName)) return false;

    // Check if model has been accessed recently
    const lastUsed = modelLastAccessed[modelName] || 0;
    return now - lastUsed > unusedThreshold;
  });

  // Dispose models
  modelsToDispose.forEach((modelName) => {
    disposeModel(modelName);
  });

  // Force browser garbage collection when possible
  if (window.gc) {
    try {
      window.gc();
    } catch (e) {
      console.log("Manual GC not available");
    }
  }

  memoryUsage.lastCleanup = now;
  estimateMemoryUsage();

  console.log(
    `GC complete. Disposed ${
      modelsToDispose.length
    } models. Current memory: ${Math.round(
      memoryUsage.totalBytes / 1024 / 1024
    )}MB`
  );
}

/**
 * Track model memory usage
 * @param {string} modelName - Name of the model
 * @param {Object3D} model - The 3D model
 */
function trackModelMemory(modelName, model) {
  // Initialize tracking
  memoryUsage.models[modelName] = { bytes: 0, meshCount: 0, materialCount: 0 };
  const stats = memoryUsage.models[modelName];

  // Traverse model to calculate memory usage
  model.traverse((node) => {
    if (node.isMesh) {
      stats.meshCount++;

      // Calculate geometry memory
      if (node.geometry) {
        const geometry = node.geometry;
        let geometryBytes = 0;

        // Count attribute buffers
        Object.values(geometry.attributes).forEach((attribute) => {
          if (attribute.array) {
            geometryBytes += attribute.array.byteLength || 0;
          }
        });

        // Count index buffer if present
        if (geometry.index && geometry.index.array) {
          geometryBytes += geometry.index.array.byteLength || 0;
        }

        stats.bytes += geometryBytes;
      }

      // Calculate material memory (approximation)
      if (node.material) {
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        stats.materialCount += materials.length;

        materials.forEach((material) => {
          // Rough estimate for material (base + textures)
          let materialBytes = 1024; // Base size

          // Count textures
          Object.values(material).forEach((value) => {
            if (value && value.isTexture && value.image) {
              // Estimate texture memory
              const width = value.image.width || 512;
              const height = value.image.height || 512;
              const bytesPerPixel = 4; // RGBA
              materialBytes += width * height * bytesPerPixel;
            }
          });

          stats.bytes += materialBytes;
        });
      }
    }
  });

  // Update total memory usage
  updateTotalMemoryUsage();
}

/**
 * Update total memory usage
 */
function updateTotalMemoryUsage() {
  memoryUsage.totalBytes = Object.values(memoryUsage.models).reduce(
    (total, model) => total + (model.bytes || 0),
    0
  );
}

/**
 * Remove model from memory tracking
 * @param {string} modelName - Name of the model to remove
 */
function untrackModelMemory(modelName) {
  if (memoryUsage.models[modelName]) {
    memoryUsage.totalBytes -= memoryUsage.models[modelName].bytes || 0;
    delete memoryUsage.models[modelName];
  }
}

/**
 * Estimate current memory usage across all loaded models
 */
function estimateMemoryUsage() {
  let totalBytes = 0;

  Object.keys(models).forEach((modelName) => {
    const model = models[modelName];
    if (!memoryUsage.models[modelName]) {
      trackModelMemory(modelName, model);
    }
    totalBytes += memoryUsage.models[modelName].bytes || 0;
  });

  memoryUsage.totalBytes = totalBytes;

  return {
    totalMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
    modelCount: Object.keys(models).length,
    details: memoryUsage.models,
  };
}

// Track when models were last accessed
const modelLastAccessed = {};
const priorityModelSet = new Set();

/**
 * Mark model as recently used
 * @param {string} modelName - Name of the model that was accessed
 */
function markModelAccessed(modelName) {
  modelLastAccessed[modelName] = Date.now();
}

/**
 * Set priority models that should not be garbage collected
 * @param {Array<string>} modelNames - Array of model names to prioritize
 */
function setPriorityModels(modelNames = []) {
  priorityModelSet.clear();
  modelNames.forEach((name) => priorityModelSet.add(name));

  // Reset access time for priority models
  modelNames.forEach((name) => {
    modelLastAccessed[name] = Date.now();
  });
}

/**
 * Enhanced material disposal
 * @param {Material} material - The material to dispose
 */
function disposeMaterialEnhanced(material) {
  if (!material) return;

  // Dispose all textures and properties
  Object.keys(material).forEach((prop) => {
    if (!material[prop]) return;

    if (material[prop].isTexture) {
      // Clear source image data if possible
      const texture = material[prop];
      if (texture.image) {
        texture.image = null;
      }

      texture.dispose();
      material[prop] = null;
    } else if (
      material[prop].dispose &&
      typeof material[prop].dispose === "function"
    ) {
      // Dispose any disposable properties
      material[prop].dispose();
      material[prop] = null;
    }
  });

  // Dispose material
  material.dispose();
}

/**
 * Stop automatic garbage collection
 */
function stopAutoGarbageCollection() {
  if (gcIntervalId) {
    clearInterval(gcIntervalId);
    gcIntervalId = null;
  }

  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", () => scheduleGarbageCollection());
  }
}

/**
 * Performance-optimized geometry instance sharing
 * @param {Object} geometries - Shared geometries cache
 */
function optimizeGeometrySharing(geometries) {
  const candidates = {};

  // Find geometry candidates with similar vertex counts
  Object.entries(geometries).forEach(([id, geometry]) => {
    const vertexCount = geometry.attributes?.position?.count || 0;
    if (!vertexCount) return;

    // Group by vertex count ranges (within 5% of each other)
    const range = Math.floor(vertexCount / 50) * 50;
    if (!candidates[range]) candidates[range] = [];
    candidates[range].push({ id, geometry, vertexCount });
  });

  // Find potential duplicate geometries and merge them
  let optimizationCount = 0;

  Object.values(candidates).forEach((group) => {
    if (group.length < 2) return;

    // Compare geometries in the same vertex count range
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (!geometries[a.id]) continue; // Already optimized

      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        if (!geometries[b.id]) continue; // Already optimized

        // Check if geometries are similar enough to share
        if (areGeometriesSimilar(a.geometry, b.geometry)) {
          // Replace b with a
          geometries[b.id] = geometries[a.id];
          optimizationCount++;
        }
      }
    }
  });

  console.log(`Optimized ${optimizationCount} similar geometries`);
}

/**
 * Check if two geometries are similar enough to share
 * @param {BufferGeometry} a - First geometry
 * @param {BufferGeometry} b - Second geometry
 * @returns {boolean} True if geometries are similar
 */
function areGeometriesSimilar(a, b) {
  // Must have same attributes
  const aAttribs = Object.keys(a.attributes).sort();
  const bAttribs = Object.keys(b.attributes).sort();

  if (aAttribs.length !== bAttribs.length) return false;
  if (!aAttribs.every((attr, i) => attr === bAttribs[i])) return false;

  // Must have same number of vertices
  if (a.attributes.position.count !== b.attributes.position.count) return false;

  // Must have similar bounding spheres
  if (!a.boundingSphere) a.computeBoundingSphere();
  if (!b.boundingSphere) b.computeBoundingSphere();

  const aSphere = a.boundingSphere;
  const bSphere = b.boundingSphere;

  const radiusDiff =
    Math.abs(aSphere.radius - bSphere.radius) /
    Math.max(aSphere.radius, bSphere.radius);
  const centerDist = aSphere.center.distanceTo(bSphere.center);

  // Similar if radius difference < 10% and centers are close relative to radius
  return radiusDiff < 0.1 && centerDist < aSphere.radius * 0.2;
}

/**
 * Initialize the model manager
 */
function initModelManager() {
  startAutoGarbageCollection();

  getFallbackCube();
  calculateModelPositions();
}
const getLoadedModels = () => models;
export {
  initModelManager,
  getModel,
  preloadProjectModels,
  markModelUnused,
  calculateModelPositions,
  getModelPosition,
  updateModelPosition,
  updateModelScale,
  getFallbackCube,
  getLoadedModels,
  FALLBACK_CUBE_NAME,
};

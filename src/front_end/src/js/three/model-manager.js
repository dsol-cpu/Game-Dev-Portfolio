/**
 * @fileoverview Model manager
 * Handles model loading, caching, memory management, and texture optimization.
 */

import {
  Box3,
  BoxGeometry,
  LinearFilter,
  Mesh,
  MeshNormalMaterial,
  NearestFilter,
  RepeatWrapping,
  Vector3,
} from "../extern/three/three.module.min.js";

import { GLTFLoader } from "../extern/three/GLTFLoader.js";
import { TWO_PI } from "../constants/constants.js";
import { random } from "../utils/random.js";

// Configuration constants - using frozen objects to prevent modification
const CONFIG = Object.freeze({
  FALLBACK_CUBE_NAME: "fallbackCube",
  MODEL_LOAD_TIMEOUT: 10000, // ms
  TEXTURE_OPTIMIZATION: Object.freeze({
    ENABLED: true,
    MAX_TEXTURE_SIZE: 512,
    MIN_TEXTURE_SIZE: 64,
    QUALITY_LEVELS: Object.freeze({
      LOW: 64,
      MEDIUM: 256,
      HIGH: 512,
    }),
    MIPMAP: false,
    FILTER: "LINEAR",
    ANISOTROPY: 1,
  }),
});

// Create a single shared fallback cube (cached once)
const FALLBACK_CUBE = (() => {
  const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshNormalMaterial());
  cube.position.set(0, 0, 100);
  return cube;
})();

// State management with Map objects for better performance with string keys
const state = {
  models: new Map(),
  modelLoadPromises: new Map(),
  modelPositions: new Map(),
  textureQuality: "MEDIUM",
  textureCache: new WeakMap(), // Cache optimized textures by reference
};

/**
 * Get the shared fallback cube
 */
function getFallbackCube() {
  return FALLBACK_CUBE;
}

/**
 * Set texture quality level
 * @param {string} qualityLevel - 'LOW', 'MEDIUM', or 'HIGH'
 * @returns {boolean} Success indicator
 */
function setTextureQuality(qualityLevel) {
  if (CONFIG.TEXTURE_OPTIMIZATION.QUALITY_LEVELS[qualityLevel] !== undefined) {
    state.textureQuality = qualityLevel;
    return true;
  }
  console.warn(`Invalid quality level: ${qualityLevel}`);
  return false;
}

/**
 * Get the current texture max size based on quality setting
 * @returns {number} Max texture size
 */
function getCurrentTextureMaxSize() {
  return (
    CONFIG.TEXTURE_OPTIMIZATION.QUALITY_LEVELS[state.textureQuality] ||
    CONFIG.TEXTURE_OPTIMIZATION.MAX_TEXTURE_SIZE
  );
}

/**
 * Find the optimal power-of-two size for textures
 * @param {number} originalSize - Original dimension of the texture
 * @returns {number} Optimized size (power of 2)
 */
function getOptimalTextureSize(originalSize) {
  const maxSize = getCurrentTextureMaxSize();
  const minSize = CONFIG.TEXTURE_OPTIMIZATION.MIN_TEXTURE_SIZE;

  // Bitwise approach to find nearest power of 2 (faster than loop)
  let size = 1;
  while (size << 1 <= originalSize && size << 1 <= maxSize) {
    size <<= 1;
  }

  return Math.max(size, minSize);
}

/**
 * Optimize a texture to reduce memory usage while maintaining visual quality
 * @param {THREE.Texture} texture - The texture to optimize
 * @returns {THREE.Texture} Optimized texture
 */
function optimizeTexture(texture) {
  if (!texture || !CONFIG.TEXTURE_OPTIMIZATION.ENABLED) return texture;

  // Check if we've already processed this texture
  if (state.textureCache.has(texture)) return state.textureCache.get(texture);

  const image = texture.image;
  if (!image?.width || !image?.height) return texture;

  // Calculate optimal dimensions
  const originalWidth = image.width;
  const originalHeight = image.height;
  const optimalWidth = getOptimalTextureSize(originalWidth);
  const optimalHeight = getOptimalTextureSize(originalHeight);

  // Create a new texture if resizing is needed
  let optimizedTexture = texture;

  // Only resize if needed
  if (optimalWidth < originalWidth || optimalHeight < originalHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = optimalWidth;
    canvas.height = optimalHeight;
    const ctx = canvas.getContext("2d");

    // Use high-quality image scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, optimalWidth, optimalHeight);

    // Create a new texture with the same properties but using our canvas
    optimizedTexture = texture.clone();
    optimizedTexture.image = canvas;
    optimizedTexture.needsUpdate = true;

    // Preserve important properties from original texture
    optimizedTexture.repeat.copy(texture.repeat);
    optimizedTexture.offset.copy(texture.offset);
    optimizedTexture.center.copy(texture.center);
    optimizedTexture.rotation = texture.rotation;
  }

  // Apply filtering based on configuration (use constants directly)
  const useNearestFilter = CONFIG.TEXTURE_OPTIMIZATION.FILTER === "NEAREST";
  optimizedTexture.generateMipmaps = CONFIG.TEXTURE_OPTIMIZATION.MIPMAP;
  optimizedTexture.minFilter = useNearestFilter ? NearestFilter : LinearFilter;
  optimizedTexture.magFilter = useNearestFilter ? NearestFilter : LinearFilter;
  optimizedTexture.anisotropy = CONFIG.TEXTURE_OPTIMIZATION.ANISOTROPY;
  optimizedTexture.wrapS = optimizedTexture.wrapT = RepeatWrapping;

  // Store in cache
  state.textureCache.set(texture, optimizedTexture);

  return optimizedTexture;
}

/**
 * Process all textures in a model
 * @param {THREE.Object3D} model - The model to process textures for
 */
function optimizeModelTextures(model) {
  if (!model) return;

  // Common texture map names
  const textureMaps = [
    "map",
    "normalMap",
    "bumpMap",
    "displacementMap",
    "roughnessMap",
    "metalnessMap",
    "alphaMap",
    "aoMap",
    "emissiveMap",
    "envMap",
    "lightMap",
    "specularMap",
  ];

  // Process all materials in the model
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    materials.forEach((material) => {
      textureMaps.forEach((mapName) => {
        if (material[mapName]?.isTexture) {
          optimizeTexture(material[mapName]);
        }
      });
    });
  });
}

/**
 * Get a model with simplified caching
 * @param {string} modelName - Name of the model to load
 * @returns {Promise<THREE.Object3D>} Promise resolving to the model
 */
async function getModel(modelName) {
  // Use fallback if no model name provided
  if (!modelName) return getFallbackCube();

  // Return from cache if available
  if (state.models.has(modelName)) {
    return state.models.get(modelName);
  }

  // Return existing promise if already loading
  if (state.modelLoadPromises.has(modelName)) {
    return state.modelLoadPromises.get(modelName);
  }

  // Start new load process
  const modelUrl = `/models/${modelName}.glb`;
  const loadPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    let isResolved = false;

    // Setup loading timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.warn(`Model load timeout: ${modelName}`);
        const fallback = getFallbackCube();
        state.models.set(modelName, fallback);
        isResolved = true;
        resolve(fallback);
      }
    }, CONFIG.MODEL_LOAD_TIMEOUT);

    // Load the model
    loader.load(
      modelUrl,
      (gltf) => {
        clearTimeout(timeoutId);
        if (isResolved) return;

        const model = gltf.scene;
        optimizeModelTextures(model);
        setupModel(model);
        state.models.set(modelName, model);
        isResolved = true;
        resolve(model);
      },
      undefined,
      (error) => {
        clearTimeout(timeoutId);
        if (isResolved) return;

        console.error(`Model failed to load: ${modelName}`, error);
        const fallback = getFallbackCube();
        state.models.set(modelName, fallback);
        isResolved = true;
        resolve(fallback);
      }
    );
  });

  state.modelLoadPromises.set(modelName, loadPromise);

  // Clean up the promise reference once loaded
  loadPromise.finally(() => {
    state.modelLoadPromises.delete(modelName);
  });

  return loadPromise;
}

/**
 * Setup model transformations
 * @param {THREE.Object3D} model - The model to set up
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
    model.scale.multiplyScalar(1 / maxDim);
  }

  // Add random rotation for variety
  model.rotation.y = random() * TWO_PI;
}

/**
 * Dispose textures from a material
 * @param {Material} material - Material containing textures to dispose
 */
function disposeTextures(material) {
  if (!material) return;

  // List of texture properties to check and dispose
  const textureProps = [
    "map",
    "normalMap",
    "bumpMap",
    "displacementMap",
    "roughnessMap",
    "metalnessMap",
    "alphaMap",
    "aoMap",
    "emissiveMap",
    "envMap",
    "lightMap",
    "specularMap",
  ];

  textureProps.forEach((prop) => {
    if (material[prop]?.isTexture) {
      state.textureCache.delete(material[prop]);
      material[prop].dispose();
    }
  });
}

/**
 * Dispose model and free resources
 * @param {string} modelName - Name of the model to dispose
 * @param {Scene} scene - Scene containing the model
 */
function disposeModel(modelName, scene = null) {
  if (!state.models.has(modelName)) return;

  const model = state.models.get(modelName);

  // Don't dispose the fallback cube
  if (model === FALLBACK_CUBE) {
    state.models.delete(modelName);
    return;
  }

  // Remove from scene if provided
  if (scene && model.parent === scene) {
    scene.remove(model);
  }

  // Dispose geometries and materials
  model.traverse((child) => {
    if (!child.isMesh) return;

    // Dispose geometry
    if (child.geometry) {
      child.geometry.dispose();
    }

    // Dispose material(s)
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => {
          disposeTextures(mat);
          mat.dispose();
        });
      } else {
        disposeTextures(child.material);
        child.material.dispose();
      }
    }
  });

  state.models.delete(modelName);
}

/**
 * Calculate model positions in a grid layout
 * @param {string[]} modelNames - Model names to position
 * @param {number} gridSize - Size of grid cells
 */
function calculateModelPositions(modelNames = [], gridSize = 12) {
  // If no model names provided, use existing models
  if (modelNames.length === 0) {
    modelNames = Array.from(state.models.keys());
  }

  // Calculate grid dimensions with bit shift for performance
  const gridSide = Math.ceil(Math.sqrt(modelNames.length));
  const halfGrid = (gridSide - 1) / 2;

  // Position models in grid
  modelNames.forEach((name, index) => {
    const row = Math.floor(index / gridSide);
    const col = index % gridSide;

    const offsetX = (col - halfGrid) * gridSize;
    const offsetZ = (row - halfGrid) * gridSize;

    state.modelPositions.set(name, new Vector3(offsetX, 0, offsetZ));
  });

  // Ensure fallback cube is at origin
  state.modelPositions.set(CONFIG.FALLBACK_CUBE_NAME, new Vector3(0, 0, 0));
}

/**
 * Get model position by name
 * @param {string} modelName - Name of the model
 * @returns {THREE.Vector3} Position vector
 */
function getModelPosition(modelName) {
  return state.modelPositions.get(modelName) || new Vector3(0, 0, 0);
}

/**
 * Update model position based on stored positions
 * @param {string} modelName - Name of the model to update
 */
function updateModelPosition(modelName) {
  // Update specific model if provided
  if (
    modelName &&
    state.models.has(modelName) &&
    state.modelPositions.has(modelName)
  ) {
    const model = state.models.get(modelName);
    const position = state.modelPositions.get(modelName);
    model.position.copy(position);
    return;
  }

  // Update all models' positions
  state.models.forEach((model, name) => {
    const position = state.modelPositions.get(name);
    if (position) {
      model.position.copy(position);
    }
  });
}

/**
 * Update model scale
 * @param {string} modelName - Name of the model to scale
 * @param {number} scale - Scale factor
 */
function updateModelScale(modelName, scale) {
  const model = state.models.get(modelName);
  if (model) {
    model.scale.setScalar(scale);
  }
}

/**
 * Preload a list of models
 * @param {string[]} modelNames - Array of model names to preload
 */
function preloadModels(modelNames = []) {
  if (!Array.isArray(modelNames) || modelNames.length === 0) return;

  // Load each model in parallel
  Promise.allSettled(
    modelNames
      .filter((name) => typeof name === "string" && name.trim() !== "")
      .map((name) => getModel(name))
  ).catch((err) => console.warn("Model preload batch error:", err));
}

/**
 * Get all currently loaded models
 * @returns {Object} Object containing all loaded models
 */
function getLoadedModels() {
  return Object.fromEntries(state.models);
}

// Export public API
export {
  calculateModelPositions,
  disposeModel,
  getFallbackCube,
  getLoadedModels,
  getModel,
  getModelPosition,
  preloadModels,
  setTextureQuality,
  updateModelPosition,
  updateModelScale,
};

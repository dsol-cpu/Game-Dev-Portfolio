/**
 * @fileoverview Simplified model manager for Three.js applications.
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

// Configuration constants
const CONFIG = {
  FALLBACK_CUBE_NAME: "fallbackCube",
  MODEL_LOAD_TIMEOUT: 10000, // ms
  TEXTURE_OPTIMIZATION: {
    ENABLED: true,
    MAX_TEXTURE_SIZE: 512, // Maximum texture dimension (power of 2)
    MIN_TEXTURE_SIZE: 64, // Minimum texture dimension (power of 2)
    QUALITY_LEVELS: {
      // Different quality presets
      LOW: 64,
      MEDIUM: 256,
      HIGH: 512,
    },
    MIPMAP: false, // Whether to generate mipmaps
    FILTER: "LINEAR", // Texture filtering method: LINEAR or NEAREST
    ANISOTROPY: 1, // Anisotropic filtering level (1 = disabled)
  },
};

// Create a single shared fallback cube
const FALLBACK_CUBE = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshNormalMaterial()
);
FALLBACK_CUBE.position.set(0, 0, 100);

// Simple state management
const state = {
  models: {},
  modelLoadPromises: {},
  modelPositions: {},
  textureQuality: "MEDIUM", // Default texture quality
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
 */
function setTextureQuality(qualityLevel) {
  if (CONFIG.TEXTURE_OPTIMIZATION.QUALITY_LEVELS[qualityLevel] !== undefined) {
    state.textureQuality = qualityLevel;
    console.log(`Texture quality set to: ${qualityLevel}`);
    return true;
  }
  console.warn(`Invalid quality level: ${qualityLevel}`);
  return false;
}

/**
 * Get the current texture max size based on quality setting
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

  // Find the nearest power of 2 that's less than or equal to the original size
  let size = 1;
  while (size * 2 <= originalSize && size * 2 <= maxSize) {
    size *= 2;
  }

  // Don't go below the minimum size
  return Math.max(size, minSize);
}

/**
 * Optimize a texture to reduce memory usage while maintaining visual quality
 * @param {THREE.Texture} texture - The texture to optimize
 */
function optimizeTexture(texture) {
  if (!texture || !CONFIG.TEXTURE_OPTIMIZATION.ENABLED) return texture;

  // Store original dimensions
  const originalWidth = texture.image ? texture.image.width : 0;
  const originalHeight = texture.image ? texture.image.height : 0;

  if (originalWidth === 0 || originalHeight === 0) return texture;

  // Calculate optimal dimensions
  const optimalWidth = getOptimalTextureSize(originalWidth);
  const optimalHeight = getOptimalTextureSize(originalHeight);

  // Only resize if needed
  if (optimalWidth < originalWidth || optimalHeight < originalHeight) {
    // Log what we're doing
    console.log(
      `Optimizing texture: ${originalWidth}x${originalHeight} -> ${optimalWidth}x${optimalHeight}`
    );

    // Create a canvas for resizing
    const canvas = document.createElement("canvas");
    canvas.width = optimalWidth;
    canvas.height = optimalHeight;
    const ctx = canvas.getContext("2d");

    // Use high-quality image scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw the original image scaled down
    ctx.drawImage(texture.image, 0, 0, optimalWidth, optimalHeight);

    // Replace the texture's image with our resized version
    texture.image = canvas;
    texture.needsUpdate = true;
  }

  // Apply filtering based on configuration
  texture.generateMipmaps = CONFIG.TEXTURE_OPTIMIZATION.MIPMAP;
  texture.minFilter =
    CONFIG.TEXTURE_OPTIMIZATION.FILTER === "NEAREST"
      ? NearestFilter
      : CONFIG.TEXTURE_OPTIMIZATION.MIPMAP
      ? LinearFilter
      : LinearFilter;
  texture.magFilter =
    CONFIG.TEXTURE_OPTIMIZATION.FILTER === "NEAREST"
      ? NearestFilter
      : LinearFilter;

  // Set anisotropy
  texture.anisotropy = CONFIG.TEXTURE_OPTIMIZATION.ANISOTROPY;

  // Use repeat wrapping for better tiling if texture is used for that
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;

  return texture;
}

/**
 * Process all textures in a model
 * @param {THREE.Object3D} model - The model to process textures for
 */
function optimizeModelTextures(model) {
  if (!model) return;

  // Process all materials in the model
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    materials.forEach((material) => {
      // Process all texture maps in the material
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

      textureMaps.forEach((mapName) => {
        if (material[mapName] && material[mapName].isTexture) {
          optimizeTexture(material[mapName]);
        }
      });
    });
  });
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

        // Optimize textures after loading but before setup
        optimizeModelTextures(model);

        state.models[modelName] = model;
        setupModel(model);
        console.log(`Loaded model: ${modelName} with optimized textures`);
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
          child.material.forEach((mat) => {
            disposeTextures(mat);
            mat.dispose();
          });
        } else {
          disposeTextures(child.material);
          child.material.dispose();
        }
      }
    }
  });

  delete state.models[modelName];
}

/**
 * Dispose textures from a material
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
    if (material[prop] && material[prop].isTexture) {
      material[prop].dispose();
    }
  });
}

/**
 * Calculate model positions in a grid layout
 */
function calculateModelPositions(modelNames = [], gridSize = 12) {
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

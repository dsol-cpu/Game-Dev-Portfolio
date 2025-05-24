import {
  Box3,
  BoxGeometry,
  LinearFilter,
  Mesh,
  MeshNormalMaterial,
  RepeatWrapping,
  Vector3,
} from "../extern/three/three.module.min.js";
import { GLTFLoader } from "../extern/three/GLTFLoader.js";
import { TWO_PI } from "../constants/constants.js";
import { random } from "../utils/random.js";

// Reduced configuration
const CONFIG = {
  MODEL_LOAD_TIMEOUT: 10000,
  TEXTURE_MAX_SIZE: 512,
  GRID_SIZE: 12,
};

// Simplified caches
export const modelCache = new Map();
const loadPromiseCache = new Map();
const textureCache = new WeakMap();

// Single fallback cube instance
const FALLBACK_CUBE = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshNormalMaterial()
);
FALLBACK_CUBE.position.set(0, 0, 100);

// Texture maps array (reused)
const TEXTURE_MAPS = [
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

// Optimized texture sizing - power of 2 only
const getOptimalTextureSize = (size) => {
  if (size <= 64) return 64;
  if (size <= 128) return 128;
  if (size <= 256) return 256;
  return 512;
};

const optimizeTexture = (texture) => {
  const cached = textureCache.get(texture);
  if (cached) return cached;

  const image = texture?.image;
  if (!image?.width) return texture;

  const optimalWidth = getOptimalTextureSize(image.width);
  const optimalHeight = getOptimalTextureSize(image.height);

  // Skip optimization if already optimal
  if (optimalWidth >= image.width && optimalHeight >= image.height) {
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 1;
    textureCache.set(texture, texture);
    return texture;
  }

  // Create optimized version
  const canvas = document.createElement("canvas");
  canvas.width = optimalWidth;
  canvas.height = optimalHeight;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, optimalWidth, optimalHeight);

  const optimized = texture.clone();
  optimized.image = canvas;
  optimized.needsUpdate = true;
  optimized.generateMipmaps = false;
  optimized.minFilter = optimized.magFilter = LinearFilter;
  optimized.wrapS = optimized.wrapT = RepeatWrapping;
  optimized.anisotropy = 1;

  textureCache.set(texture, optimized);
  return optimized;
};

const optimizeModelTextures = (model) => {
  model.traverse((node) => {
    if (!node.isMesh?.material) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    for (const material of materials) {
      for (const mapName of TEXTURE_MAPS) {
        const texture = material[mapName];
        if (texture?.isTexture) {
          material[mapName] = optimizeTexture(texture);
        }
      }
    }
  });

  return model;
};

const setupModelTransform = (model) => {
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  // Center and position
  model.position.sub(center);
  model.position.y += size.y * 0.1;

  // Scale normalization
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && (maxDim < 0.5 || maxDim > 2)) {
    model.scale.multiplyScalar(1 / maxDim);
  }

  model.rotation.y = random() * TWO_PI;
  return model;
};

const loadModelFromUrl = (modelUrl) => {
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn(`Model load timeout: ${modelUrl}`);
        resolved = true;
        resolve(null);
      }
    }, CONFIG.MODEL_LOAD_TIMEOUT);

    loader.load(
      modelUrl,
      (gltf) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve(gltf.scene);
        }
      },
      undefined,
      (error) => {
        clearTimeout(timeout);
        if (!resolved) {
          console.error(`Model failed to load: ${modelUrl}`, error);
          resolved = true;
          resolve(null);
        }
      }
    );
  });
};

// Main model loading function
export const loadModel = async (modelName) => {
  if (!modelName) return FALLBACK_CUBE;

  // Return cached model
  const cached = modelCache.get(modelName);
  if (cached) return cached;

  // Return pending promise
  const pending = loadPromiseCache.get(modelName);
  if (pending) return pending;

  const modelUrl = `/models/${modelName}.glb`;
  const loadPromise = loadModelFromUrl(modelUrl).then((model) => {
    loadPromiseCache.delete(modelName);

    if (!model) {
      modelCache.set(modelName, FALLBACK_CUBE);
      return FALLBACK_CUBE;
    }

    const processedModel = setupModelTransform(optimizeModelTextures(model));
    modelCache.set(modelName, processedModel);
    return processedModel;
  });

  loadPromiseCache.set(modelName, loadPromise);
  return loadPromise;
};

// Simplified grid positioning
export const calculateGridPositions = (
  modelNames,
  gridSize = CONFIG.GRID_SIZE
) => {
  const positions = new Map();
  if (!modelNames?.length) return positions;

  const gridSide = Math.ceil(Math.sqrt(modelNames.length));
  const halfGrid = (gridSide - 1) / 2;

  modelNames.forEach((name, i) => {
    const row = Math.floor(i / gridSide);
    const col = i % gridSide;
    positions.set(
      name,
      new Vector3((col - halfGrid) * gridSize, 0, (row - halfGrid) * gridSize)
    );
  });

  return positions;
};

// Utility functions
export const applyModelPositions = (models, positions) => {
  for (const [modelName, position] of positions) {
    const model = models.get(modelName);
    if (model) model.position.copy(position);
  }
};

export const setModelScale = (model, scale) => {
  if (model) model.scale.setScalar(scale);
  return model;
};

const disposeTextures = (material) => {
  for (const prop of TEXTURE_MAPS) {
    const texture = material[prop];
    if (texture?.isTexture) {
      textureCache.delete(texture);
      texture.dispose();
    }
  }
};

export const disposeModel = (model, scene) => {
  if (!model) return;

  if (scene?.children.includes(model)) {
    scene.remove(model);
  }

  model.traverse((child) => {
    if (!child.isMesh) return;

    child.geometry?.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        disposeTextures(material);
        material.dispose();
      }
    }
  });
};

export const clearModelFromCache = (modelName) => {
  const model = modelCache.get(modelName);
  if (model && model !== FALLBACK_CUBE) {
    disposeModel(model);
    modelCache.delete(modelName);
  }
};

export const preloadModels = async (modelNames) => {
  if (!Array.isArray(modelNames) || !modelNames.length) return [];

  const validNames = modelNames.filter((name) => name?.trim?.());
  const results = await Promise.allSettled(validNames.map(loadModel));

  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
};

export const getCachedModels = () => Object.fromEntries(modelCache);

export const clearAllCaches = () => {
  for (const model of modelCache.values()) {
    if (model !== FALLBACK_CUBE) {
      disposeModel(model);
    }
  }
  modelCache.clear();
  loadPromiseCache.clear();
};

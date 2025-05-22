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

// Configuration and caches
const CONFIG = {
  FALLBACK_CUBE_NAME: "fallbackCube",
  MODEL_LOAD_TIMEOUT: 10000,
  TEXTURE_MAX_SIZE: 512,
  TEXTURE_MIN_SIZE: 64,
};

export const modelCache = new Map();
export const loadPromiseCache = new Map();
export const textureCache = new WeakMap();

// Pure utility functions
export const createFallbackCube = () => {
  const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshNormalMaterial());
  cube.position.set(0, 0, 100);
  return cube;
};

const getOptimalTextureSize = (
  originalSize,
  maxSize = CONFIG.TEXTURE_MAX_SIZE
) => {
  let size = 1;
  while (size << 1 <= originalSize && size << 1 <= maxSize) size <<= 1;
  return Math.max(size, CONFIG.TEXTURE_MIN_SIZE);
};

const createOptimizedTexture = (texture) => {
  if (!texture || textureCache.has(texture))
    return textureCache.get(texture) || texture;

  const image = texture.image;
  if (!image?.width || !image?.height) return texture;

  const optimalWidth = getOptimalTextureSize(image.width);
  const optimalHeight = getOptimalTextureSize(image.height);

  let optimizedTexture = texture;

  if (optimalWidth < image.width || optimalHeight < image.height) {
    const canvas = Object.assign(document.createElement("canvas"), {
      width: optimalWidth,
      height: optimalHeight,
    });
    const ctx = canvas.getContext("2d");

    Object.assign(ctx, {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    ctx.drawImage(image, 0, 0, optimalWidth, optimalHeight);

    optimizedTexture = texture.clone();
    optimizedTexture.image = canvas;
    optimizedTexture.needsUpdate = true;

    // Preserve properties
    ["repeat", "offset", "center"].forEach((prop) =>
      optimizedTexture[prop].copy(texture[prop])
    );
    optimizedTexture.rotation = texture.rotation;
  }

  // Apply filtering
  Object.assign(optimizedTexture, {
    generateMipmaps: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    anisotropy: 1,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
  });

  textureCache.set(texture, optimizedTexture);
  return optimizedTexture;
};

const optimizeModelTextures = (model) => {
  if (!model) return model;

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

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    materials.forEach((material) => {
      textureMaps.forEach((mapName) => {
        if (material[mapName]?.isTexture) {
          material[mapName] = createOptimizedTexture(material[mapName]);
        }
      });
    });
  });

  return model;
};

const setupModelTransform = (model) => {
  if (!model) return model;

  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  model.position.sub(center);
  model.position.y += size.y * 0.1;

  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && (maxDim < 0.5 || maxDim > 2)) {
    model.scale.multiplyScalar(1 / maxDim);
  }

  model.rotation.y = random() * TWO_PI;
  return model;
};

const loadModelFromUrl = (modelUrl, timeout = CONFIG.MODEL_LOAD_TIMEOUT) =>
  new Promise((resolve) => {
    const loader = new GLTFLoader();
    let isResolved = false;

    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.warn(`Model load timeout: ${modelUrl}`);
        isResolved = true;
        resolve(createFallbackCube());
      }
    }, timeout);

    loader.load(
      modelUrl,
      (gltf) => {
        clearTimeout(timeoutId);
        if (!isResolved) {
          isResolved = true;
          resolve(gltf.scene);
        }
      },
      undefined,
      (error) => {
        clearTimeout(timeoutId);
        if (!isResolved) {
          console.error(`Model failed to load: ${modelUrl}`, error);
          isResolved = true;
          resolve(createFallbackCube());
        }
      }
    );
  });

// Main model loading function
export const loadModel = async (modelName) => {
  if (!modelName) return createFallbackCube();

  if (modelCache.has(modelName)) return modelCache.get(modelName);
  if (loadPromiseCache.has(modelName)) return loadPromiseCache.get(modelName);

  const modelUrl = `/models/${modelName}.glb`;
  const loadPromise = loadModelFromUrl(modelUrl)
    .then((model) => {
      const processedModel = setupModelTransform(optimizeModelTextures(model));
      modelCache.set(modelName, processedModel);
      return processedModel;
    })
    .finally(() => loadPromiseCache.delete(modelName));

  loadPromiseCache.set(modelName, loadPromise);
  return loadPromise;
};

// Grid positioning
export const calculateGridPositions = (modelNames = [], gridSize = 12) => {
  const positions = new Map();
  if (modelNames.length === 0) return positions;

  const gridSide = Math.ceil(Math.sqrt(modelNames.length));
  const halfGrid = (gridSide - 1) / 2;

  modelNames.forEach((name, index) => {
    const row = Math.floor(index / gridSide);
    const col = index % gridSide;
    const offsetX = (col - halfGrid) * gridSize;
    const offsetZ = (row - halfGrid) * gridSize;
    positions.set(name, new Vector3(offsetX, 0, offsetZ));
  });

  return positions;
};

// Utility functions
export const applyModelPositions = (models, positions) =>
  positions.forEach((position, modelName) => {
    const model = models.get(modelName);
    if (model) model.position.copy(position);
  });

export const setModelScale = (model, scale) => {
  if (model) model.scale.setScalar(scale);
  return model;
};

const disposeTextures = (material) => {
  if (!material) return;

  [
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
  ].forEach((prop) => {
    if (material[prop]?.isTexture) {
      textureCache.delete(material[prop]);
      material[prop].dispose();
    }
  });
};

export const disposeModel = (model, scene = null) => {
  if (!model) return;

  if (scene && model.parent === scene) scene.remove(model);

  model.traverse((child) => {
    if (!child.isMesh) return;

    if (child.geometry) child.geometry.dispose();

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
};

export const clearModelFromCache = (modelName) => {
  const model = modelCache.get(modelName);
  if (model) {
    disposeModel(model);
    modelCache.delete(modelName);
  }
};

export const preloadModels = (modelNames = []) => {
  if (!Array.isArray(modelNames) || modelNames.length === 0)
    return Promise.resolve([]);

  const validNames = modelNames.filter(
    (name) => typeof name === "string" && name.trim() !== ""
  );
  return Promise.allSettled(validNames.map((name) => loadModel(name))).then(
    (results) =>
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
  );
};

export const getCachedModels = () => Object.fromEntries(modelCache);

export const clearAllCaches = () => {
  modelCache.forEach((model) => disposeModel(model));
  modelCache.clear();
  loadPromiseCache.clear();
};

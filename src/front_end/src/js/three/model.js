import {
  Box3,
  BoxGeometry,
  LinearFilter,
  Mesh,
  MeshNormalMaterial,
  RepeatWrapping,
  Vector3,
  InstancedMesh,
  Matrix4,
} from "../extern/three/three.module.min.js";
import { GLTFLoader } from "../extern/three/GLTFLoader.js";
import { TWO_PI } from "../constants/constants.js";
import { random } from "../utils/random.js";

const CONFIG = {
  TIMEOUT: 8000,
  GRID_SIZE: 12,
  MAX_TEXTURE_SIZE: 512, // Increased for better quality/performance balance
  MAX_INSTANCES: 1000,
  MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB
  BATCH_SIZE: 8, // Optimized batch size
};

// Unified cache system
const cache = {
  models: new Map(),
  loading: new Map(),
  memory: 0,

  track(size) {
    this.memory += size;
  },
  free(size) {
    this.memory -= size;
  },
  canAllocate(size) {
    return this.memory + size <= CONFIG.MEMORY_LIMIT;
  },
  getUsage() {
    return (this.memory / CONFIG.MEMORY_LIMIT) * 100;
  },
};

const loader = new GLTFLoader();

// Optimized fallback
const FALLBACK = new Mesh(new BoxGeometry(1, 1, 1), new MeshNormalMaterial());
FALLBACK.position.set(500, 0, 0);

// GPU-optimized texture processing
const optimizeTexture = (texture) => {
  if (!texture?.image) return texture;

  const { width, height } = texture.image;
  const size = width * height * 4;

  if (!cache.canAllocate(size)) {
    // Create minimal fallback texture
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 32, 32);
    texture.image = canvas;
  } else if (Math.max(width, height) > CONFIG.MAX_TEXTURE_SIZE) {
    // Efficient downscaling
    const canvas = document.createElement("canvas");
    const newSize = CONFIG.MAX_TEXTURE_SIZE;
    canvas.width = canvas.height = newSize;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(texture.image, 0, 0, newSize, newSize);
    texture.image = canvas;
    cache.track(newSize * newSize * 4);
  } else {
    cache.track(size);
  }

  // GPU-friendly settings
  texture.generateMipmaps = true;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;

  return texture;
};

// Streamlined geometry optimization
const optimizeGeometry = (geometry) => {
  if (!geometry.attributes.position) return geometry;

  const size = Object.values(geometry.attributes).reduce(
    (sum, attr) => sum + attr.array.byteLength,
    0
  );

  if (!cache.canAllocate(size)) {
    console.warn("GPU memory limit reached, using simplified geometry");
    return new BoxGeometry(1, 1, 1);
  }

  // Essential optimizations only
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  cache.track(size);

  return geometry;
};

// Efficient model processing
const processModel = (model, key) => {
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  // Center and scale
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 2) model.scale.multiplyScalar(2 / maxDim);
  else if (maxDim < 0.5) model.scale.multiplyScalar(0.5 / maxDim);

  model.rotation.y = random() * TWO_PI;

  // Optimize all meshes
  model.traverse((node) => {
    if (node.isMesh) {
      node.geometry = optimizeGeometry(node.geometry);

      // Handle materials efficiently
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.forEach((mat) => {
        ["map", "normalMap", "roughnessMap", "metalnessMap"].forEach((prop) => {
          if (mat[prop]?.isTexture) {
            mat[prop] = optimizeTexture(mat[prop]);
          }
        });
      });
    }
  });

  return model;
};

// Main loading function
export const loadModel = async (modelName) => {
  if (!modelName) return FALLBACK.clone();

  // Check cache first
  if (cache.models.has(modelName)) {
    const cached = cache.models.get(modelName);
    return cached === FALLBACK ? FALLBACK.clone() : cached.clone();
  }

  // Check if already loading
  if (cache.loading.has(modelName)) {
    const result = await cache.loading.get(modelName);
    return result === FALLBACK ? FALLBACK.clone() : result.clone();
  }

  // Create loading promise
  const promise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`Model timeout: ${modelName}`);
      resolve(FALLBACK);
    }, CONFIG.TIMEOUT);

    loader.load(
      `/models/${modelName}.glb`,
      (gltf) => {
        clearTimeout(timer);

        // Check memory before processing
        if (cache.getUsage() > 85) {
          console.warn(
            `High GPU memory usage (${cache.getUsage().toFixed(1)}%)`
          );
        }

        const model = processModel(gltf.scene.clone(), modelName);
        cache.models.set(modelName, model);
        resolve(model);
      },
      undefined,
      (error) => {
        clearTimeout(timer);
        console.error(`Failed to load ${modelName}:`, error);
        cache.models.set(modelName, FALLBACK);
        resolve(FALLBACK);
      }
    );
  });

  cache.loading.set(modelName, promise);
  const result = await promise;
  cache.loading.delete(modelName);

  return result === FALLBACK ? FALLBACK.clone() : result.clone();
};

// Optimized batch loading with better GPU utilization
export const batchLoadModels = async (modelNames) => {
  const results = [];

  for (let i = 0; i < modelNames.length; i += CONFIG.BATCH_SIZE) {
    const batch = modelNames.slice(i, i + CONFIG.BATCH_SIZE);
    const batchPromises = batch.map(loadModel);
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);

    // Micro-pause for GPU breathing room
    if (i + CONFIG.BATCH_SIZE < modelNames.length) {
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }

  return results;
};

// Instanced mesh creation for repeated models
export const createInstancedMesh = (
  geometry,
  material,
  count = CONFIG.MAX_INSTANCES
) => {
  const instancedMesh = new InstancedMesh(geometry, material, count);
  const matrix = new Matrix4();

  // Pre-initialize all matrices
  for (let i = 0; i < count; i++) {
    instancedMesh.setMatrixAt(i, matrix.identity());
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.count = 0;
  return instancedMesh;
};

// Grid positioning - simplified
export const calculateGridPositions = (
  modelNames,
  gridSize = CONFIG.GRID_SIZE
) => {
  const positions = new Map();
  if (!modelNames?.length) return positions;

  const side = Math.ceil(Math.sqrt(modelNames.length));
  const offset = ((side - 1) * gridSize) / 2;

  modelNames.forEach((name, i) => {
    const x = (i % side) * gridSize - offset;
    const z = Math.floor(i / side) * gridSize - offset;
    positions.set(name, new Vector3(x, 0, z));
  });

  return positions;
};

// Apply positions efficiently
export const applyPositions = (models, positions) => {
  positions.forEach((pos, name) => {
    const model = models.get(name);
    if (model) model.position.copy(pos);
  });
};

// Preload helper
export const preloadModels = (modelNames) => batchLoadModels(modelNames);

// Efficient cleanup
const disposeRecursive = (obj) => {
  if (obj.geometry && !obj.geometry.userData?.shared) {
    obj.geometry.dispose();
  }
  if (obj.material) {
    const materials = Array.isArray(obj.material)
      ? obj.material
      : [obj.material];
    materials.forEach((mat) => {
      if (!mat.userData?.shared) {
        ["map", "normalMap", "roughnessMap", "metalnessMap"].forEach((prop) => {
          if (mat[prop]?.dispose && !mat[prop].userData?.shared) {
            mat[prop].dispose();
          }
        });
        mat.dispose();
      }
    });
  }
};

export const disposeModel = (model, scene) => {
  if (!model || model === FALLBACK) return;

  scene?.remove(model);
  model.traverse(disposeRecursive);
};

export const clearCache = (modelName) => {
  const model = cache.models.get(modelName);
  if (model && model !== FALLBACK) {
    disposeModel(model);
    cache.models.delete(modelName);
  }
};

export const clearAllCaches = () => {
  cache.models.forEach((model, name) => {
    if (model !== FALLBACK) disposeModel(model);
  });
  cache.models.clear();
  cache.loading.clear();
  cache.memory = 0;
};

// Performance monitoring
export const getMemoryUsage = () => ({
  used: cache.memory,
  percentage: cache.getUsage(),
  available: CONFIG.MEMORY_LIMIT - cache.memory,
});

// Force GPU upload for critical models
export const forceGPUUpload = (renderer, model) => {
  const tempCamera = new THREE.PerspectiveCamera();
  model.traverse((node) => {
    if (node.isMesh) {
      renderer.render(node, tempCamera);

      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.forEach((mat) => {
        ["map", "normalMap", "roughnessMap", "metalnessMap"].forEach((prop) => {
          if (mat[prop]?.isTexture) {
            renderer.setTexture2D(mat[prop], 0);
          }
        });
      });
    }
  });
};

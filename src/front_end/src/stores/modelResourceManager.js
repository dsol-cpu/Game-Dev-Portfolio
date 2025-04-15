import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { optimizeRenderer } from "../utils/deviceUtils";
import { mapArray } from "solid-js";

const modelCache = new Map(); // Each model's name will be its key

//Game scene variables
const gameModelFiles = import.meta.glob("/src/assets/models/game/*.glb", {
  eager: false,
});
const gameModelMap = new Map(); //Map of model names to paths

//Project Card scene variables
const projectCardModelFiles = import.meta.glob(
  "/src/assets/models/project_card/*.glb",
  {
    eager: false,
  }
);
//
let projectCardCameras = new Map();
// const cameras = [];  // Have a list of cameras to call render on?
const loadingPromises = new Map(); // Each model async load function
const gltfLoader = new GLTFLoader();

const projectCardScene = new THREE.Scene();
const gameViewScene = new THREE.Scene();

const projectCardModels = [];
const gameModels = [];

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "default",
});

const MODEL_VIEW_OFFSET = 30; // Offset between models so that each camera will not see the model despite orbiting around

async function init() {
  console.log("[ResourceManager] Initializing shared Three.js resources");
  optimizeRenderer(renderer);

  // Make a map of models names and their paths
  for (const path in modelFiles) {
    const filename = path.split("/").pop();
    const id = filename.replace(".glb", "");
    modelMap.set(id, path);
    s;
    console.log(`[ResourceManager] Registered model: ${id} -> ${path}`);
  }

  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit for performance

  // Initialize the model view scene.
  projectCardScene.background = null;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  projectCardScene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight1.position.set(1, 2, 3);
  projectCardScene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
  dirLight2.position.set(-1, -1, -2);
  projectCardScene.add(dirLight2);

  //Initialize the game view scene.
  gameViewScene.background = THREE.Color().setHex(0x5d93cf);

  // Preload models
  preloadModels();

  // Add the models for project card thumbnails to the project card map

  // Add the models for the game scene to the game map.
}

async function preloadModels() {
  console.log(`[ResourceManager] Starting preload of ${modelMap.size} models`);

  const loadPromises = [];

  for (const [id, path] of modelMap.entries()) {
    // Only start preloading if not already in cache or loading
    if (!modelCache.has(id) && !loadingPromises.has(id)) {
      loadPromises.push(preloadSingleModel(id, path));
    }
  }

  // Wait for all models to preload
  try {
    await Promise.allSettled(loadPromises);
    console.log("[ResourceManager] All models preloaded");
  } catch (error) {
    console.warn("[ResourceManager] Some models failed to preload:", error);
  }
}

// Preload a single model
async function preloadSingleModel(id, path) {
  console.log(`[ResourceManager] Preloading model: ${id}`);
  try {
    // Import the module (this triggers the actual dynamic import)
    const moduleLoader = modelFiles[path];
    const module = await moduleLoader();
    const url = module.default; // The default export is the URL

    // Load the model using its URL
    await loadModel(url, id);
    console.log(`[ResourceManager] Successfully preloaded model: ${id}`);
  } catch (error) {
    console.error(`[ResourceManager] Failed to preload model ${id}:`, error);
    throw error;
  }
}

// Load a model and cache it
function loadModel(url, id) {
  // Return cached promise if this model is currently loading
  if (loadingPromises.has(id)) {
    console.log(
      `[ResourceManager] Model ${id} is already loading, returning existing promise`
    );
    return loadingPromises.get(id);
  }

  // Return cached model if available
  if (modelCache.has(id)) {
    console.log(
      `[ResourceManager] Model ${id} found in cache, returning clone`
    );
    return Promise.resolve(modelCache.get(id).clone());
  }

  console.log(`[ResourceManager] Loading model from URL: ${url}`);

  // Load the model
  const loadPromise = new Promise((resolve, reject) => {
    gltfLoader.load(
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
        modelCache.set(id, model);
        loadingPromises.delete(id);

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
        loadingPromises.delete(id);
        reject(error);
      }
    );
  });

  // Store the promise to avoid duplicate loads
  loadingPromises.set(id, loadPromise);
  return loadPromise;
}

async function getModel(id) {
  console.log(`[ResourceManager] Getting model with ID: ${id}`);

  if (!modelMap.has(id)) {
    console.error(`[ResourceManager] No model found with ID: ${id}`);
    return Promise.reject(new Error(`Model with ID '${id}' not found`));
  }

  if (modelCache.has(id)) {
    console.log(`[ResourceManager] Returning cached model ${id}`);
    return Promise.resolve(modelCache.get(id).clone());
  } else if (loadingPromises.has(id)) {
    // Wait for model to finish loading
    console.log(`[ResourceManager] Model ${id} is currently loading`);
    return loadingPromises.get(id);
  } else {
    // Load the model on demand
    console.log(`[ResourceManager] Loading model ${id} on demand`);
    const path = modelMap.get(id);

    try {
      // Import the module
      const moduleLoader = modelFiles[path];
      const module = await moduleLoader();
      const url = module.default;

      console.log(`[ResourceManager] Loading with ${url}`);

      // Load the model using its URL
      return loadModel(url, id);
    } catch (error) {
      console.error(`[ResourceManager] Failed to load model ${id}:`, error);
      return Promise.reject(error);
    }
  }
}

function render(camera, canvas) {
  console.log("[ResourceManager] yay");
  if (!renderer || !scene || !canvas || THREE.Camera) return;

  // Resize renderer if necessary
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const needsResize = canvas.width !== width || canvas.height !== height;

  if (needsResize) {
    renderer.setSize(width, height, false);
    canvas.width = width;
    canvas.height = height;
  }

  // Set the canvas as the output target
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (renderer.domElement !== canvas) {
    canvas.appendChild(renderer.domElement);
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Create a model viewer which will have a camera look at 1 model based on that model's position and size
// It will return a canvas which the renderer will render to in addition to any other canvases created by subsequent calls of this function.
// I could just make a ModelViewer component and have a function pass the camera, orbit controls
// Or I could just write this in the ProjectCard component and not have to worry about this.

function createModelViewer(modelName) {
  const aspect = containerRef.clientWidth / containerRef.clientHeight;
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

  const CAMERA_OFFSET = THREE.Vector3(3, 2, 5);

  camera.setPosition(getModel(modelName).position + CAMERA_OFFSET);

  controls = new OrbitControls(camera, canvasElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 1.0;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minDistance = 1;
  controls.maxDistance = 20;
  controls.update();
}

let time = Date.now();

function tick() {
  const currentTime = Date.now();
  const deltaTime = currentTime - time;
  time = currentTime;

  //Slowly rotate all ProjectCard models
  // for each Project Card model, if camera is enabled, render each camera's view

  projectCardModels;

  //All game models can use their animation mixers
  // If scroll view is not enabled, don't render the game camera
  gameModels;
  requestAnimationFrame(animate);
}

function updateActiveProjectCardCameras(indices = []) {
  const activeProjectCameraIndices = [];
  for (let index = 0; index < indices.length; index++) {
    const camera_index = indices[index];
    projectCardCameras[index] = true;
  }
}

animate();

export { init, createModelViewer };

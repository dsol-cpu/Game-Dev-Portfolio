import { CAMERA_SECTIONS } from "../data/sections";
import { PerspectiveCamera } from "../extern/three/three.core.min";
import { registerCamera, getCamerasByCategory } from "./camera-registry";

// Constants
const C = {
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 300,
  NEAR: 0.1,
  FAR: 1000,
};

/**
 * Initialize about section canvas
 */
export async function initAboutCanvas() {
  // Get the about section and ensure it exists
  const aboutSection = document.getElementById("about");
  if (!aboutSection) {
    console.warn("About section not found");
    return;
  }

  // Get the canvas container within the about section
  const canvasContainer = aboutSection.querySelector(".about-canvas-container");
  if (!canvasContainer) {
    console.warn("Canvas container not found in about section");
    return;
  }

  // Get the canvas element
  const canvas = document.getElementById("about-threejs-canvas");
  if (!canvas) {
    console.warn("About canvas element not found");
    return;
  }

  const ctx = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!ctx) {
    console.warn("WebGL context could not be created");
    return;
  }

  // Update canvas dimensions based on container size
  function updateCanvasDimensions() {
    // Get the actual dimensions of the container
    const containerRect = canvasContainer.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // Set canvas dimensions to match container
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Update camera aspect ratio
    if (camera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    console.info(`Canvas resized to ${width}x${height}`);
  }

  // Create and register camera
  const camera = new PerspectiveCamera(
    60,
    canvas.width / canvas.height,
    C.NEAR,
    C.FAR
  );
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);

  // Register the camera with the system
  registerCamera(
    camera,
    null,
    ctx,
    {
      type: CAMERA_SECTIONS.ABOUT,
      elementId: aboutSection.id || CAMERA_SECTIONS.ABOUT,
      section: CAMERA_SECTIONS.ABOUT,
    },
    true
  );

  // Initial canvas sizing
  updateCanvasDimensions();

  // Add resize event listener
  window.addEventListener("resize", updateCanvasDimensions);

  // Log successful initialization
  console.info(
    "Initialized about canvas and registered its camera!",
    getCamerasByCategory(CAMERA_SECTIONS.ABOUT)
  );
}

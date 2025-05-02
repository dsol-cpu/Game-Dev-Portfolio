import { createSimpleAutorotation, registerCamera } from "./camera-registry";
import { PerspectiveCamera, Vector3 } from "../extern/three/three.core.min";
import { CAMERA_SECTIONS } from "../data/sections";
/**
 * Initialize about section canvas
 */
export function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const canvas = aboutSection.querySelector(".about-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  // Set canvas dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;
  canvas.width = width;
  canvas.height = height;

  // Create and register camera
  const camera = new PerspectiveCamera(60, width / height, C.NEAR, C.FAR);
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);

  registerCamera(
    camera,
    createSimpleAutorotation(camera, new Vector3(0, 0, 0), 5, 0),
    ctx,
    {
      type: CAMERA_SECTIONS.ABOUT,
      elementId: aboutSection.id || CAMERA_SECTIONS.ABOUT,
      section: CAMERA_SECTIONS.ABOUT,
    },
    true
  );
}

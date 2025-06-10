import { PerspectiveCamera } from "./extern/three/three.core.min";
import { registerCamera } from "./three/threejs-manager";

export async function initAboutCanvas() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const canvas = aboutSection.querySelector(".about-canvas");
  if (!canvas) return;

  canvas.style.display = "block";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas dimensions
  const width = canvas.clientWidth || C.DEFAULT_WIDTH;
  const height = canvas.clientHeight || C.DEFAULT_HEIGHT;
  canvas.width = width;
  canvas.height = height;

  // Create and register camera
  const camera = new PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);

  registerCamera(camera, ctx);
  console.info("initialized about canvas and registered its camera! ");
}

export async function initAboutGif() {
  const aboutSection = document.querySelector(".about");
  if (!aboutSection) return;

  const aboutGif = document.querySelector("#about .about-container > img");
  if (!aboutGif) return;
}

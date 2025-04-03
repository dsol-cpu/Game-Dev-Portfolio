import * as THREE from "three";
import { colors } from "../constants/constants";

export const setupScene = (containerRef) => {
  // More robust handling of the container reference
  let container;

  // Handle different ways the container might be passed
  if (typeof containerRef === "function") {
    // SolidJS ref function
    container = containerRef();
  } else if (containerRef && containerRef.nodeType) {
    // Already a DOM element
    container = containerRef;
  } else if (containerRef && typeof containerRef === "object") {
    // Might be a ref object with .current or another property
    container =
      containerRef.current ||
      containerRef.element ||
      containerRef.dom ||
      containerRef;
  } else {
    // Last resort: could be a string ID
    container =
      typeof containerRef === "string"
        ? document.getElementById(containerRef)
        : containerRef;
  }

  // Validate we have a proper DOM element
  if (
    !container ||
    !container.appendChild ||
    typeof container.appendChild !== "function"
  ) {
    console.error(
      "Invalid container reference provided to setupScene:",
      containerRef
    );
    throw new Error("Container reference must resolve to a valid DOM element");
  }

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.sky);
  scene.fog = new THREE.Fog(colors.sky, 20, 100);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 15);
  camera.lookAt(0, 0, 0);

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  return { scene, camera, renderer };
};

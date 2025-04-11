import * as THREE from "three";
import { colors } from "../constants/constants";
import { deviceStore } from "../stores/device";
import {
  resolveContainer,
  setupShadows,
  optimizeRenderer,
} from "../utils/deviceUtils";

export const setupScene = (() => {
  const directionalLightPosition = new THREE.Vector3(10, 10, 10);
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  let containerWidth = 0;
  let containerHeight = 0;

  return (containerRef) => {
    const { isMobile } = deviceStore;

    // Resolve container reference
    const container = resolveContainer(containerRef);

    // Validate DOM element
    if (!container || typeof container.appendChild !== "function") {
      throw new Error("Invalid container: must resolve to a valid DOM element");
    }

    // Cache container dimensions
    containerWidth = container.clientWidth;
    containerHeight = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.sky);
    scene.fog = new THREE.Fog(colors.sky, 20, 100);

    // Camera setup with cached aspect ratio
    const camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 15);
    camera.lookAt(cameraTarget);

    // Renderer setup with device-specific optimizations
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile(), // Disable antialiasing on mobile for performance
      powerPreference: "high-performance",
      precision: isMobile() ? "lowp" : "mediump",
      stencil: false,
      alpha: false, // Optimization: disable alpha when using background color
    });

    // Apply device-specific renderer optimizations
    optimizeRenderer(renderer);
    renderer.setSize(containerWidth, containerHeight);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.copy(directionalLightPosition);

    // Set up shadows with device-specific optimizations
    setupShadows(renderer, directionalLight);

    // Batch scene additions
    scene.add(ambientLight, directionalLight);

    // Create resize handler that can be called externally
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      // Only update if dimensions actually changed
      if (newWidth !== containerWidth || newHeight !== containerHeight) {
        containerWidth = newWidth;
        containerHeight = newHeight;

        camera.aspect = containerWidth / containerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerWidth, containerHeight);
      }
    };

    return {
      scene,
      camera,
      renderer,
      handleResize, // Export resize handler for external use
    };
  };
})();

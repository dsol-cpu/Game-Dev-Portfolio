import * as THREE from "three";
import { colors } from "../constants/constants";
import { deviceStore } from "../stores/device";
import {
  resolveContainer,
  setupShadows,
  optimizeRenderer,
  isAndroidDevice,
  createFillLight,
  addHemisphereLight,
} from "../utils/deviceUtils";

export const setupScene = (() => {
  const directionalLightPosition = new THREE.Vector3(10, 10, 10);
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  let containerWidth = 0;
  let containerHeight = 0;

  return (containerRef) => {
    const { isMobile } = deviceStore;
    const isAndroid = isAndroidDevice();

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
    scene.fog = new THREE.Fog(
      colors.sky,
      isAndroid ? 15 : 20,
      isAndroid ? 70 : 100
    );

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
      precision: isAndroid ? "mediump" : isMobile() ? "lowp" : "mediump",
      stencil: false,
      alpha: false, // Optimization: disable alpha when using background color
    });

    // Apply device-specific renderer optimizations
    optimizeRenderer(renderer);
    renderer.setSize(containerWidth, containerHeight);
    container.appendChild(renderer.domElement);

    // Lighting - use hemisphere light for more natural shadow appearance
    const hemiLight = addHemisphereLight(scene);

    // Lower ambient light intensity since we have hemisphere light
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      isAndroid ? 0.3 : 0.2
    );

    // Main directional light - adjust position for better shadow angles
    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      isAndroid ? 0.6 : 0.8
    );
    directionalLight.position.copy(directionalLightPosition);

    // Add a fill light from the opposite direction (for Android)
    const fillLight = createFillLight(scene, directionalLight);

    // Set up shadows with device-specific optimizations
    setupShadows(renderer, directionalLight);

    // Add lights to scene
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

import * as THREE from "three";
import { colors } from "../constants/constants";

export const setupScene = (() => {
  const directionalLightPosition = new THREE.Vector3(10, 10, 10);
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  let containerWidth = 0;
  let containerHeight = 0;

  /**
   * Resolves various container reference types to a DOM element
   * @param {*} containerRef - Reference to the container (function, DOM element, ref object, or string ID)
   * @returns {HTMLElement} The resolved DOM element
   */
  const resolveContainer = (containerRef) => {
    // Skip resolution if already a DOM element
    if (containerRef && containerRef.nodeType) {
      return containerRef;
    }

    // Handle SolidJS ref function
    if (typeof containerRef === "function") {
      return containerRef();
    }

    if (containerRef && typeof containerRef === "object") {
      return (
        containerRef.current ||
        containerRef.element ||
        containerRef.dom ||
        containerRef
      );
    }

    if (typeof containerRef === "string") {
      return document.getElementById(containerRef);
    }

    return containerRef;
  };

  return (containerRef) => {
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

    // Renderer setup with performance options
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      precision: "mediump",
      stencil: false,
    });

    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.copy(directionalLightPosition);

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

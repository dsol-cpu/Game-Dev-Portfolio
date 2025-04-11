import * as THREE from "three";

/**
 * Detects if the current device is a mobile device
 * @returns {boolean} True if the device is mobile, false otherwise
 */
export const isMobileDevice = () => {
  // Check using user agent (most common method)
  const userAgentCheck =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Additional check using screen width
  const screenWidthCheck = window.innerWidth <= 768;

  // Check for touch capability (most mobile devices have touch)
  const touchCheck =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  // Return true if the user agent indicates mobile OR
  // if the screen is narrow AND has touch capabilities
  return userAgentCheck || (screenWidthCheck && touchCheck);
};

/**
 * Detects if the current device is a tablet
 * @returns {boolean} True if the device is a tablet, false otherwise
 */
export const isTabletDevice = () => {
  const userAgentCheck = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
  const dimensionCheck = window.innerWidth <= 1024 && window.innerWidth > 768;
  const touchCheck = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  return userAgentCheck || (dimensionCheck && touchCheck);
};

/**
 * Gets the device type based on screen size and capabilities
 * @returns {'mobile'|'tablet'|'desktop'} The detected device type
 */
export const getDeviceType = () => {
  if (isMobileDevice()) return "mobile";
  if (isTabletDevice()) return "tablet";
  return "desktop";
};

/**
 * Checks if the device is in portrait or landscape orientation
 * @returns {'portrait'|'landscape'} The current orientation
 */
export const getOrientation = () => {
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
};

/**
 * Optimizes Three.js renderer settings based on device capabilities
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer instance
 */
export const optimizeRenderer = (renderer) => {
  if (!renderer) return;

  const mobile = isMobileDevice();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 2));

  if (mobile) {
    renderer.sortObjects = false; // Optimization for simpler scenes
  }
};

/**
 * Configure shadow settings for Three.js based on device capabilities
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 * @param {THREE.DirectionalLight} directionalLight - The directional light for shadows
 */
export const setupShadows = (renderer, directionalLight) => {
  if (!renderer || !directionalLight) return;

  const mobile = isMobileDevice();

  // Enable shadows on the renderer
  renderer.shadowMap.enabled = true;

  if (mobile) {
    renderer.shadowMap.type = THREE.PCFShadowMap;
    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;

    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;

    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;

    directionalLight.shadow.radius = 2;
  } else {
    // For desktop
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;

    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;

    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
  }

  // Configure directional light to cast shadows
  directionalLight.castShadow = true;

  // Update the shadow camera - important to apply changes
  directionalLight.shadow.camera.updateProjectionMatrix();
};

/**
 * Add an ambient hemispheric light to improve shadow appearance
 * @param {THREE.Scene} scene - The Three.js scene
 * @returns {THREE.HemisphereLight} The hemisphere light
 */
export const addHemisphereLight = (scene) => {
  // Create hemisphere light (sky color, ground color, intensity)
  const hemiLight = new THREE.HemisphereLight(
    0xffffff, // Sky color
    0xffffff, // Ground color
    0.5
  );

  scene.add(hemiLight);
  return hemiLight;
};

/**
 * Resolves various container reference types to a DOM element
 * @param {*} containerRef - Reference to the container (function, DOM element, ref object, or string ID)
 * @returns {HTMLElement} The resolved DOM element
 */
export const resolveContainer = (containerRef) => {
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

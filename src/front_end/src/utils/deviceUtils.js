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

    // Set precision for shadows on mobile without global highp
    const gl = renderer.getContext();
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : "";

      // Check if using mobile GPU
      const isMobileGPU = /Mali|Adreno|PowerVR|Apple GPU/i.test(renderer);

      if (isMobileGPU) {
        // Set precision for shadows only
        const oldOnBeforeCompile = THREE.ShaderChunk.shadowmap_pars_fragment;
        THREE.ShaderChunk.shadowmap_pars_fragment = oldOnBeforeCompile.replace(
          "#ifdef USE_SHADOWMAP",
          "#ifdef USE_SHADOWMAP\nprecision highp float;\nprecision highp int;"
        );
      }
    }
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

  // Configure shadow quality based on device
  if (mobile) {
    // Use basic shadow map for mobile to avoid precision artifacts
    renderer.shadowMap.type = THREE.BasicShadowMap;
    directionalLight.shadow.mapSize.width = 1024; // Increase shadow map size
    directionalLight.shadow.mapSize.height = 1024;

    // Critical adjustments for mobile shadow rendering
    directionalLight.shadow.bias = -0.002; // More aggressive bias
    directionalLight.shadow.normalBias = 0.1; // Increase normal bias

    // Reduce shadow camera frustum to improve precision in smaller area
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
  } else {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better quality for desktop
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;

    // Desktop settings
    directionalLight.shadow.bias = -0.001;
    directionalLight.shadow.normalBias = 0.05;

    // Wider frustum for desktop
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

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
 * Detects if the device is an Android device
 * @returns {boolean} True if the device is Android, false otherwise
 */
export const isAndroidDevice = () => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * Check if device is an older Android (likely to have WebGL limitations)
 * @returns {boolean} True if the device is likely an older Android device
 */
export const isOlderAndroid = () => {
  if (!isAndroidDevice()) return false;

  // Check Android version number from user agent
  const match = navigator.userAgent.match(/Android\s([0-9\.]*)/);
  if (match && match[1]) {
    const version = parseFloat(match[1]);
    return version < 9; // Consider Android 8 and lower as "older"
  }

  return false;
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

  const isAndroid = isAndroidDevice();
  const isOldAndroid = isOlderAndroid();

  // Fixed pixel ratio - particularly important for older Android
  renderer.setPixelRatio(1);

  // For older Android devices, enable additional optimizations
  if (isOldAndroid) {
    renderer.shadowMap.autoUpdate = false; // Manual shadow updates only
    renderer.physicallyCorrectLights = false;
    renderer.toneMapping = THREE.NoToneMapping;
  }
};

/**
 * Configure shadow settings for Three.js based on device capabilities
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
 * @param {THREE.DirectionalLight} directionalLight - The directional light for shadows
 */
export const setupShadows = (renderer, directionalLight) => {
  if (!renderer || !directionalLight) return;

  const isAndroid = isAndroidDevice();
  const isOldAndroid = isOlderAndroid();

  // Enable shadows on the renderer (unless it's an older Android)
  renderer.shadowMap.enabled = true;

  // Special handling for Android devices
  if (isAndroid) {
    // For older Android, use the most basic shadow type
    if (isOldAndroid) {
      renderer.shadowMap.type = THREE.BasicShadowMap;

      // Very small shadow maps for older Android
      directionalLight.shadow.mapSize.width = 256;
      directionalLight.shadow.mapSize.height = 256;

      // Tighter frustum for better precision
      directionalLight.shadow.camera.near = 2;
      directionalLight.shadow.camera.far = 30;
      directionalLight.shadow.camera.left = -5;
      directionalLight.shadow.camera.right = 5;
      directionalLight.shadow.camera.top = 5;
      directionalLight.shadow.camera.bottom = -5;

      // More aggressive bias settings for basic shadow maps
      directionalLight.shadow.bias = -0.005;
      directionalLight.shadow.normalBias = 0.05;
    } else {
      // For newer Android devices
      renderer.shadowMap.type = THREE.PCFShadowMap;

      directionalLight.shadow.mapSize.width = 512;
      directionalLight.shadow.mapSize.height = 512;

      directionalLight.shadow.camera.near = 1;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -10;
      directionalLight.shadow.camera.right = 10;
      directionalLight.shadow.camera.top = 10;
      directionalLight.shadow.camera.bottom = -10;

      directionalLight.shadow.bias = -0.001;
      directionalLight.shadow.normalBias = 0.03;
    }
  } else {
    // Non-Android devices (iOS, iPad, desktop)
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;

    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;

    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;
  }

  // Enable shadow casting
  directionalLight.castShadow = true;

  // Update the camera projection matrix
  directionalLight.shadow.camera.updateProjectionMatrix();

  // For older Android, we need to manually update shadows once on init
  if (isOldAndroid) {
    // Force shadow map update once
    renderer.shadowMap.needsUpdate = true;
  }
};

/**
 * Apply Android shadow compatibility for an entire scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export const applyAndroidShadowFix = (scene) => {
  if (!isAndroidDevice()) return;

  // Traverse the scene and fix material settings
  scene.traverse((object) => {
    if (object.isMesh && object.material) {
      // For arrays of materials
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => {
          // Disable shadow-causing features that may cause problems
          material.flatShading = true;

          // Ensure material updates
          material.needsUpdate = true;
        });
      } else {
        // For single materials
        object.material.flatShading = true;
        object.material.needsUpdate = true;
      }
    }
  });
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

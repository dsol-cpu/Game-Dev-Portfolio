/**
 * Detects if the current device is a low-end device with limited WebGL capabilities
 * @returns {boolean} True if the device is low-end
 */
export function detectLowEndDevice() {
  // Create results object to store our findings
  const results = {
    isMobileDevice: false,
    hasLowEndGPU: false,
    hasLowCPUCount: false,
    hasLowMemory: false,
    hasWebGLLimitations: false,
  };

  // Check for mobile devices
  results.isMobileDevice =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Check CPU count
  results.hasLowCPUCount =
    typeof navigator.hardwareConcurrency !== "undefined" &&
    navigator.hardwareConcurrency <= 4;

  // Check memory
  results.hasLowMemory =
    typeof navigator.deviceMemory !== "undefined" &&
    navigator.deviceMemory <= 4;

  // Check for low-end GPUs - more comprehensive list
  const lowEndGPUPatterns = [
    // Mobile GPUs
    /Adreno [23]\d\d/i,
    /Adreno 4[0-2]\d/i, // Only older Adreno 400 series
    /Mali-[GT]6\d\d/i,
    /Mali-[GT]5\d\d/i,
    /Mali-[GT]4\d\d/i,
    /Mali-[GT]3\d\d/i,
    /PowerVR/i,

    // Integrated GPUs
    /Intel(R)? (HD|UHD) Graphics/i,
    /Intel(R)? Iris(R)? Graphics/i,

    // Older discrete GPUs
    /GeForce (7|8|9)\d\d/i,
    /GeForce GT [45]\d\d/i,
    /Radeon HD [2345]\d\d\d/i,
  ];

  // Try to get GPU info via WebGL
  let renderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
        console.log("WebGL Renderer:", renderer);
      }

      // Check WebGL capabilities
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
      const maxFragmentUniforms = gl.getParameter(
        gl.MAX_FRAGMENT_UNIFORM_VECTORS
      );

      console.log("WebGL capabilities:", {
        maxTextureSize,
        maxRenderbufferSize,
        maxViewportDims,
        maxVertexUniforms,
        maxFragmentUniforms,
      });

      // Consider WebGL limitations
      results.hasWebGLLimitations =
        maxTextureSize < 4096 ||
        maxRenderbufferSize < 4096 ||
        maxVertexUniforms < 256 ||
        maxFragmentUniforms < 224;
    }
  } catch (e) {
    console.warn("WebGL detection failed:", e);
    // If we can't detect WebGL capabilities, be conservative
    results.hasWebGLLimitations = true;
  }

  // Check if GPU name matches any low-end pattern
  results.hasLowEndGPU = lowEndGPUPatterns.some((pattern) =>
    pattern.test(renderer)
  );

  // For desktop: require multiple signals to consider it low-end
  if (!results.isMobileDevice) {
    return (
      (results.hasLowCPUCount && results.hasLowEndGPU) ||
      (results.hasLowMemory && results.hasLowEndGPU) ||
      results.hasWebGLLimitations
    );
  }

  // For mobile: any signal is enough to consider it low-end
  return (
    results.isMobileDevice &&
    (results.hasLowEndGPU ||
      results.hasLowCPUCount ||
      results.hasLowMemory ||
      results.hasWebGLLimitations)
  );
}

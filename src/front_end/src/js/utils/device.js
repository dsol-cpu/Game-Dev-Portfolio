/**
 * Optimized Device Performance Detection Module
 * Streamlined for maximum performance while maintaining readability
 */

// Performance levels
export const PERFORMANCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

// Constants
const CACHE_KEY = "device_performance_profile";
const CACHE_TTL = 86400000; // 24h
const GPU_PATTERNS = [
  [
    5,
    /nvidia r?tx\s*(30|40|50|4090|4080|3090|3080)|radeon\s*rx\s*(7|69|68)|arc\s*a[7-9]/i,
  ],
  [
    4,
    /nvidia r?tx|nvidia gtx\s*1[6-9]|nvidia gtx\s*2|radeon\s*rx\s*(6|5[7-9])|apple\s*m[2-3]|intel arc/i,
  ],
  [
    3,
    /nvidia gtx\s*[1-9]\d{2,}|radeon\s*(rx\s*5|vega)|iris xe|mali-g7|adreno\s*[6-7]|apple\s*m1/i,
  ],
  [
    2,
    /nvidia gt\s*[6-9]|intel\s*u?hd\s*[6-9]|iris\s*(plus|pro)|mali-g[56]|adreno\s*5/i,
  ],
  [1, /intel\s*u?hd|mali|adreno|powervr/i],
];

// Cached values
let cache = { webgl: null, hardware: null, quick: null };
let isMobileCache = null;

/**
 * Main detection function
 */
export function detectDevicePerformance(options = {}) {
  const { forceRefresh = false, asyncMode = false } = options;

  if (!forceRefresh) {
    const cached = getCache();
    if (cached) return asyncMode ? Promise.resolve(cached) : cached;
  }

  const result = getQuickEstimate();

  if (!asyncMode) {
    setCache(result);
    return result;
  }

  return scheduleAdvanced().then((advanced) => {
    setCache(advanced);
    return advanced;
  });
}

/**
 * Quick performance estimate
 */
function getQuickEstimate() {
  if (cache.quick) return cache.quick;

  const mobile = isMobile();
  const cores = Math.max(
    navigator.hardwareConcurrency || (mobile ? 4 : 4),
    mobile ? 4 : 4
  );
  const memory =
    navigator.deviceMemory ||
    (mobile ? (cores >= 6 ? 4 : 2) : cores >= 8 ? 8 : 4);

  if (!hasWebGL()) return (cache.quick = PERFORMANCE_LEVELS.LOW);

  // Optimized scoring with lookup tables
  const cpuScore = mobile
    ? cores >= 8
      ? 40
      : cores >= 6
      ? 32
      : cores >= 4
      ? 24
      : 16
    : cores >= 16
    ? 50
    : cores >= 12
    ? 45
    : cores >= 8
    ? 38
    : cores >= 4
    ? 28
    : 20;

  const memScore = mobile
    ? memory >= 6
      ? 30
      : memory >= 4
      ? 24
      : memory >= 2
      ? 18
      : 12
    : memory >= 16
    ? 35
    : memory >= 8
    ? 28
    : memory >= 4
    ? 20
    : 15;

  const total = cpuScore + memScore + (mobile ? 0 : 15);

  return (cache.quick =
    total >= 75
      ? PERFORMANCE_LEVELS.HIGH
      : total >= 45
      ? PERFORMANCE_LEVELS.MEDIUM
      : PERFORMANCE_LEVELS.LOW);
}

/**
 * Advanced detection with WebGL benchmarking
 */
function scheduleAdvanced() {
  return new Promise((resolve) => {
    (window.requestIdleCallback || setTimeout)(() => {
      const webgl = getWebGL();
      const hardware = getHardware();
      const browser = getBrowser();

      if (webgl.score > 60) {
        benchmarkWebGL().then((advanced) => {
          webgl.advanced = advanced;
          resolve(calculateFinal({ webgl, hardware, browser }));
        });
      } else {
        resolve(calculateFinal({ webgl, hardware, browser }));
      }
    }, 0);
  });
}

/**
 * WebGL detection and scoring
 */
function getWebGL() {
  if (cache.webgl) return cache.webgl;

  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2") ||
    canvas.getContext("webgl") ||
    canvas.getContext("experimental-webgl");

  if (!gl) return (cache.webgl = { supported: false, score: 0 });

  let renderer = "Unknown",
    tier = 0;
  try {
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    if (debug) {
      renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || "Unknown";
      tier = getGPUTier(renderer);
    }
  } catch {}

  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const extensions = [
    "EXT_texture_filter_anisotropic",
    "OES_texture_float",
    "ANGLE_instanced_arrays",
  ].filter((ext) => gl.getExtension(ext)).length;
  const isWebGL2 = !!canvas.getContext("webgl2");

  let score =
    tier * 20 * 0.6 +
    Math.min(100, maxTexture / 164) * 0.2 +
    extensions * 5 * 0.2;
  if (isWebGL2) score *= 1.15;

  return (cache.webgl = {
    supported: true,
    renderer,
    tier,
    isWebGL2,
    score: Math.min(100, Math.round(score)),
  });
}

/**
 * Hardware capabilities
 */
function getHardware() {
  if (cache.hardware) return cache.hardware;

  const mobile = isMobile();
  const cores = navigator.hardwareConcurrency || (mobile ? 4 : 4);
  const memory =
    navigator.deviceMemory ||
    (mobile ? (cores >= 6 ? 4 : 2) : cores >= 8 ? 8 : 4);
  const pixels = screen.width * screen.height * (window.devicePixelRatio || 1);

  // Optimized scoring
  const cpuScore = mobile
    ? Math.min(35, cores * 4)
    : Math.min(
        40,
        cores >= 16
          ? 40
          : cores >= 12
          ? 36
          : cores >= 8
          ? 30
          : cores >= 4
          ? 22
          : 15
      );

  const memScore = mobile
    ? Math.min(25, memory * 3)
    : Math.min(
        30,
        memory >= 16 ? 30 : memory >= 8 ? 24 : memory >= 4 ? 18 : 12
      );

  const deviceScore = mobile ? 8 : 25;
  const screenScore = Math.min(20, pixels / 200000);

  // Network adjustment
  let netAdj = 0;
  if (navigator.connection?.saveData) netAdj = -10;
  else if (navigator.connection?.effectiveType === "3g") netAdj = -5;

  // Battery check
  if ("getBattery" in navigator) {
    navigator
      .getBattery()
      .then((b) => {
        if (b.level < 0.2 && !b.charging) window.__deviceLowPowerMode = true;
      })
      .catch(() => {});
  }

  return (cache.hardware = {
    cores,
    memory,
    mobile,
    score: Math.max(
      10,
      cpuScore + memScore + deviceScore + screenScore + netAdj
    ),
  });
}

/**
 * Browser performance
 */
function getBrowser() {
  const features = [
    "requestAnimationFrame",
    "requestIdleCallback",
    "serviceWorker",
    "Worker",
    "WebAssembly",
  ].filter(
    (f) => f in window || (f === "Worker" && typeof Worker === "function")
  ).length;

  const start = performance.now();
  let sum = 0;
  for (let i = 0; i < 5000; i++) {
    sum += Math.sin(i * 0.01) * Math.cos(i * 0.01);
    if (i % 100 === 0) sum += Math.sqrt(i);
  }
  const duration = performance.now() - start;

  const benchScore = Math.min(75, Math.max(0, 100 - duration));
  const featureScore = features * 5;

  return {
    features,
    duration,
    score: Math.round(benchScore * 0.75 + featureScore * 0.25),
  };
}

/**
 * WebGL benchmark for high-end devices
 */
function benchmarkWebGL() {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

    if (!gl) return resolve(0);

    canvas.width = canvas.height = 256;

    const vs = createShader(
      gl,
      gl.VERTEX_SHADER,
      "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"
    );
    const fs = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      "precision highp float;uniform vec2 r;uniform float t;void main(){vec2 u=gl_FragCoord.xy/r;float x=u.x*15.+sin(t),y=u.y*15.+cos(t);for(int i=0;i<10;i++){float z=float(i)*.1;x+=.2*sin(y+z*t);y-=.2*cos(x+z*t);}gl_FragColor=vec4(sin(x)*.5+.5,cos(y)*.5+.5,sin(x+y)*.5+.5,1.);}"
    );
    const prog = createProgram(gl, vs, fs);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(prog);
    gl.uniform2f(gl.getUniformLocation(prog, "r"), 256, 256);

    const timeLoc = gl.getUniformLocation(prog, "t");
    let frames = 0;
    const start = performance.now();

    function frame() {
      if (frames >= 30) {
        const fps = 30000 / (performance.now() - start);
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buf);
        resolve(Math.min(100, Math.max(0, 40 + fps * 0.5)));
        return;
      }

      gl.uniform1f(timeLoc, frames * 0.1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frames++;
      requestAnimationFrame(frame);
    }

    frame();
  });
}

/**
 * Calculate final performance level
 */
function calculateFinal({ webgl, hardware, browser }) {
  if (!webgl.supported) return PERFORMANCE_LEVELS.LOW;

  const wScore = webgl.advanced || webgl.score;
  const weights = webgl.advanced ? [0.5, 0.3, 0.2] : [0.4, 0.4, 0.2];
  const score =
    wScore * weights[0] +
    hardware.score * weights[1] +
    browser.score * weights[2];

  if (hardware.memory < 2) return PERFORMANCE_LEVELS.LOW;
  if (window.__deviceLowPowerMode)
    return score >= 70 ? PERFORMANCE_LEVELS.MEDIUM : PERFORMANCE_LEVELS.LOW;

  return score >= 70
    ? PERFORMANCE_LEVELS.HIGH
    : score >= 40
    ? PERFORMANCE_LEVELS.MEDIUM
    : PERFORMANCE_LEVELS.LOW;
}

// Utility functions
const isMobile = () =>
  (isMobileCache ??= /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent
  ));
const hasWebGL = () => {
  try {
    return !!(
      document.createElement("canvas").getContext("webgl2") ||
      document.createElement("canvas").getContext("webgl")
    );
  } catch {
    return false;
  }
};
const getGPUTier = (r) => {
  const low = r.toLowerCase();
  for (const [tier, regex] of GPU_PATTERNS) if (regex.test(low)) return tier;
  return 0;
};
const createShader = (gl, type, src) => {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
};
const createProgram = (gl, vs, fs) => {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  return p;
};

const getCache = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return c && Date.now() - c.timestamp < CACHE_TTL ? c.level : null;
  } catch {
    return null;
  }
};
const setCache = (level) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ level, timestamp: Date.now() })
    );
  } catch {}
};

// Backward compatibility
export const isLowPoweredDevice = () => {
  const c = getCache();
  return c
    ? c === PERFORMANCE_LEVELS.LOW
    : getQuickEstimate() === PERFORMANCE_LEVELS.LOW;
};
export const hasWebGLSupport = hasWebGL;
export const getPerfLevel = () => detectDevicePerformance();

import { getDeltaTime } from "./time-manager.js";
import { isIdle } from "../user-interaction.js";

/**
 * Creates a highly optimized performance metrics overlay
 * Toggle visibility with F2 key
 */
export function createDeltaTimeMetricsOverlay() {
  // Use DocumentFragment for batch DOM manipulation (reduces reflows)
  const fragment = document.createDocumentFragment();

  // Pre-calculate styles in a single object for reuse
  const styles = {
    container:
      "position:fixed;bottom:20px;right:20px;width:280px;background:rgba(10,14,25,0.85);color:#fff;font-family:'Roboto','Segoe UI',sans-serif;font-size:12px;z-index:10000;pointer-events:none;border-radius:8px;box-shadow:0 5px 15px rgba(0,0,0,0.5);overflow:hidden;backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);transition:transform 0.3s ease,opacity 0.3s ease",
    header:
      "display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:rgba(30,34,45,0.9);border-bottom:1px solid rgba(255,255,255,0.1)",
    title: "font-weight:bold;display:flex;align-items:center;gap:5px",
    toggleInfo:
      "font-size:10px;color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px",
    content: "padding:15px;display:flex;flex-direction:column;gap:15px",
    statsArea: "display:grid;grid-template-columns:repeat(2,1fr);gap:10px",
    fpsCounter:
      "grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;border-radius:6px;background:rgba(255,255,255,0.05);padding:10px;margin-bottom:5px",
    fpsLabel: "font-size:12px;color:rgba(255,255,255,0.7)",
    fpsValue: "font-size:22px;font-weight:bold;color:#4ade80",
    stat: "display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:6px",
    statLabel: "font-size:11px;color:rgba(255,255,255,0.7)",
    statValue: "font-size:11px;font-weight:500",
    graphArea:
      "background:rgba(255,255,255,0.05);border-radius:6px;padding:10px;height:100px",
    graphTitle: "font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:5px",
    canvas: "width:100%;height:70px",
  };

  // Reuse DOM element creation function (reduces code duplication)
  const createElement = (tag, styleKey, text = null) => {
    const el = document.createElement(tag);
    el.style.cssText = styles[styleKey];
    if (text) el.textContent = text;
    return el;
  };

  // Pre-create RGB color strings for reuse
  const colors = {
    good: "#4ade80",
    warning: "#facc15",
    error: "#f87171",
    transparent: "rgba(255,255,255,0.1)",
    lightText: "rgba(255,255,255,0.7)",
  };

  // Create DOM structure with fewer nodes
  const container = createElement("div", "container");
  const header = createElement("div", "header");
  const title = createElement("div", "title");
  title.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg><span>Performance Metrics</span>';

  const toggleInfo = createElement("div", "toggleInfo", "[F2] Toggle");
  header.append(title, toggleInfo);

  const content = createElement("div", "content");
  const statsArea = createElement("div", "statsArea");

  const fpsCounter = createElement("div", "fpsCounter");
  const fpsLabel = createElement("div", "fpsLabel", "FPS");
  const fpsValue = createElement("div", "fpsValue", "60.0");
  fpsCounter.append(fpsLabel, fpsValue);

  // Create stats using a factory pattern
  const statElements = {};
  const statValues = {};

  const createStat = (id, label) => {
    const stat = createElement("div", "stat");
    const statLabel = createElement("div", "statLabel", label);
    const statValue = createElement("div", "statValue", "N/A");
    stat.append(statLabel, statValue);
    statsArea.appendChild(stat);
    statElements[id] = stat;
    statValues[id] = statValue;
  };

  // Add FPS counter first
  statsArea.appendChild(fpsCounter);

  // Create stats (with cached references for updates)
  createStat("delta", "Δ Time (ms)");
  createStat("focus", "Focus");
  createStat("idle", "Idle");
  createStat("target", "Target FPS");

  // Graph section
  const graphArea = createElement("div", "graphArea");
  const graphTitle = createElement("div", "graphTitle", "FPS History");

  // Optimize canvas setup
  const canvas = document.createElement("canvas");
  canvas.style.cssText = styles.canvas;
  // Set canvas dimensions once (avoids repeated layout recalculations)
  canvas.width = 240;
  canvas.height = 70;

  graphArea.append(graphTitle, canvas);
  content.append(statsArea, graphArea);
  container.append(header, content);
  fragment.appendChild(container);

  // Single DOM insertion (reduces reflows)
  document.body.appendChild(fragment);

  // Cache context and avoid recreating in render loop
  const ctx = canvas.getContext("2d", { alpha: false });

  // Use TypedArray for performance history (more efficient than regular array)
  const maxHistory = 60;
  const fpsHistory = new Float32Array(maxHistory);
  let historyIndex = 0;
  let historyFilled = false;

  // State flags
  let isVisible = true;
  let hasFocus = document.hasFocus();
  let isIdling = isIdle();
  let animFrameId = null;
  let lastTime = performance.now();

  // Pre-calculate graph elements for reuse
  const thresholdLines = [0, 1 / 3, 2 / 3, 1].map((ratio) =>
    Math.floor(canvas.height * ratio)
  );
  const canvasGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  canvasGradient.addColorStop(0, "rgba(74,222,128,0.2)");
  canvasGradient.addColorStop(1, "rgba(74,222,128,0)");

  // UI Visibility toggle (optimized)
  function toggleVisibility(event) {
    if (event && event.key === "F2") {
      isVisible = !isVisible;
      container.style.opacity = isVisible ? "1" : "0";
      container.style.transform = isVisible
        ? "translateY(0)"
        : "translateY(20px)";

      // Stop/start animation loop based on visibility
      if (isVisible) {
        if (!animFrameId) requestUpdate();
      } else {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
        // Use timeout for display change to allow CSS transition
        setTimeout(() => (container.style.display = "none"), 300);
      }

      if (event) event.preventDefault();
    }
  }

  // Optimized event listener (using passive where possible)
  window.addEventListener("keydown", toggleVisibility, { passive: false });

  // Cache focus check to reduce frequent DOM access
  window.addEventListener(
    "focus",
    () => {
      hasFocus = true;
    },
    { passive: true }
  );
  window.addEventListener(
    "blur",
    () => {
      hasFocus = false;
    },
    { passive: true }
  );

  // Reuse color function to avoid string recreation
  function getFpsColor(fps) {
    return fps >= 55 ? colors.good : fps >= 30 ? colors.warning : colors.error;
  }

  // Update data without DOM manipulation
  function updateData() {
    const delta = getDeltaTime();
    const fps = delta > 0 ? 1000 / (delta * 1000) : 0;

    // Optimized circular buffer
    fpsHistory[historyIndex] = fps;
    historyIndex = (historyIndex + 1) % maxHistory;
    if (!historyFilled && historyIndex === 0) historyFilled = true;

    return {
      fps,
      delta,
      // Cache idle state update to avoid extra function calls
      isIdling: isIdle(),
    };
  }

  // Optimize FPS calculation
  function getAverageFps() {
    let sum = 0;
    const count = historyFilled ? maxHistory : historyIndex;
    if (count === 0) return 0;

    // Manual loop unrolling for better performance
    const length = Math.min(count, maxHistory);
    for (let i = 0; i < length; i += 4) {
      sum += fpsHistory[i];
      if (i + 1 < length) sum += fpsHistory[i + 1];
      if (i + 2 < length) sum += fpsHistory[i + 2];
      if (i + 3 < length) sum += fpsHistory[i + 3];
    }

    return sum / count;
  }

  // Separate DOM update from animation frame
  function updateDOM(data) {
    const avgFps = getAverageFps();

    // Update FPS display
    fpsValue.textContent = avgFps.toFixed(1);
    fpsValue.style.color = getFpsColor(avgFps);

    // Update other stats (only if values actually changed)
    const deltaText = (data.delta * 1000).toFixed(1) + " ms";
    if (statValues.delta.textContent !== deltaText) {
      statValues.delta.textContent = deltaText;
    }

    // Update focus only when it changed
    if (hasFocus !== (statValues.focus.textContent === "Yes")) {
      statValues.focus.textContent = hasFocus ? "Yes" : "No";
      statValues.focus.style.color = hasFocus ? colors.good : colors.error;
    }

    // Update idle only when it changed
    if (data.isIdling !== isIdling) {
      isIdling = data.isIdling;
      statValues.idle.textContent = isIdling ? "Yes" : "No";
      statValues.idle.style.color = isIdling ? colors.warning : colors.good;
    }

    // Static value, set once
    if (statValues.target.textContent === "N/A") {
      statValues.target.textContent = "60";
    }
  }

  // Optimized graph drawing
  function drawFpsGraph() {
    if (!historyFilled && historyIndex === 0) return;

    // Clear with direct call (faster than clearRect)
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (fixed positions)
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;

    // Batch line drawing operations
    ctx.beginPath();
    for (let i = 0; i < thresholdLines.length; i++) {
      const y = thresholdLines[i];
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Calculate scaling factors once
    const maxValue = Math.max(...fpsHistory, 60);
    const scaleY = canvas.height / (maxValue * 1.2);
    const step = canvas.width / (maxHistory - 1);

    // Draw area graph
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    // Determine the proper length for iteration
    const length = historyFilled ? maxHistory : historyIndex;
    let startIdx = historyFilled ? historyIndex : 0;

    // Draw line segments with one path
    for (let i = 0; i < length; i++) {
      const idx = (startIdx + i) % maxHistory;
      const x = i * step;
      const y = canvas.height - fpsHistory[idx] * scaleY;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = canvasGradient;
    ctx.fill();

    // Draw line on top
    ctx.beginPath();
    startIdx = historyFilled ? historyIndex : 0;
    for (let i = 0; i < length; i++) {
      const idx = (startIdx + i) % maxHistory;
      const x = i * step;
      const y = canvas.height - fpsHistory[idx] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = colors.good;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw threshold line (60 FPS)
    const thresholdY = canvas.height - 60 * scaleY;
    if (thresholdY > 0 && thresholdY < canvas.height) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(canvas.width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Use requestAnimationFrame for update (more efficient than setInterval)
  function requestUpdate() {
    if (!isVisible) return;

    const now = performance.now();
    const elapsed = now - lastTime;

    // Throttle updates to ~60fps for efficiency
    if (elapsed > 16) {
      lastTime = now;
      const data = updateData();
      updateDOM(data);
      drawFpsGraph();
    }

    animFrameId = requestAnimationFrame(requestUpdate);
  }

  // Begin animation loop
  requestUpdate();

  // Return interface
  return {
    element: container,
    toggle: () => toggleVisibility({ key: "F2" }),
    isVisible: () => isVisible,
    destroy: () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener("keydown", toggleVisibility);
      window.removeEventListener("focus", () => {
        hasFocus = true;
      });
      window.removeEventListener("blur", () => {
        hasFocus = false;
      });
      container.remove();
      // Clear references for GC
      fpsHistory.fill(0);
    },
  };
}

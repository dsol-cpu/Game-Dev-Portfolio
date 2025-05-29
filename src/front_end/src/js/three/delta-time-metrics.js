import { getDeltaTime } from "./time.js";

const ONE_SECOND = 1000;

/**
 * Creates a minimal performance metrics display with FPS graph at the top right
 * Toggle visibility with F2 key
 */
export function createDeltaTimeMetricsOverlay() {
  // Create container element
  const container = document.createElement("div");

  // Minimal styling - position at top right
  container.style.position = "fixed";
  container.style.top = "10px";
  container.style.right = "10px";
  container.style.color = "#fff";
  container.style.fontFamily = "monospace";
  container.style.fontSize = "14px";
  container.style.fontWeight = "bold";
  container.style.textShadow = "1px 1px 2px rgba(0,0,0,0.8)";
  container.style.zIndex = "10";
  container.style.pointerEvents = "none";
  container.style.textAlign = "right";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "flex-end";
  container.style.gap = "5px";
  container.style.opacity = "0.9";
  container.style.transition = "opacity 0.2s ease";
  container.style.zIndex = "50";

  // Create text content with placeholder values
  const statsContainer = document.createElement("div");
  statsContainer.innerHTML = `
    <div>FPS: <span id="fps-value">60.0</span></div>
    <div>MS: <span id="delta-value">16.7</span></div>
  `;

  // Create canvas for FPS graph
  const canvas = document.createElement("canvas");
  canvas.width = 100; // Small width for minimal display
  canvas.height = 30; // Small height for minimal display
  canvas.style.display = "block";

  // Add elements to container
  container.appendChild(statsContainer);
  container.appendChild(canvas);
  document.body.appendChild(container);

  // Cache DOM references
  const elements = {
    fpsValue: container.querySelector("#fps-value"),
    deltaValue: container.querySelector("#delta-value"),
    canvas: canvas,
  };

  // Set up canvas context
  const ctx = canvas.getContext("2d");

  // Pre-allocate FPS history buffer
  const maxHistory = 50; // Size of history buffer
  const fpsHistory = new Float32Array(maxHistory);
  let historyIndex = 0;
  let historyFilled = false;

  // State management
  const state = {
    isVisible: true,
    rafId: null,
    lastUpdateTime: 0,
    avgFps: 60,
  };

  // Toggle visibility with F2
  function toggleVisibility(event) {
    if (event?.key === "F2") {
      state.isVisible = !state.isVisible;

      container.style.opacity = state.isVisible ? "0.9" : "0";

      if (state.isVisible) {
        if (!state.rafId) {
          state.lastUpdateTime = performance.now();
          state.rafId = requestAnimationFrame(updateLoop);
        }
      } else {
        if (state.rafId) {
          cancelAnimationFrame(state.rafId);
          state.rafId = null;
        }
      }

      event.preventDefault();
    }
  }

  // Add event listener for F2 key
  window.addEventListener("keydown", toggleVisibility, { passive: false });

  // Calculate average FPS
  function getAverageFps() {
    if (!historyFilled && historyIndex === 0) return 0;

    const count = historyFilled ? maxHistory : historyIndex;
    if (count === 0) return 0;

    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += fpsHistory[i];
    }

    return sum / count;
  }

  // Draw the FPS graph
  function drawFpsGraph() {
    if (!historyFilled && historyIndex === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find max FPS value
    let maxValue = 60; // Default max value
    for (let i = 0; i < (historyFilled ? maxHistory : historyIndex); i++) {
      if (fpsHistory[i] > maxValue) maxValue = fpsHistory[i];
    }

    // Calculate scaling factor
    const scaleY = canvas.height / maxValue;
    const step = canvas.width / (maxHistory - 1);

    // Draw 60 FPS line
    const threshold60 = Math.min(
      canvas.height - 60 * scaleY,
      canvas.height - 1
    );
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.setLineDash([2, 2]);
    ctx.moveTo(0, threshold60);
    ctx.lineTo(canvas.width, threshold60);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw FPS line
    ctx.beginPath();
    const startIdx = historyFilled ? historyIndex : 0;
    const length = historyFilled ? maxHistory : historyIndex;

    for (let i = 0; i < length; i++) {
      const idx = (startIdx + i) % maxHistory;
      const x = i * step;
      const y = canvas.height - fpsHistory[idx] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Draw line and fill area
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Fill area under the graph
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(74,222,128,0.3)");
    gradient.addColorStop(1, "rgba(74,222,128,0.05)");
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Update loop
  function updateLoop(timestamp) {
    if (!state.isVisible) return;

    const delta = getDeltaTime();
    // Calculate fps from deltaTime
    const fps = delta > 0 ? ONE_SECOND / (delta * ONE_SECOND) : 0;

    // Update circular buffer
    fpsHistory[historyIndex] = fps;
    historyIndex = (historyIndex + 1) % maxHistory;
    if (!historyFilled && historyIndex === 0) historyFilled = true;

    // Get average FPS
    const avgFps = getAverageFps();
    state.avgFps = avgFps;

    // Update display
    elements.fpsValue.textContent = avgFps.toFixed(1);
    elements.deltaValue.textContent = (delta * ONE_SECOND).toFixed(1) + " ms";

    // Set color based on FPS threshold
    elements.fpsValue.style.color =
      avgFps >= 55 ? "#4ade80" : avgFps >= 30 ? "#facc15" : "#f87171";

    // Draw the graph
    drawFpsGraph();

    state.rafId = requestAnimationFrame(updateLoop);
  }

  // Start the animation loop
  state.lastUpdateTime = performance.now();
  state.rafId = requestAnimationFrame(updateLoop);

  // Return interface
  return {
    element: container,
    toggle: () => toggleVisibility({ key: "F2" }),
    isVisible: () => state.isVisible,
    destroy: () => {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      window.removeEventListener("keydown", toggleVisibility);
      container.remove();
      fpsHistory.fill(0);
    },
  };
}

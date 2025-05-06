import { TimeManager } from "./time-manager.js";

export function createDeltaTimeMetricsOverlay() {
  // Create overlay container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.bottom = "0";
  container.style.right = "0";
  container.style.padding = "10px";
  container.style.background = "rgba(0, 0, 0, 0.6)";
  container.style.color = "#0f0";
  container.style.fontFamily = "monospace";
  container.style.fontSize = "12px";
  container.style.zIndex = "10000";
  container.style.pointerEvents = "none";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "flex-start";

  const info = document.createElement("div");
  info.style.marginBottom = "4px";

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");

  container.appendChild(info);
  container.appendChild(canvas);
  document.body.appendChild(container);

  // For drawing FPS history instead of delta times
  const fpsHistory = [];
  const maxHistory = 60;

  function drawGraph(data, color = "#0f0") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!data || data.length === 0) return;

    const maxValue = Math.max(...data, 60);
    const scaleY = canvas.height / (maxValue * 1.2); // headroom
    const step = canvas.width / (data.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    data.forEach((val, i) => {
      const x = i * step;
      const y = canvas.height - val * scaleY;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  function updateOverlay() {
    const metrics = TimeManager.getPerformanceMetrics();
    if (!metrics || metrics.error) {
      info.innerHTML = `<b>Δt Metrics</b><br/>Unavailable`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Update FPS history
    if (typeof metrics.fps === "number") {
      fpsHistory.push(metrics.fps);
      if (fpsHistory.length > maxHistory) fpsHistory.shift();
    }

    info.innerHTML = `
      <b>Δt Metrics</b> | FPS: ${metrics.fps?.toFixed(1) || "N/A"}<br/>
      Focus: ${metrics.hasFocus ? "Yes" : "No"} | Idle: ${
      metrics.isIdle ? "Yes" : "No"
    }<br/>
      Drift: ${metrics.driftDetected ? "Yes" : "No"}<br/>
      Target FPS: ${metrics.targetFPS} | Frame Capping: ${
      metrics.frameCapping ? "Yes" : "No"
    }
    `;

    drawGraph(fpsHistory, "#0f0");
  }

  setInterval(updateOverlay, 250);
}

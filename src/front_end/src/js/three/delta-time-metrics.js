// DeltaTimeMetrics.js
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

  // Create text info area
  const info = document.createElement("div");
  info.style.marginBottom = "4px";

  // Create canvas graph
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");

  container.appendChild(info);
  container.appendChild(canvas);
  document.body.appendChild(container);

  function drawGraph(data, color = "#0f0") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxValue = Math.max(...data, 16.667); // Keep scale reasonable
    const scaleY = canvas.height / (maxValue * 1.2); // Add headroom

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    const step = canvas.width / (data.length - 1);
    data.forEach((val, i) => {
      const x = i * step;
      const y = canvas.height - val * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  function updateOverlay() {
    const metrics = TimeManager.getPerformanceMetrics();

    const latestRaw = metrics.rawDeltaHistory.at(-1) || 0;
    const latestSmooth = metrics.smoothedDeltaHistory.at(-1) || 0;

    info.innerHTML = `
      <b>Δt Metrics</b> | FPS: ${metrics.fps}<br/>
      Raw: ${latestRaw.toFixed(2)} ms<br/>
      Smoothed: ${latestSmooth.toFixed(2)} ms<br/>
      Idle: ${metrics.isIdle ? "Yes" : "No"} | Focus: ${
      metrics.hasFocus ? "Yes" : "No"
    }
    `;

    drawGraph(metrics.smoothedDeltaHistory, "#0f0");
  }

  setInterval(updateOverlay, 250); // Update every 250ms
}

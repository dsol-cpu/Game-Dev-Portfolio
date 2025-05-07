import { getFrameRate, isFrameCapped, getDeltaTime } from "./time-manager.js";
import { isIdle } from "../user-interaction.js";

export function createDeltaTimeMetricsOverlay() {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    bottom: "0",
    right: "0",
    padding: "10px",
    background: "rgba(0, 0, 0, 0.6)",
    color: "#0f0",
    fontFamily: "monospace",
    fontSize: "12px",
    zIndex: "10000",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  });

  const info = document.createElement("div");
  info.style.marginBottom = "4px";

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");

  container.appendChild(info);
  container.appendChild(canvas);
  document.body.appendChild(container);

  const fpsHistory = [];
  const maxHistory = 60;

  function drawGraph(data, color = "#0f0") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!data || data.length === 0) return;

    const maxValue = Math.max(...data, 60);
    const scaleY = canvas.height / (maxValue * 1.2);
    const step = canvas.width / (data.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    data.forEach((val, i) => {
      const x = i * step;
      const y = canvas.height - val * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  function updateOverlay() {
    const dt = getDeltaTime(); // Update time and get delta
    if (dt === null) return; // Skip if frame should be skipped

    const fps = 1 / dt;
    if (fps > 0) {
      fpsHistory.push(fps);
      if (fpsHistory.length > maxHistory) fpsHistory.shift();
    }

    const hasFocus = document.hasFocus();
    const idle = isIdle();
    const targetFPS = getFrameRate();
    const frameCapping = isFrameCapped();
    const driftDetected = dt > 0.05;

    info.innerHTML = `
        <b>Δt Metrics</b> | FPS: ${fps.toFixed(1)}<br/>
        Focus: ${hasFocus ? "Yes" : "No"} | Idle: ${idle ? "Yes" : "No"}<br/>
        Drift: ${driftDetected ? "Yes" : "No"}<br/>
        Target FPS: ${targetFPS} | Frame Capping: ${frameCapping ? "Yes" : "No"}
      `;

    drawGraph(fpsHistory, "#0f0");
  }

  setInterval(updateOverlay, 250);
}

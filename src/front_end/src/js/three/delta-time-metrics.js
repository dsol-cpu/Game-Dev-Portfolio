import { getDeltaTime } from "./time-manager.js";
import { isIdle } from "../user-interaction.js";

/**
 * Creates a sleek, modern overlay that displays delta time metrics and FPS graph
 * Toggle visibility with F2 key
 */
export function createDeltaTimeMetricsOverlay() {
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 280px;
    background: rgba(10, 14, 25, 0.85);
    color: #fff;
    font-family: 'Roboto', 'Segoe UI', sans-serif;
    font-size: 12px;
    z-index: 10000;
    pointer-events: none;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: transform 0.3s ease, opacity 0.3s ease;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background: rgba(30, 34, 45, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  `;

  const title = document.createElement("div");
  title.style.cssText = `
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 5px;
  `;
  title.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
    </svg>
    <span>Performance Metrics</span>
  `;

  const toggleInfo = document.createElement("div");
  toggleInfo.style.cssText = `
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  `;
  toggleInfo.textContent = "[F2] Toggle";

  header.append(title, toggleInfo);

  const content = document.createElement("div");
  content.style.cssText = `
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  `;

  const statsArea = document.createElement("div");
  statsArea.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  `;

  const fpsCounter = document.createElement("div");
  fpsCounter.style.cssText = `
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    padding: 10px;
    margin-bottom: 5px;
  `;

  const fpsLabel = document.createElement("div");
  fpsLabel.style.cssText = `
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  `;
  fpsLabel.textContent = "FPS";

  const fpsValue = document.createElement("div");
  fpsValue.style.cssText = `
    font-size: 22px;
    font-weight: bold;
    color: #4ade80;
  `;
  fpsValue.textContent = "60.0";

  fpsCounter.append(fpsLabel, fpsValue);

  const createStat = (label) => {
    const stat = document.createElement("div");
    stat.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
    `;

    const statLabel = document.createElement("div");
    statLabel.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
    `;
    statLabel.textContent = label;

    const statValue = document.createElement("div");
    statValue.style.cssText = `
      font-size: 11px;
      font-weight: 500;
    `;
    statValue.textContent = "N/A";

    stat.append(statLabel, statValue);
    return { stat, statValue };
  };

  const deltaStat = createStat("Δ Time (ms)");
  const focusStat = createStat("Focus");
  const idleStat = createStat("Idle");
  const targetStat = createStat("Target FPS");

  statsArea.append(
    fpsCounter,
    deltaStat.stat,
    focusStat.stat,
    idleStat.stat,
    targetStat.stat
  );

  const graphArea = document.createElement("div");
  graphArea.style.cssText = `
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    padding: 10px;
    height: 100px;
  `;

  const graphTitle = document.createElement("div");
  graphTitle.style.cssText = `
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 5px;
  `;
  graphTitle.textContent = "FPS History";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = `
    width: 100%;
    height: 70px;
  `;
  canvas.width = 240;
  canvas.height = 70;

  graphArea.append(graphTitle, canvas);
  content.append(statsArea, graphArea);
  container.append(header, content);
  document.body.appendChild(container);

  const ctx = canvas.getContext("2d");
  const fpsHistory = [];
  const maxHistory = 60;

  let isVisible = true;
  let isIdling = isIdle();

  function toggleVisibility() {
    isVisible = !isVisible;
    container.style.opacity = isVisible ? "1" : "0";
    container.style.transform = isVisible
      ? "translateY(0)"
      : "translateY(20px)";
    setTimeout(() => {
      container.style.display = isVisible ? "block" : "none";
    }, 300);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "F2") {
      toggleVisibility();
      event.preventDefault();
    }
  });

  function getFpsColor(fps) {
    if (fps >= 55) return "#4ade80";
    if (fps >= 30) return "#facc15";
    return "#f87171";
  }

  function update() {
    if (!isVisible) return;

    const delta = getDeltaTime();
    const fps = delta > 0 ? 1 / delta : 0;

    fpsHistory.push(fps);
    if (fpsHistory.length > maxHistory) fpsHistory.shift();

    const avgFps =
      fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length;

    fpsValue.textContent = avgFps.toFixed(1);
    fpsValue.style.color = getFpsColor(avgFps);

    deltaStat.statValue.textContent = (delta * 1000).toFixed(1) + " ms";

    const hasFocus = document.hasFocus();
    focusStat.statValue.textContent = hasFocus ? "Yes" : "No";
    focusStat.statValue.style.color = hasFocus ? "#4ade80" : "#f87171";

    isIdling = isIdle();
    idleStat.statValue.textContent = isIdling ? "Yes" : "No";
    idleStat.statValue.style.color = isIdling ? "#facc15" : "#4ade80";

    targetStat.statValue.textContent = "60";

    drawFpsGraph();
  }

  function drawFpsGraph() {
    if (!fpsHistory.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxValue = Math.max(...fpsHistory, 60);
    const scaleY = canvas.height / (maxValue * 1.2);
    const step = canvas.width / (maxHistory - 1);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = i * (canvas.height / 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(74, 222, 128, 0.2)");
    gradient.addColorStop(1, "rgba(74, 222, 128, 0)");

    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    fpsHistory.forEach((val, i) => {
      const x = i * step;
      const y = canvas.height - val * scaleY;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#4ade80";

    fpsHistory.forEach((val, i) => {
      const x = i * step;
      const y = canvas.height - val * scaleY;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();

    const thresholdY = canvas.height - 60 * scaleY;
    if (thresholdY > 0 && thresholdY < canvas.height) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(canvas.width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const updateInterval = setInterval(update, 1000);
  update();

  return {
    element: container,
    toggle: toggleVisibility,
    isVisible: () => isVisible,
    destroy: () => {
      clearInterval(updateInterval);
      window.removeEventListener("keydown", toggleVisibility);
      container.remove();
    },
  };
}

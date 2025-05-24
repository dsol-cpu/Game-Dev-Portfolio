import {
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "../extern/three/three.module.min.js";
import { isLowPoweredDevice } from "../utils/device";
import { calculateGridPositions, loadModel } from "./model.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { PROJECT_CARD_DATA } from "../data/projects.js";

const cache = { models: new Map(), positions: new Map() };
let scene, camera, canvas;

const el = (tag, cls, attrs = {}) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.entries(attrs).forEach(
    ([k, v]) =>
      v != null &&
      (k === "textContent" ? (e.textContent = v) : e.setAttribute(k, v))
  );
  return e;
};

const createButtons = (project, type, id) => {
  const frag = document.createDocumentFragment();

  if (type === "overlay") {
    const btn = el("button", "btn btn-view", { textContent: "View Details" });
    btn.onclick = (e) => toggleExpand(e, id);
    return frag.appendChild(btn), frag;
  }

  if (type !== "action") return frag;

  if (project.demoUrl) {
    const demo = el("a", "btn btn-primary", {
      href: project.demoUrl,
      target: "_blank",
    });
    demo.innerHTML = `<svg aria-hidden="true"><use href="#icon-play-btn" /></svg><span>Live Demo</span>`;
    frag.appendChild(demo);
  }

  if (project.githubUrl) {
    const src = el("a", "btn btn-secondary", {
      href: project.githubUrl,
      target: "_blank",
    });
    const icon = project.githubUrl.includes("github.com")
      ? "#icon-github"
      : project.githubUrl.includes("gitlab.com")
      ? "#icon-gitlab"
      : project.githubUrl.includes("itch.io")
      ? "#icon-itch"
      : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    src.innerHTML = `${
      icon.startsWith("#") ? `<svg><use href="${icon}"/></svg>` : icon
    }<span>Source Code</span>`;
    frag.appendChild(src);
  }

  const close = el("button", "btn btn-close-expanded", {
    textContent: "Close",
  });
  close.onclick = (e) => toggleExpand(e, id);
  frag.appendChild(close);
  return frag;
};

const createCard = (project) => {
  if (!project?.id) return null;

  const card = el("div", "game-preview project-card", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  const container = el("div", "game-image-container portfolio-canvas");

  // Add content based on device capability
  if (isLowPoweredDevice() && project.imageUrl) {
    container.appendChild(
      el("img", "fallback-image", {
        src: project.imageUrl,
        alt: project.title || "Project image",
        loading: "lazy",
      })
    );
  } else {
    const window = el("div", "model-view-window", {
      "data-model-name": project.modelName || "",
    });
    const hint = el("div", "model-interaction-hint", {
      textContent: "Drag to rotate",
    });
    window.appendChild(hint);
    window.onmouseenter = () => (hint.style.opacity = "0.7");
    window.onmouseleave = () => (hint.style.opacity = "0");
    container.appendChild(window);
  }

  const close = el("button", "btn-close", { textContent: "×" });
  close.onclick = (e) => toggleExpand(e, project.id);
  container.appendChild(close);

  const overlay = el("div", "game-overlay");
  overlay.appendChild(
    el("h3", "game-title", { textContent: project.title || "Untitled" })
  );
  overlay.appendChild(createButtons(project, "overlay", project.id));

  // Expanded content
  const expanded = el("div", "expanded-content");
  const inner = el("div", "expanded-content-inner");
  inner.appendChild(
    el("h2", "card-title", { textContent: project.title || "Untitled" })
  );

  if (project.tags?.length) {
    const tags = el("div", "project-tags");
    project.tags.forEach((tag) =>
      tags.appendChild(el("span", "project-tag", { textContent: tag }))
    );
    inner.appendChild(tags);
  }

  if (project.shortDescription) {
    inner.appendChild(
      el("p", "project-description", { textContent: project.shortDescription })
    );
  }

  project.fullDescription?.forEach(
    (p) =>
      p && inner.appendChild(el("p", "project-description", { textContent: p }))
  );
  inner.appendChild(createButtons(project, "action", project.id));
  expanded.appendChild(inner);

  card.append(container, overlay, expanded);
  return card;
};

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const animate = (model, fromPos, toPos, fromScale, toScale, duration = 400) => {
  if (!model || model.animating) return;

  model.animating = true;
  const start = performance.now();

  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = easeOut(t);

    model.position.lerpVectors(fromPos, toPos, ease);
    const scale = fromScale + (toScale - fromScale) * ease;
    model.scale.setScalar(scale);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      model.animating = false;
    }
  };
  requestAnimationFrame(tick);
};

const getModelPos = (modelName, expanded = false) => {
  if (!canvas || !camera) return new Vector3(0, 0, 10);

  if (expanded) {
    // For expanded cards, find the model-view-window and center within it
    const card = document.querySelector(`[data-model="${modelName}"].expanded`);
    const viewWindow = card?.querySelector(".model-view-window");

    if (viewWindow && card) {
      const canvasRect = canvas.getBoundingClientRect();
      const windowRect = viewWindow.getBoundingClientRect();

      console.log("Canvas rect:", canvasRect);
      console.log("Window rect:", windowRect);
      console.log("Model name:", modelName);

      // Check if the window is actually visible and has dimensions
      if (windowRect.width === 0 || windowRect.height === 0) {
        console.log("Window has no dimensions, using fallback");
        return new Vector3(0, 0, 6);
      }

      // Calculate center of the model-view-window relative to the canvas
      const windowCenterX = windowRect.left + windowRect.width / 2;
      const windowCenterY = windowRect.top + windowRect.height / 2;

      // Calculate position relative to canvas bounds
      const relativeX = windowCenterX - canvasRect.left;
      const relativeY = windowCenterY - canvasRect.top;

      console.log("Window center (viewport):", windowCenterX, windowCenterY);
      console.log("Canvas bounds:", canvasRect.left, canvasRect.top);
      console.log("Relative position:", relativeX, relativeY);

      // Convert to normalized device coordinates (-1 to 1)
      const ndcX = (relativeX / canvasRect.width) * 2 - 1;
      const ndcY = -((relativeY / canvasRect.height) * 2 - 1);

      console.log("NDC coordinates:", ndcX, ndcY);

      // Create a raycaster from the camera through the window center
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector3(ndcX, ndcY, 0), camera);

      // Position the model at a reasonable distance along this ray
      // Use a distance that keeps the model at an appropriate size
      const targetDistance = 6; // Adjust this value to control how close/far the model appears
      const targetPosition = raycaster.ray.origin
        .clone()
        .add(raycaster.ray.direction.multiplyScalar(targetDistance));

      console.log("Target position:", targetPosition);
      return targetPosition;
    }

    console.log("Card or viewWindow not found, using fallback");
    // Fallback to canvas center for expanded mode
    return new Vector3(0, 0, 6);
  }

  // Normal positioning for non-expanded cards
  const pos = cache.positions.get(modelName);
  if (!pos) return new Vector3(0, 0, 10);

  const vec = new Vector3(pos.x, pos.y, 0.5);
  vec.unproject(camera);
  vec.sub(camera.position).normalize();
  vec.multiplyScalar(8);
  vec.add(camera.position);
  return vec;
};

const updatePositions = () => {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  cache.positions.clear();

  // Calculate positions for all visible model-view-windows
  document.querySelectorAll(".model-view-window").forEach((win) => {
    const name = win.dataset.modelName;
    if (!name) return;

    // Check if the parent card is visible (not filtered out)
    const card = win.closest(".project-card");
    if (!card || card.style.display === "none") return;

    const winRect = win.getBoundingClientRect();

    // Only calculate position if window is actually visible
    if (winRect.width === 0 || winRect.height === 0) return;

    const x =
      ((winRect.left + winRect.width / 2 - rect.left) / rect.width) * 2 - 1;
    const y = -(
      ((winRect.top + winRect.height / 2 - rect.top) / rect.height) * 2 -
      1
    );

    cache.positions.set(name, {
      x,
      y,
      width: winRect.width / rect.width,
      height: winRect.height / rect.height,
    });
  });

  // Update model positions and visibility
  cache.models.forEach((model, name) => {
    if (model.animating) return;

    const card = document.querySelector(`[data-model="${name}"]`);

    // Check if card is filtered out or hidden
    if (!card || card.style.display === "none") {
      model.visible = false;
      return;
    }

    model.visible = true;
    const expanded = card.classList.contains("expanded");
    const targetPos = getModelPos(name, expanded);
    const targetScale = (model.baseScale || 0.15) * (expanded ? 1.4 : 1);

    // Force immediate position update if significant change is needed
    const positionChange = model.position.distanceTo(targetPos);
    const scaleChange = Math.abs(model.scale.x - targetScale);

    if (positionChange > 0.1 || scaleChange > 0.01) {
      animate(
        model,
        model.position.clone(),
        targetPos,
        model.scale.x,
        targetScale,
        expanded ? 600 : 400
      );
    }
  });
};

const toggleExpand = (e, id) => {
  e?.preventDefault();
  e?.stopPropagation();

  const card = document.getElementById(id);
  if (!card) return;

  const expanding = !card.classList.contains("expanded");
  const modelName = card.dataset.model;

  console.log(
    "Toggling expand for:",
    id,
    "expanding:",
    expanding,
    "modelName:",
    modelName
  );

  // Handle card expansion/collapse
  document.querySelectorAll(".project-card").forEach((c) => {
    if (c.id === id) {
      c.classList.toggle("expanded", expanding);
      c.classList.toggle("section-centered-card", expanding);
    } else {
      c.classList.toggle("hidden-card", expanding);
    }
  });

  document.body.classList.toggle("overflow-hidden", expanding);

  if (expanding) {
    // Hide other models immediately, show only the expanded one
    cache.models.forEach((model, name) => {
      if (name === modelName) {
        model.visible = true;
        // Reset position immediately to prevent wrong positioning
        model.position.set(0, 0, 6);
      } else {
        model.visible = false;
      }
    });

    // Wait for DOM layout to complete before positioning
    setTimeout(() => {
      console.log("Updating positions after expansion...");
      // Force update only the expanded model
      const expandedModel = cache.models.get(modelName);
      if (expandedModel) {
        const targetPos = getModelPos(modelName, true);
        const targetScale = (expandedModel.baseScale || 0.15) * 1.4;

        console.log("Positioning expanded model:", modelName, "to:", targetPos);

        animate(
          expandedModel,
          expandedModel.position.clone(),
          targetPos,
          expandedModel.scale.x,
          targetScale,
          600
        );
      }

      // Scroll to center the expanded card after positioning
      setTimeout(() => {
        card.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }, 100);
    }, 200); // Reduced delay since we're handling specific model
  } else {
    // Show all models for visible cards and reset their positions
    cache.models.forEach((model, name) => {
      const modelCard = document.querySelector(`[data-model="${name}"]`);
      model.visible = modelCard && modelCard.style.display !== "none";
    });

    // Update positions after collapse animation
    setTimeout(() => {
      console.log("Updating positions after collapse...");
      updatePositions();
    }, 600); // Wait for CSS transitions to complete
  }
};

const setupInteraction = () => {
  let drag = { active: false, model: null, lastX: 0 };

  const handleMove = (x, y) => {
    if (!drag.active || !drag.model) return;
    drag.model.rotation.y += (x - drag.lastX) * 0.01;
    drag.lastX = x;
  };

  document.addEventListener("mousedown", (e) => {
    const win = e.target.closest(".model-view-window");
    if (!win || e.button) return;

    const model = cache.models.get(win.dataset.modelName);
    if (!model) return;

    drag = { active: true, model, lastX: e.clientX };
    document.body.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener(
    "mousemove",
    (e) => drag.active && handleMove(e.clientX, e.clientY)
  );
  document.addEventListener("mouseup", () => {
    drag.active = false;
    document.body.style.cursor = "";
  });

  // Touch events
  document.addEventListener(
    "touchstart",
    (e) => {
      const win = e.target.closest(".model-view-window");
      if (!win || e.touches.length !== 1) return;

      const model = cache.models.get(win.dataset.modelName);
      if (!model) return;

      drag = { active: true, model, lastX: e.touches[0].clientX };
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (drag.active && e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );

  document.addEventListener("touchend", () => (drag.active = false), {
    passive: true,
  });

  // Zoom in expanded cards
  document.addEventListener(
    "wheel",
    (e) => {
      const win = e.target.closest(".model-view-window");
      const card = win?.closest(".project-card.expanded");
      if (!card) return;

      const model = cache.models.get(win.dataset.modelName);
      if (!model) return;

      e.preventDefault();
      const delta = Math.sign(e.deltaY) * -0.1;
      const newScale = Math.max(
        0.05,
        Math.min(0.8, model.scale.x * (1 + delta))
      );
      model.scale.setScalar(newScale);
    },
    { passive: false }
  );

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const expanded = document.querySelector(".project-card.expanded");
      if (expanded) toggleExpand(null, expanded.id);
    }
  });

  // Resize and filter handling
  const resize = () => {
    if (!canvas || !camera) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
    updatePositions();
  };

  window.addEventListener("resize", resize);
  new ResizeObserver(resize).observe(document.querySelector("#portfolio"));

  // Listen for portfolio filter changes
  const checkFilterUpdates = () => {
    if (window.portfolioFilterState) {
      updatePositions();
    }
  };

  // Use MutationObserver to detect when cards are shown/hidden
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "style" &&
        mutation.target.classList.contains("project-card")
      ) {
        shouldUpdate = true;
      }
    });
    if (shouldUpdate) {
      setTimeout(updatePositions, 100);
    }
  });

  // Observe all project cards for style changes
  document.querySelectorAll(".project-card").forEach((card) => {
    observer.observe(card, { attributes: true, attributeFilter: ["style"] });
  });

  // Periodically check for filter updates
  setInterval(checkFilterUpdates, 200);
};

const loadProjectModel = async (name) => {
  if (!name) return null;
  try {
    const model = await loadModel(name);
    scene.add(model);
    model.baseScale = 0.15;
    model.scale.setScalar(0.15);
    return model;
  } catch (err) {
    console.error(`Failed to load model ${name}:`, err);
    return null;
  }
};

export const initProjectCards = () => {
  const grid = document.querySelector(".project-card-grid");
  if (!Array.isArray(PROJECT_CARD_DATA) || !grid) return;

  const frag = document.createDocumentFragment();
  PROJECT_CARD_DATA.forEach((project) => {
    const card = createCard(project);
    if (card) frag.appendChild(card);
  });
  grid.appendChild(frag);
};

export const initProjectCardScene = async () => {
  if (isLowPoweredDevice()) return;

  scene = getScene();

  // Setup canvas
  const portfolio = document.querySelector("#portfolio");
  if (!portfolio) return;

  canvas = el("canvas", "portfolio-canvas", { id: "portfolio-main-canvas" });
  Object.assign(canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2",
    pointerEvents: "auto",
  });

  portfolio.style.position = "relative";
  portfolio.appendChild(canvas);

  // Setup camera
  canvas.width = canvas.clientWidth || 300;
  canvas.height = canvas.clientHeight || 200;
  camera = new PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 16);
  camera.position.set(0, 0, 10);
  registerCamera(camera, canvas.getContext("2d", { alpha: true }));

  // Load models
  const modelNames = [...document.querySelectorAll("[data-model]")]
    .map((el) => el.dataset.model)
    .filter(Boolean);

  calculateGridPositions(modelNames);

  await Promise.all(
    modelNames.map(async (name) => {
      const model = await loadProjectModel(name);
      if (model) cache.models.set(name, model);
    })
  );

  // Wait for DOM layout to complete, then position models
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updatePositions();
      setupInteraction();
    });
  });
};

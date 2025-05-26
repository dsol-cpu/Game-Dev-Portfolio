import {
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "../extern/three/three.module.min.js";
import { isLowPoweredDevice } from "../utils/device.js";
import { calculateGridPositions, loadModel } from "./model.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { PROJECT_CARD_DATA } from "../data/projects.js";

// Single cache object and global state
const state = {
  models: new Map(),
  positions: new Map(),
  scene: null,
  camera: null,
  canvas: null,
  dragging: { active: false, model: null, lastX: 0 },
};

// Utility functions
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

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Consolidated button creation
const createButtons = (project, type, id) => {
  const frag = document.createDocumentFragment();

  if (type === "overlay") {
    const btn = el("button", "btn btn-view", { textContent: "View Details" });
    btn.onclick = (e) => toggleExpand(e, id);
    frag.appendChild(btn);
    return frag;
  }

  if (type !== "action") return frag;

  // Create action buttons with simplified icon logic
  [
    {
      url: project.demoUrl,
      cls: "btn-primary",
      icon: "#icon-play-btn",
      text: "Live Demo",
    },
    {
      url: project.githubUrl,
      cls: "btn-secondary",
      icon: project.githubUrl?.includes("github.com")
        ? "#icon-github"
        : project.githubUrl?.includes("gitlab.com")
        ? "#icon-gitlab"
        : project.githubUrl?.includes("itch.io")
        ? "#icon-itch"
        : null,
      text: "Source Code",
    },
  ].forEach(({ url, cls, icon, text }) => {
    if (!url) return;
    const btn = el("a", `btn ${cls}`, { href: url, target: "_blank" });
    btn.innerHTML = `${
      icon ? `<svg><use href="${icon}"/></svg>` : ""
    }<span>${text}</span>`;
    frag.appendChild(btn);
  });

  // Close button
  const close = el("button", "btn btn-close-expanded", {
    textContent: "Close",
  });
  close.onclick = (e) => toggleExpand(e, id);
  frag.appendChild(close);
  return frag;
};

// Optimized card creation
const createCard = (project) => {
  if (!project?.id) return null;

  const card = el("div", "game-preview project-card", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  // Image container with conditional content
  const container = el("div", "game-image-container portfolio-canvas");

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

  // Close button and overlay
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

  // Tags
  if (project.tags?.length) {
    const tags = el("div", "project-tags");
    project.tags.forEach((tag) =>
      tags.appendChild(el("span", "project-tag", { textContent: tag }))
    );
    inner.appendChild(tags);
  }

  // Descriptions
  [project.shortDescription, ...(project.fullDescription || [])]
    .filter(Boolean)
    .forEach((desc) =>
      inner.appendChild(el("p", "project-description", { textContent: desc }))
    );

  inner.appendChild(createButtons(project, "action", project.id));
  expanded.appendChild(inner);
  card.append(container, overlay, expanded);
  return card;
};

// Simplified animation
const animate = (model, toPos, toScale, duration = 400) => {
  if (!model || model.animating) return;

  model.animating = true;
  const startPos = model.position.clone();
  const startScale = model.scale.x;
  const start = performance.now();

  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = easeOut(t);

    model.position.lerpVectors(startPos, toPos, ease);
    model.scale.setScalar(startScale + (toScale - startScale) * ease);

    if (t < 1) requestAnimationFrame(tick);
    else model.animating = false;
  };
  requestAnimationFrame(tick);
};

// Optimized position calculation
const getModelPos = (modelName, expanded = false) => {
  if (!state.canvas || !state.camera) return new Vector3(0, 0, 10);

  if (expanded) {
    const card = document.querySelector(`[data-model="${modelName}"].expanded`);
    const container = card?.querySelector(".game-image-container");

    if (container) {
      const canvasRect = state.canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (containerRect.width > 0 && containerRect.height > 0) {
        const centerX =
          containerRect.left + containerRect.width / 2 - canvasRect.left;
        const centerY =
          containerRect.top + containerRect.height / 2 - canvasRect.top;
        const ndcX = (centerX / canvasRect.width) * 2 - 1;
        const ndcY = -((centerY / canvasRect.height) * 2 - 1);

        const raycaster = new Raycaster();
        raycaster.setFromCamera(new Vector3(ndcX, ndcY, 0), state.camera);
        return raycaster.ray.origin
          .clone()
          .add(raycaster.ray.direction.multiplyScalar(6));
      }
    }
    return new Vector3(0, 0, 6);
  }

  const pos = state.positions.get(modelName);
  if (!pos) return new Vector3(0, 0, 10);

  const vec = new Vector3(pos.x, pos.y, 0.5);
  vec.unproject(state.camera);
  vec
    .sub(state.camera.position)
    .normalize()
    .multiplyScalar(8)
    .add(state.camera.position);
  return vec;
};

// Consolidated position update
const updatePositions = () => {
  if (!state.canvas) return;

  const rect = state.canvas.getBoundingClientRect();
  state.positions.clear();

  // Calculate positions for visible windows
  document.querySelectorAll(".model-view-window").forEach((win) => {
    const name = win.dataset.modelName;
    const card = win.closest(".project-card");
    if (!name || !card || card.style.display === "none") return;

    const winRect = win.getBoundingClientRect();
    if (winRect.width === 0 || winRect.height === 0) return;

    state.positions.set(name, {
      x: ((winRect.left + winRect.width / 2 - rect.left) / rect.width) * 2 - 1,
      y: -(
        ((winRect.top + winRect.height / 2 - rect.top) / rect.height) * 2 -
        1
      ),
      width: winRect.width / rect.width,
      height: winRect.height / rect.height,
    });
  });

  // Update model positions
  const expandedCard = document.querySelector(".project-card.expanded");
  const isAnyCardExpanded = !!expandedCard;
  const expandedModelName = expandedCard?.dataset.model;

  state.models.forEach((model, name) => {
    if (model.animating) return;

    const card = document.querySelector(`[data-model="${name}"]`);
    const shouldBeVisible = card && card.style.display !== "none";

    // Set Three.js visibility - respect expanded state
    if (isAnyCardExpanded) {
      // When any card is expanded, only show the expanded model
      model.visible = name === expandedModelName;
    } else {
      // When no card is expanded, show all visible models
      model.visible = shouldBeVisible;
    }

    if (!model.visible) return;

    const expanded = card.classList.contains("expanded");
    const targetPos = getModelPos(name, expanded);
    const targetScale = (model.baseScale || 0.15) * (expanded ? 1.4 : 1);

    if (
      model.position.distanceTo(targetPos) > 0.1 ||
      Math.abs(model.scale.x - targetScale) > 0.01
    ) {
      animate(model, targetPos, targetScale, expanded ? 600 : 400);
    }
  });
};

export const resetExpandedCards = () => {
  const expandedCard = document.querySelector(".project-card.expanded");
  if (expandedCard) {
    toggleExpand(null, expandedCard.id);
  }
};

const toggleExpand = async (e, id) => {
  e?.preventDefault();
  e?.stopPropagation();

  const card = document.getElementById(id);
  if (!card) return;

  const expanding = !card.classList.contains("expanded");
  const modelName = card.dataset.model;

  // Toggle card states
  document.querySelectorAll(".project-card").forEach((c) => {
    if (c.id === id) {
      c.classList.toggle("expanded", expanding);
      c.classList.toggle("section-centered-card", expanding);
    } else {
      c.classList.toggle("hidden-card", expanding);
    }
  });

  document.body.classList.toggle("overflow-hidden", expanding);

  // Update model visibility - hide all others when expanding, show all when collapsing
  state.models.forEach((model, name) => {
    if (expanding) {
      // When expanding, only show the focused model
      model.visible = name === modelName;
    } else {
      // When collapsing, show all models that have visible cards
      const modelCard = document.querySelector(`[data-model="${name}"]`);
      model.visible = modelCard && modelCard.style.display !== "none";
    }
  });

  // If we're collapsing, reapply the current filter to restore proper visibility
  if (!expanding && window.portfolioFilterAPI) {
    setTimeout(() => {
      window.portfolioFilterAPI.applyFilter(
        window.portfolioFilterAPI.getActiveFilter()
      );
    }, 100);
  }

  // Wait for transition and update positions
  await new Promise((resolve) => {
    const handleTransition = () => {
      card.removeEventListener("transitionend", handleTransition);
      setTimeout(() => {
        updatePositions();
        if (expanding) {
          setTimeout(
            () => card.scrollIntoView({ behavior: "smooth", block: "center" }),
            200
          );
        }
        resolve();
      }, 100);
    };
    card.addEventListener("transitionend", handleTransition);
    setTimeout(handleTransition, 1000); // Fallback
  });
};

// Consolidated interaction setup
const setupInteraction = () => {
  const handleMove = (x, y) => {
    if (!state.dragging.active || !state.dragging.model) return;
    state.dragging.model.rotation.y += (x - state.dragging.lastX) * 0.01;
    state.dragging.lastX = x;
  };

  const startDrag = (element, x) => {
    const win = element.closest(".model-view-window");
    const model = win && state.models.get(win.dataset.modelName);
    if (!model) return false;

    state.dragging = { active: true, model, lastX: x };
    document.body.style.cursor = "grabbing";
    return true;
  };

  const endDrag = () => {
    state.dragging.active = false;
    document.body.style.cursor = "";
  };

  // Mouse events
  document.addEventListener("mousedown", (e) => {
    if (!e.button && startDrag(e.target, e.clientX)) e.preventDefault();
  });
  document.addEventListener("mousemove", (e) =>
    handleMove(e.clientX, e.clientY)
  );
  document.addEventListener("mouseup", endDrag);

  // Touch events
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) startDrag(e.target, e.touches[0].clientX);
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 1)
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  document.addEventListener("touchend", endDrag, { passive: true });

  // Wheel zoom in expanded cards
  document.addEventListener(
    "wheel",
    (e) => {
      const win = e.target.closest(".model-view-window");
      const card = win?.closest(".project-card.expanded");
      const model = card && state.models.get(win.dataset.modelName);

      if (model) {
        e.preventDefault();
        const newScale = Math.max(
          0.05,
          Math.min(0.8, model.scale.x * (1 - Math.sign(e.deltaY) * 0.1))
        );
        model.scale.setScalar(newScale);
      }
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

  // Resize handling
  const resize = () => {
    if (!state.canvas || !state.camera) return;
    state.canvas.width = state.canvas.clientWidth;
    state.canvas.height = state.canvas.clientHeight;
    state.camera.aspect = state.canvas.width / state.canvas.height;
    state.camera.updateProjectionMatrix();
    updatePositions();
  };

  window.addEventListener("resize", resize);
  new ResizeObserver(resize).observe(document.querySelector("#portfolio"));

  // Monitor card visibility changes
  new MutationObserver((mutations) => {
    if (
      mutations.some(
        (m) =>
          m.type === "attributes" &&
          m.attributeName === "style" &&
          m.target.classList.contains("project-card")
      )
    ) {
      setTimeout(updatePositions, 100);
    }
  }).observe(document.body, {
    attributes: true,
    attributeFilter: ["style"],
    subtree: true,
  });
};

// Simplified model loading
const loadProjectModel = async (name) => {
  if (!name) return null;
  try {
    const model = await loadModel(name);
    state.scene.add(model);
    model.baseScale = 0.15;
    model.scale.setScalar(0.15);
    return model;
  } catch (err) {
    console.error(`Failed to load model ${name}:`, err);
    return null;
  }
};

// Main initialization functions
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

  state.scene = getScene();
  const portfolio = document.querySelector("#portfolio");
  if (!portfolio) return;

  // Setup canvas
  state.canvas = el("canvas", "portfolio-canvas", {
    id: "portfolio-main-canvas",
  });
  Object.assign(state.canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2",
    pointerEvents: "auto",
  });

  portfolio.style.position = "relative";
  portfolio.appendChild(state.canvas);

  // Setup camera
  state.canvas.width = state.canvas.clientWidth || 300;
  state.canvas.height = state.canvas.clientHeight || 200;
  state.camera = new PerspectiveCamera(
    45,
    state.canvas.width / state.canvas.height,
    0.1,
    16
  );
  state.camera.position.set(0, 0, 10);
  registerCamera(state.camera, state.canvas.getContext("2d", { alpha: true }));

  // Load models
  const modelNames = [...document.querySelectorAll("[data-model]")]
    .map((el) => el.dataset.model)
    .filter(Boolean);

  calculateGridPositions(modelNames);

  await Promise.all(
    modelNames.map(async (name) => {
      const model = await loadProjectModel(name);
      if (model) state.models.set(name, model);
    })
  );

  // Initialize positioning and interactions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updatePositions();
      setupInteraction();
    });
  });
};

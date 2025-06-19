import {
  PerspectiveCamera,
  Vector3,
  SpotLight,
  Object3D,
} from "../extern/three/three.module.min.js";
import { isLowPoweredDevice } from "../utils/device.js";
import { calculateGridPositions, loadModel } from "./model.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { PROJECT_CARD_DATA } from "../data/projects.js";

// Global state - consolidated and optimized
const state = {
  models: new Map(),
  spotlights: new Map(),
  positions: new Map(),
  scene: null,
  camera: null,
  canvas: null,
  dragging: { active: false, model: null, lastX: 0 },
  isTransitioning: false,
  resizeObserver: null,
  mutationObserver: null,
};

// Utility functions - optimized
const el = (tag, cls, attrs = {}) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) {
      k === "textContent" ? (e.textContent = v) : e.setAttribute(k, v);
    }
  }
  return e;
};

const easeOut = (t) => 1 - (1 - t) ** 3;

// Responsive scaling - simplified with lookup table
const SCALE_BREAKPOINTS = [
  [480, { base: 0.08, expanded: 0.6 }],
  [768, { base: 0.1, expanded: 0.7 }],
  [1024, { base: 0.12, expanded: 0.8 }],
  [1440, { base: 0.15, expanded: 0.9 }],
  [Infinity, { base: 0.18, expanded: 1 }],
];

const getScaleFactors = () => {
  const width = window.innerWidth;
  return SCALE_BREAKPOINTS.find(([breakpoint]) => width <= breakpoint)[1];
};

// Spotlight management - optimized
const createSpotlight = (modelName) => {
  const spotlight = new SpotLight(0xffffff, 2, 15, Math.PI / 6, 0.3, 1);
  Object.assign(spotlight.shadow, {
    mapSize: { width: 1024, height: 1024 },
    camera: { near: 0.5, far: 15 },
  });
  spotlight.castShadow = true;

  const container = new Object3D();
  container.add(spotlight, spotlight.target);
  state.scene.add(container);

  state.spotlights.set(modelName, { spotlight, container });
  return { spotlight, container };
};

const updateSpotlight = (modelName, position, expanded = false) => {
  const lights = state.spotlights.get(modelName);
  if (!lights) return;

  const { spotlight } = lights;
  const offset = expanded ? new Vector3(0, 3, 4) : new Vector3(0, 2, 3);

  spotlight.position.copy(position.clone().add(offset));
  spotlight.target.position.copy(position);
  spotlight.intensity = expanded ? 3 : 2;
  spotlight.distance = expanded ? 20 : 15;
};

const setSpotlightVisibility = (modelName, visible) => {
  const lights = state.spotlights.get(modelName);
  if (lights) {
    lights.spotlight.visible = visible;
    lights.container.visible = visible;
  }
};

// Model scale updates - batch optimized
const updateAllModelScales = () => {
  const { base, expanded } = getScaleFactors();

  for (const [name, model] of state.models) {
    const card = document.querySelector(`[data-model="${name}"]`);
    const isExpanded = card?.classList.contains("expanded");

    model.baseScale = base;
    model.scale.setScalar(base * (isExpanded ? expanded : 1));
  }
};

// Button creation - streamlined
const createButtons = (project, type, id) => {
  const frag = document.createDocumentFragment();

  if (type === "overlay") {
    const btn = el("button", "btn btn-view", { textContent: "View Details" });
    btn.onclick = (e) => toggleExpand(e, id);
    frag.appendChild(btn);
    return frag;
  }

  if (type !== "action") return frag;

  const btnWrapper = el("div", "action-buttons");
  const buttonConfigs = [];

  if (project.demoUrl) {
    buttonConfigs.push({
      url: project.demoUrl,
      cls: "btn-primary",
      icon: "#icon-play-btn",
      text: "Live Demo",
    });
  }

  if (project.sourceUrl) {
    const urlMap = {
      "github.com": { icon: "#icon-github", text: "Source Code" },
      "gitlab.com": { icon: "#icon-gitlab", text: "Source Code" },
      "itch.io": { icon: "#icon-itch", text: "Itch Page" },
    };

    const config = Object.entries(urlMap).find(([domain]) =>
      project.sourceUrl.includes(domain)
    )?.[1] || { icon: null, text: "Source Code" };

    buttonConfigs.push({
      url: project.sourceUrl,
      cls: "btn-secondary",
      ...config,
    });
  }

  buttonConfigs.forEach(({ url, cls, icon, text }) => {
    const btn = el("a", `btn ${cls}`, { href: url, target: "_blank" });
    btn.innerHTML = `${
      icon ? `<svg><use href="${icon}"></use></svg>` : ""
    }${text}`;
    btnWrapper.appendChild(btn);
  });

  const closeBtn = el("button", "btn btn-secondary", { textContent: "Close" });
  closeBtn.onclick = (e) => toggleExpand(e, id);
  btnWrapper.appendChild(closeBtn);

  frag.appendChild(btnWrapper);
  return frag;
};

// Card creation - optimized
const createCard = (project) => {
  if (!project?.id) return null;

  const card = el("div", "game-preview project-card", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  // Container with conditional content
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

    // Optimized hover handlers
    window.onmouseenter = () => (hint.style.opacity = "0.7");
    window.onmouseleave = () => (hint.style.opacity = "0");

    window.appendChild(hint);
    container.appendChild(window);
  }

  // Close button
  const closeBtn = el("button", "btn-close", { textContent: "×" });
  closeBtn.onclick = (e) => toggleExpand(e, project.id);
  container.appendChild(closeBtn);

  // Overlay
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

// Animation - optimized with better performance
const animate = (model, toPos, toScale, duration = 400, instant = false) => {
  if (!model) return;

  model.animating = false;

  if (instant) {
    model.position.copy(toPos);
    model.scale.setScalar(toScale);

    const modelName = [...state.models.entries()].find(
      ([, m]) => m === model
    )?.[0];
    if (modelName) {
      const expanded = document
        .querySelector(`[data-model="${modelName}"]`)
        ?.classList.contains("expanded");
      updateSpotlight(modelName, toPos, expanded);
    }
    return;
  }

  model.animating = true;
  const startPos = model.position.clone();
  const startScale = model.scale.x;
  const startTime = performance.now();

  const tick = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOut(progress);

    model.position.lerpVectors(startPos, toPos, eased);
    model.scale.setScalar(startScale + (toScale - startScale) * eased);

    // Update spotlight
    const modelName = [...state.models.entries()].find(
      ([, m]) => m === model
    )?.[0];
    if (modelName) {
      const expanded = document
        .querySelector(`[data-model="${modelName}"]`)
        ?.classList.contains("expanded");
      updateSpotlight(modelName, model.position, expanded);
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      model.animating = false;
    }
  };

  requestAnimationFrame(tick);
};

// Model positioning - optimized calculation
const getModelPosition = (modelName, expanded = false) => {
  if (!state.canvas || !state.camera) return new Vector3(0, 0, 10);

  if (expanded) {
    const card = document.querySelector(`[data-model="${modelName}"].expanded`);
    const container = card?.querySelector(".game-image-container");

    if (container) {
      const canvasRect = state.canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (containerRect.width > 0 && containerRect.height > 0) {
        // Precise center calculation
        const centerX =
          containerRect.left + containerRect.width * 0.5 - canvasRect.left - 1;
        const centerY =
          containerRect.top + containerRect.height * 0.5 - canvasRect.top;

        const ndcX = (centerX / canvasRect.width) * 2 - 1;
        const ndcY = -((centerY / canvasRect.height) * 2 - 1);

        const vector = new Vector3(ndcX, ndcY, 0.5);
        vector.unproject(state.camera);

        return state.camera.position
          .clone()
          .add(vector.sub(state.camera.position).normalize().multiplyScalar(6));
      }
    }
  }

  const pos = state.positions.get(modelName);
  if (!pos) return new Vector3(0, 0, 10);

  const vec = new Vector3(pos.x, pos.y, 0.5);
  vec.unproject(state.camera);
  return state.camera.position
    .clone()
    .add(vec.sub(state.camera.position).normalize().multiplyScalar(8));
};

// Position updates - optimized batch processing
const updatePositions = () => {
  if (!state.canvas || state.isTransitioning) return;

  const rect = state.canvas.getBoundingClientRect();
  state.positions.clear();

  // Batch DOM queries
  const windows = document.querySelectorAll(".model-view-window");
  const expandedCard = document.querySelector(".project-card.expanded");
  const isAnyExpanded = !!expandedCard;
  const expandedModelName = expandedCard?.dataset.model;

  // Calculate positions for visible windows
  windows.forEach((win) => {
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

  const { base, expanded: expandedMultiplier } = getScaleFactors();

  // Update models in batch
  for (const [name, model] of state.models) {
    const card = document.querySelector(`[data-model="${name}"]`);
    const shouldBeVisible = card && card.style.display !== "none";

    // Set visibility
    const isVisible = isAnyExpanded
      ? name === expandedModelName
      : shouldBeVisible;
    model.visible = isVisible;
    setSpotlightVisibility(name, isVisible);

    if (!isVisible) continue;

    const expanded = card.classList.contains("expanded");
    const targetPos = getModelPosition(name, expanded);
    const targetScale =
      (model.baseScale || base) * (expanded ? expandedMultiplier : 1);

    // Only animate if significant change
    if (
      model.position.distanceTo(targetPos) > 0.1 ||
      Math.abs(model.scale.x - targetScale) > 0.01
    ) {
      model.animating = false;
      animate(model, targetPos, targetScale, expanded ? 600 : 400);
    } else {
      updateSpotlight(name, targetPos, expanded);
    }
  }
};

// Layout waiting - optimized with early termination
const waitForLayout = (expanding, modelName) => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 50; // Reduced from 100

    const check = () => {
      if (++attempts >= maxAttempts) return resolve();

      if (expanding) {
        const container = document.querySelector(
          `[data-model="${modelName}"].expanded .game-image-container`
        );
        const rect = container?.getBoundingClientRect();

        if (rect && rect.width > 200 && rect.height > 200) {
          setTimeout(() => {
            const newRect = container.getBoundingClientRect();
            if (
              Math.abs(newRect.width - rect.width) < 5 &&
              Math.abs(newRect.height - rect.height) < 5
            ) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          }, 50);
        } else {
          requestAnimationFrame(check);
        }
      } else {
        const windows = document.querySelectorAll(
          ".project-card:not(.hidden-card) .model-view-window"
        );
        const allSettled = Array.from(windows).every((window) => {
          const rect = window.getBoundingClientRect();
          return rect.width >= 50 && rect.height >= 50;
        });

        if (allSettled) resolve();
        else requestAnimationFrame(check);
      }
    };

    requestAnimationFrame(check);
  });
};

// Toggle expand - fixed model movement
const toggleExpand = async (e, id) => {
  e?.preventDefault();
  e?.stopPropagation();

  const card = document.getElementById(id);
  if (!card || state.isTransitioning) return;

  const expanding = !card.classList.contains("expanded");
  const modelName = card.dataset.model;

  state.isTransitioning = true;

  // Hide all models immediately
  for (const [name, model] of state.models) {
    model.visible = false;
    setSpotlightVisibility(name, false);
  }

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

  // Wait for layout and update positions
  await waitForLayout(expanding, modelName);
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Update model positions and visibility with proper animation
  const expandedCard = document.querySelector(".project-card.expanded");
  const isAnyCardExpanded = !!expandedCard;
  const expandedModelName = expandedCard?.dataset.model;
  const { base, expanded: expandedMultiplier } = getScaleFactors();

  for (const [name, model] of state.models) {
    const modelCard = document.querySelector(`[data-model="${name}"]`);
    const shouldBeVisible = modelCard && modelCard.style.display !== "none";

    // Set visibility based on expansion state
    let isVisible;
    if (isAnyCardExpanded) {
      isVisible = name === expandedModelName;
    } else {
      isVisible = shouldBeVisible;
    }

    model.visible = isVisible;
    setSpotlightVisibility(name, isVisible);

    if (!isVisible) continue;

    // Calculate target position and scale
    const expanded = modelCard.classList.contains("expanded");
    const targetPos = getModelPosition(name, expanded);
    const targetScale =
      (model.baseScale || base) * (expanded ? expandedMultiplier : 1);

    // Animate to new position
    animate(model, targetPos, targetScale, expanding ? 600 : 400);
  }

  setTimeout(() => {
    state.isTransitioning = false;
  }, 100);

  if (expanding) {
    setTimeout(() => {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }
};

// Interaction setup - consolidated event handling
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

  // Consolidated event listeners
  const events = [
    [
      "mousedown",
      (e) => !e.button && startDrag(e.target, e.clientX) && e.preventDefault(),
    ],
    ["mousemove", (e) => handleMove(e.clientX, e.clientY)],
    ["mouseup", endDrag],
    [
      "touchstart",
      (e) =>
        e.touches.length === 1 && startDrag(e.target, e.touches[0].clientX),
      { passive: true },
    ],
    [
      "touchmove",
      (e) =>
        e.touches.length === 1 &&
        handleMove(e.touches[0].clientX, e.touches[0].clientY),
      { passive: true },
    ],
    ["touchend", endDrag, { passive: true }],
    [
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          const expanded = document.querySelector(".project-card.expanded");
          if (expanded) toggleExpand(null, expanded.id);
        }
      },
    ],
  ];

  events.forEach(([event, handler, options]) => {
    document.addEventListener(event, handler, options);
  });

  // Wheel zoom
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

  // Optimized resize handling
  const handleResize = () => {
    if (!state.canvas || !state.camera) return;

    state.canvas.width = state.canvas.clientWidth;
    state.canvas.height = state.canvas.clientHeight;
    state.camera.aspect = state.canvas.width / state.canvas.height;
    state.camera.updateProjectionMatrix();

    updateAllModelScales();
    updatePositions();
  };

  window.addEventListener("resize", handleResize);

  // Use single ResizeObserver
  state.resizeObserver = new ResizeObserver(handleResize);
  state.resizeObserver.observe(document.querySelector("#portfolio"));

  // Optimized MutationObserver
  state.mutationObserver = new MutationObserver((mutations) => {
    const shouldUpdate = mutations.some(
      (m) =>
        m.type === "attributes" &&
        m.attributeName === "style" &&
        m.target.classList.contains("project-card")
    );

    if (shouldUpdate) {
      setTimeout(updatePositions, 100);
    }
  });

  state.mutationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["style"],
    subtree: true,
  });
};

// Model loading - optimized
const loadProjectModel = async (name) => {
  if (!name) return null;

  try {
    const model = await loadModel(name);
    state.scene.add(model);

    const { base } = getScaleFactors();
    model.baseScale = base;
    model.scale.setScalar(base);

    createSpotlight(name);
    return model;
  } catch (err) {
    console.error(`Failed to load model ${name}:`, err);
    return null;
  }
};

// Public API
export const resetExpandedCards = () => {
  const expandedCard = document.querySelector(".project-card.expanded");
  if (expandedCard) {
    toggleExpand(null, expandedCard.id);
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

  // Load models in parallel
  const modelPromises = modelNames.map(async (name) => {
    const model = await loadProjectModel(name);
    if (model) state.models.set(name, model);
  });

  await Promise.all(modelPromises);

  // Initialize with double RAF for stability
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updatePositions();
      setupInteraction();
    });
  });
};

// Cleanup function for memory management
export const cleanup = () => {
  state.resizeObserver?.disconnect();
  state.mutationObserver?.disconnect();
  state.models.clear();
  state.spotlights.clear();
  state.positions.clear();
};

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

// Global state
const state = {
  models: new Map(),
  spotlights: new Map(),
  positions: new Map(),
  scene: null,
  camera: null,
  canvas: null,
  dragging: { active: false, model: null, lastX: 0 },
  isTransitioning: false,
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

// Responsive scaling functions
const getResponsiveBaseScale = () => {
  const width = window.innerWidth;
  if (width <= 480) return 0.08;
  if (width <= 768) return 0.1;
  if (width <= 1024) return 0.12;
  if (width <= 1440) return 0.15;
  return 0.18;
};

const getExpandedScaleMultiplier = () => {
  const width = window.innerWidth;
  if (width <= 480) return 0.6;
  if (width <= 768) return 0.7;
  if (width <= 1024) return 0.8;
  if (width <= 1440) return 0.9;
  return 1;
};

// Spotlight creation and management
const createSpotlight = (modelName) => {
  const spotlight = new SpotLight(0xffffff, 2, 15, Math.PI / 6, 0.3, 1);
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 1024;
  spotlight.shadow.mapSize.height = 1024;
  spotlight.shadow.camera.near = 0.5;
  spotlight.shadow.camera.far = 15;

  // Create a container to group spotlight with its target
  const lightContainer = new Object3D();
  lightContainer.add(spotlight);
  lightContainer.add(spotlight.target);

  state.scene.add(lightContainer);
  state.spotlights.set(modelName, { spotlight, container: lightContainer });

  return { spotlight, container: lightContainer };
};

const updateSpotlightPosition = (
  modelName,
  modelPosition,
  expanded = false
) => {
  const lights = state.spotlights.get(modelName);
  if (!lights) return;

  const { spotlight, container } = lights;

  // Position spotlight above and slightly in front of the model
  const lightOffset = expanded ? new Vector3(0, 3, 4) : new Vector3(0, 2, 3);
  const lightPosition = modelPosition.clone().add(lightOffset);

  spotlight.position.copy(lightPosition);
  spotlight.target.position.copy(modelPosition);

  // Adjust intensity based on expansion state
  spotlight.intensity = expanded ? 3 : 2;
  spotlight.distance = expanded ? 20 : 15;

  // Update the container position (though individual components are positioned)
  container.position.copy(modelPosition);
};

const updateSpotlightVisibility = (modelName, visible) => {
  const lights = state.spotlights.get(modelName);
  if (!lights) return;

  lights.spotlight.visible = visible;
  lights.container.visible = visible;
};

// Update all model scales when screen size changes
const updateModelScales = () => {
  const baseScale = getResponsiveBaseScale();
  const expandedMultiplier = getExpandedScaleMultiplier();

  state.models.forEach((model, name) => {
    const card = document.querySelector(`[data-model="${name}"]`);
    const isExpanded = card?.classList.contains("expanded");

    model.baseScale = baseScale;
    const targetScale = baseScale * (isExpanded ? expandedMultiplier : 1);
    model.scale.setScalar(targetScale);
  });
};

// Button creation
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
  const buttons = [];

  if (project.demoUrl) {
    buttons.push({
      url: project.demoUrl,
      cls: "btn-primary",
      icon: "#icon-play-btn",
      text: "Live Demo",
    });
  }

  if (project.sourceUrl) {
    let icon = null;
    let text = "Source Code";
    if (project.sourceUrl.includes("github.com")) icon = "#icon-github";
    else if (project.sourceUrl.includes("gitlab.com")) icon = "#icon-gitlab";
    else if (project.sourceUrl.includes("itch.io")) {
      icon = "#icon-itch";
      text = "Itch Page";
    }

    buttons.push({
      url: project.sourceUrl,
      cls: "btn-secondary",
      icon,
      text,
    });
  }

  buttons.forEach(({ url, cls, icon, text }) => {
    const btn = el("a", `btn ${cls}`, { href: url, target: "_blank" });
    btn.innerHTML = `${
      icon ? `<svg><use href="${icon}"></use></svg>` : ""
    }${text}`;
    btnWrapper.appendChild(btn);
  });

  const close = el("button", "btn btn-secondary", { textContent: "Close" });
  close.onclick = (e) => toggleExpand(e, id);
  btnWrapper.appendChild(close);

  frag.appendChild(btnWrapper);
  return frag;
};

// Card creation
const createCard = (project) => {
  if (!project?.id) return null;

  const card = el("div", "game-preview project-card", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  // Image container
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

// Animation function
const animate = (model, toPos, toScale, duration = 400, instant = false) => {
  if (!model) return;

  model.animating = false; // Stop any existing animation

  if (instant) {
    model.position.copy(toPos);
    model.scale.setScalar(toScale);
    // Update spotlight position immediately
    const modelName = [...state.models.entries()].find(
      ([, m]) => m === model
    )?.[0];
    if (modelName) {
      const card = document.querySelector(`[data-model="${modelName}"]`);
      const expanded = card?.classList.contains("expanded");
      updateSpotlightPosition(modelName, toPos, expanded);
    }
    return;
  }

  model.animating = true;
  const startPos = model.position.clone();
  const startScale = model.scale.x;
  const start = performance.now();

  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = easeOut(t);

    model.position.lerpVectors(startPos, toPos, ease);
    model.scale.setScalar(startScale + (toScale - startScale) * ease);

    // Update spotlight position during animation
    const modelName = [...state.models.entries()].find(
      ([, m]) => m === model
    )?.[0];
    if (modelName) {
      const card = document.querySelector(`[data-model="${modelName}"]`);
      const expanded = card?.classList.contains("expanded");
      updateSpotlightPosition(modelName, model.position, expanded);
    }

    if (t < 1) requestAnimationFrame(tick);
    else model.animating = false;
  };
  requestAnimationFrame(tick);
};

// Model position calculation - FIXED CENTERING ISSUE
const getModelPos = (modelName, expanded = false) => {
  if (!state.canvas || !state.camera) return new Vector3(0, 0, 10);

  if (expanded) {
    const card = document.querySelector(`[data-model="${modelName}"].expanded`);
    const container = card?.querySelector(".game-image-container");

    if (container) {
      const canvasRect = state.canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (containerRect.width > 0 && containerRect.height > 0) {
        // Calculate the exact center of the container relative to canvas
        // Apply a small offset correction to account for any systematic bias
        const centerX = Math.round(
          containerRect.left + containerRect.width * 0.5 - canvasRect.left - 1 // Subtract 1px to compensate for right bias
        );
        const centerY = Math.round(
          containerRect.top + containerRect.height * 0.5 - canvasRect.top
        );

        // Convert to normalized device coordinates (-1 to 1)
        const ndcX = (centerX / canvasRect.width) * 2.0 - 1.0;
        const ndcY = -((centerY / canvasRect.height) * 2.0 - 1.0);

        // Use direct unprojection with precise positioning
        const targetZ = 6;
        const vector = new Vector3(ndcX, ndcY, 0.5);
        vector.unproject(state.camera);

        const direction = vector.sub(state.camera.position).normalize();
        return state.camera.position
          .clone()
          .add(direction.multiplyScalar(targetZ));
      }
    }
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

// Position update - PRESERVED ORIGINAL LOGIC
const updatePositions = () => {
  if (!state.canvas || state.isTransitioning) return;

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
    const card = document.querySelector(`[data-model="${name}"]`);
    const shouldBeVisible = card && card.style.display !== "none";

    // Set visibility
    if (isAnyCardExpanded) {
      model.visible = name === expandedModelName;
      updateSpotlightVisibility(name, name === expandedModelName);
    } else {
      model.visible = shouldBeVisible;
      updateSpotlightVisibility(name, shouldBeVisible);
    }

    if (!model.visible) return;

    const expanded = card.classList.contains("expanded");
    const targetPos = getModelPos(name, expanded);
    const expandedMultiplier = getExpandedScaleMultiplier();
    const targetScale =
      (model.baseScale || getResponsiveBaseScale()) *
      (expanded ? expandedMultiplier : 1);

    if (
      model.position.distanceTo(targetPos) > 0.1 ||
      Math.abs(model.scale.x - targetScale) > 0.01
    ) {
      model.animating = false;
      animate(model, targetPos, targetScale, expanded ? 600 : 400);
    } else {
      // Update spotlight position even when not animating
      updateSpotlightPosition(name, targetPos, expanded);
    }
  });
};

// Wait for layout completion
const waitForLayoutComplete = (expanding, modelName) => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 100;

    const checkLayout = () => {
      attempts++;

      if (expanding) {
        const card = document.querySelector(
          `[data-model="${modelName}"].expanded`
        );
        const container = card?.querySelector(".game-image-container");
        const rect = container?.getBoundingClientRect();

        if (rect && rect.width > 200 && rect.height > 200) {
          setTimeout(() => {
            const newRect = container.getBoundingClientRect();
            if (
              Math.abs(newRect.width - rect.width) < 5 &&
              Math.abs(newRect.height - rect.height) < 5
            ) {
              resolve();
            } else if (attempts < maxAttempts) {
              requestAnimationFrame(checkLayout);
            } else {
              resolve();
            }
          }, 50);
        } else if (attempts < maxAttempts) {
          requestAnimationFrame(checkLayout);
        } else {
          resolve();
        }
      } else {
        const cards = document.querySelectorAll(
          ".project-card:not(.hidden-card)"
        );
        let allSettled = true;

        cards.forEach((card) => {
          const window = card.querySelector(".model-view-window");
          if (window) {
            const rect = window.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 50) {
              allSettled = false;
            }
          }
        });

        if (allSettled || attempts >= maxAttempts) {
          resolve();
        } else {
          requestAnimationFrame(checkLayout);
        }
      }
    };

    requestAnimationFrame(checkLayout);
  });
};

// Toggle expand function - PRESERVED ORIGINAL LOGIC
const toggleExpand = async (e, id) => {
  e?.preventDefault();
  e?.stopPropagation();

  const card = document.getElementById(id);
  if (!card || state.isTransitioning) return;

  const expanding = !card.classList.contains("expanded");
  const modelName = card.dataset.model;

  state.isTransitioning = true;

  // Hide all models and spotlights immediately
  state.models.forEach((model, name) => {
    model.visible = false;
    updateSpotlightVisibility(name, false);
  });

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

  // Wait for layout
  await waitForLayoutComplete(expanding, modelName);
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Update model positions and visibility
  const expandedCard = document.querySelector(".project-card.expanded");
  const isAnyCardExpanded = !!expandedCard;
  const expandedModelName = expandedCard?.dataset.model;

  state.models.forEach((model, name) => {
    const modelCard = document.querySelector(`[data-model="${name}"]`);
    const shouldBeVisible = modelCard && modelCard.style.display !== "none";

    if (isAnyCardExpanded) {
      model.visible = name === expandedModelName;
      updateSpotlightVisibility(name, name === expandedModelName);
    } else {
      model.visible = shouldBeVisible;
      updateSpotlightVisibility(name, shouldBeVisible);
    }

    if (!model.visible) return;

    const expanded = modelCard.classList.contains("expanded");
    const targetPos = getModelPos(name, expanded);
    const expandedMultiplier = getExpandedScaleMultiplier();
    const targetScale =
      (model.baseScale || getResponsiveBaseScale()) *
      (expanded ? expandedMultiplier : 1);

    animate(model, targetPos, targetScale, expanding ? 600 : 400);
  });

  setTimeout(() => {
    state.isTransitioning = false;
  }, 100);

  if (expanding) {
    setTimeout(() => {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }
};

// Interaction setup
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

  // Event listeners
  document.addEventListener("mousedown", (e) => {
    if (!e.button && startDrag(e.target, e.clientX)) e.preventDefault();
  });
  document.addEventListener("mousemove", (e) =>
    handleMove(e.clientX, e.clientY)
  );
  document.addEventListener("mouseup", endDrag);

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

    updateModelScales();
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

// Model loading
const loadProjectModel = async (name) => {
  if (!name) return null;
  try {
    const model = await loadModel(name);
    state.scene.add(model);

    const baseScale = getResponsiveBaseScale();
    model.baseScale = baseScale;
    model.scale.setScalar(baseScale);

    // Create spotlight for this model
    createSpotlight(name);

    return model;
  } catch (err) {
    console.error(`Failed to load model ${name}:`, err);
    return null;
  }
};

// Export functions
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

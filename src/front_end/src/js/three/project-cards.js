import {
  PerspectiveCamera,
  Vector3,
  SpotLight,
  Object3D,
} from "../extern/three/three.module.min.js";
import { isLowPoweredDevice } from "../utils/device.js";
import { loadModel } from "./model.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { PROJECT_CARD_DATA } from "../data/projects.js";

const state = {
  models: new Map(),
  spotlights: new Map(),
  modelZoomLevels: new Map(), // Store zoom levels for each model in grid mode
  modelExpandedZoomLevels: new Map(), // Store zoom levels for each model in expanded mode
  modelOriginalScales: new Map(), // Store original default scales for each model
  modelRotations: new Map(), // Store rotation states for each model
  scene: null,
  camera: null,
  canvas: null,
  dragging: { active: false, model: null, lastX: 0 },
};

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

// Initialize original scales for a model if not already set
const initializeOriginalScales = (modelName) => {
  if (state.modelOriginalScales.has(modelName)) return;

  const baseScale = getResponsiveBaseScale();
  const expandedScale = baseScale * getExpandedScaleMultiplier();

  state.modelOriginalScales.set(modelName, {
    grid: baseScale,
    expanded: expandedScale,
  });
};

// Get the current zoom level for a model, or default if not set
const getModelZoomLevel = (modelName, isExpanded = false) => {
  // Ensure original scales are initialized
  initializeOriginalScales(modelName);

  const zoomMap = isExpanded
    ? state.modelExpandedZoomLevels
    : state.modelZoomLevels;
  const storedZoom = zoomMap.get(modelName);
  if (storedZoom !== undefined) return storedZoom;

  // Return original default scale
  const originalScales = state.modelOriginalScales.get(modelName);
  return isExpanded ? originalScales.expanded : originalScales.grid;
};

// Set the zoom level for a model
const setModelZoomLevel = (modelName, zoomLevel, isExpanded = false) => {
  const zoomMap = isExpanded
    ? state.modelExpandedZoomLevels
    : state.modelZoomLevels;
  zoomMap.set(modelName, zoomLevel);
};

// Reset a model's scale to its original default
const resetModelToOriginalScale = (modelName, isExpanded = false) => {
  initializeOriginalScales(modelName);
  const originalScales = state.modelOriginalScales.get(modelName);
  const originalScale = isExpanded
    ? originalScales.expanded
    : originalScales.grid;

  // Clear the stored user-modified scale
  const zoomMap = isExpanded
    ? state.modelExpandedZoomLevels
    : state.modelZoomLevels;
  zoomMap.delete(modelName);

  return originalScale;
};

// Get the current rotation for a model, or default if not set
const getModelRotation = (modelName) => {
  return state.modelRotations.get(modelName) || { x: 0, y: 0, z: 0 };
};

// Set the rotation for a model
const setModelRotation = (modelName, rotation) => {
  state.modelRotations.set(modelName, { ...rotation });
};

// Reset a model's rotation to default
const resetModelToOriginalRotation = (modelName) => {
  state.modelRotations.delete(modelName);
  return { x: 0, y: 0, z: 0 };
};

const createSpotlight = (modelName) => {
  const spotlight = new SpotLight(0xffffff, 2, 15, Math.PI / 6, 0.3, 1);
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 1024;
  spotlight.shadow.mapSize.height = 1024;
  spotlight.shadow.camera.near = 0.5;
  spotlight.shadow.camera.far = 15;

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
  const lightOffset = expanded ? new Vector3(0, 3, 4) : new Vector3(0, 2, 3);
  const lightPosition = modelPosition.clone().add(lightOffset);

  spotlight.position.copy(lightPosition);
  spotlight.target.position.copy(modelPosition);
  spotlight.intensity = expanded ? 3 : 2;
  spotlight.distance = expanded ? 20 : 15;
  container.position.copy(modelPosition);
};

const updateSpotlightVisibility = (modelName, visible) => {
  const lights = state.spotlights.get(modelName);
  if (!lights) return;
  lights.spotlight.visible = visible;
  lights.container.visible = visible;
};

// Simplified position calculation - no caching, just direct calculation
const calculateModelPosition = (modelName) => {
  if (!state.canvas || !state.camera) return new Vector3(0, 0, 8);

  const card = document.querySelector(`[data-model="${modelName}"]`);
  if (!card) return new Vector3(0, 0, 8);

  const window = card.querySelector(".model-view-window");
  if (!window) return new Vector3(0, 0, 8);

  const rect = state.canvas.getBoundingClientRect();
  const winRect = window.getBoundingClientRect();

  if (winRect.width === 0 || winRect.height === 0) {
    return new Vector3(0, 0, 8);
  }

  const ndcX =
    ((winRect.left + winRect.width / 2 - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(
    ((winRect.top + winRect.height / 2 - rect.top) / rect.height) * 2 -
    1
  );

  const vector = new Vector3(ndcX, ndcY, 0.5);
  vector.unproject(state.camera);

  const direction = vector.sub(state.camera.position).normalize();
  return state.camera.position.clone().add(direction.multiplyScalar(8));
};

const calculateExpandedPosition = (expandedCard) => {
  if (!state.canvas || !state.camera) return new Vector3(0, 0, 6);

  const modelWindow = expandedCard.querySelector(".model-view-window");
  if (!modelWindow) return new Vector3(0, 0, 6);

  const rect = state.canvas.getBoundingClientRect();
  const winRect = modelWindow.getBoundingClientRect();

  const ndcX =
    ((winRect.left + winRect.width / 2 - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(
    ((winRect.top + winRect.height / 2 - rect.top) / rect.height) * 2 -
    1
  );

  const vector = new Vector3(ndcX, ndcY, 0.5);
  vector.unproject(state.camera);

  const direction = vector.sub(state.camera.position).normalize();
  return state.camera.position.clone().add(direction.multiplyScalar(6));
};

// Updated model positioning - preserves user zoom levels and rotations
const updateAllModelPositions = () => {
  const expandedCard = document.querySelector(".project-card.expanded");
  const isAnyCardExpanded = !!expandedCard;
  const expandedModelName = expandedCard?.dataset.model;

  state.models.forEach((model, modelName) => {
    const card = document.querySelector(`[data-model="${modelName}"]`);

    // Check if card should be visible
    const isVisible =
      card &&
      card.style.display !== "none" &&
      !card.classList.contains("hidden-card");

    if (isAnyCardExpanded) {
      // In expanded mode, only show the expanded model
      const isExpandedModel = modelName === expandedModelName;
      model.visible = isExpandedModel;
      updateSpotlightVisibility(modelName, isExpandedModel);

      if (isExpandedModel) {
        const position = calculateExpandedPosition(expandedCard);
        const scale = getModelZoomLevel(modelName, true);
        const rotation = getModelRotation(modelName);

        model.position.copy(position);
        model.scale.setScalar(scale);
        model.rotation.set(rotation.x, rotation.y, rotation.z);
        updateSpotlightPosition(modelName, position, true);
      }
    } else {
      // In grid mode, show all visible models
      model.visible = isVisible;
      updateSpotlightVisibility(modelName, isVisible);

      if (isVisible) {
        const position = calculateModelPosition(modelName);
        // Use stored zoom level for grid mode too - this preserves user's zoom from expanded state
        const scale = getModelZoomLevel(modelName, false);
        const rotation = getModelRotation(modelName);

        model.position.copy(position);
        model.scale.setScalar(scale);
        model.rotation.set(rotation.x, rotation.y, rotation.z);
        updateSpotlightPosition(modelName, position, false);
      }
    }
  });
};

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

  // Add reset button for expanded view
  const reset = el("button", "btn btn-secondary", {
    textContent: "Reset View",
  });
  reset.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const card = document.getElementById(id);
    const modelName = card?.dataset.model;

    if (modelName) {
      const model = state.models.get(modelName);
      if (model) {
        // Reset to original scale and rotation
        const originalScale = resetModelToOriginalScale(modelName, true);
        const originalRotation = resetModelToOriginalRotation(modelName);

        model.scale.setScalar(originalScale);
        model.rotation.set(
          originalRotation.x,
          originalRotation.y,
          originalRotation.z
        );
      }
    }
  };
  btnWrapper.appendChild(reset);

  frag.appendChild(btnWrapper);
  return frag;
};

const createCard = (project) => {
  if (!project?.id) return null;

  const card = el("div", "game-preview project-card", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  // Create the overlay and expanded content first
  const overlay = el("div", "game-overlay");
  overlay.appendChild(
    el("h3", "game-title", { textContent: project.title || "Untitled" })
  );
  overlay.appendChild(createButtons(project, "overlay", project.id));

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

  [project.shortDescription, ...(project.fullDescription || [])]
    .filter(Boolean)
    .forEach((desc) =>
      inner.appendChild(el("p", "project-description", { textContent: desc }))
    );

  inner.appendChild(createButtons(project, "action", project.id));
  expanded.appendChild(inner);

  // Create model-view-window for expanded content if not low-powered device
  if (!isLowPoweredDevice() && (project.modelName || "")) {
    const expandedWindow = el("div", "model-view-window", {
      "data-model-name": project.modelName || "",
    });
    const expandedHint = el("div", "model-interaction-hint", {
      textContent: "Drag to rotate • Scroll to zoom • Reset View to restore",
    });
    expandedWindow.appendChild(expandedHint);
    expandedWindow.onmouseenter = () => (expandedHint.style.opacity = "0.7");
    expandedWindow.onmouseleave = () => (expandedHint.style.opacity = "0");

    // Add close button to expanded model window
    const expandedClose = el("button", "btn-close", { textContent: "×" });
    expandedClose.onclick = (e) => toggleExpand(e, project.id);
    expandedWindow.appendChild(expandedClose);

    inner.appendChild(expandedWindow);
  }

  // Only create game-image-container for the card preview (not expanded view)
  const container = el("div", "game-image-container");

  // Only add fallback image for low-powered devices
  if (isLowPoweredDevice()) {
    if (project.imageUrl) {
      container.appendChild(
        el("img", "fallback-image", {
          src: project.imageUrl,
          alt: project.title || "Project image",
          loading: "lazy",
        })
      );
    }
  } else {
    // Add model-view-window for card preview on non-low-powered devices
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

  // Append elements to card - container only appears in card preview
  card.append(container, overlay, expanded);
  return card;
};

const toggleExpand = (e, id) => {
  e?.preventDefault();
  e?.stopPropagation();

  const card = document.getElementById(id);
  if (!card) return;

  const expanding = !card.classList.contains("expanded");
  const modelName = card.dataset.model;

  // Handle container height when expanding/collapsing
  const portfolioSection = document.querySelector("#portfolio");
  const container = portfolioSection?.querySelector(".container");

  if (container) {
    if (expanding) {
      // Store original height and set to full viewport
      container.dataset.originalMinHeight =
        getComputedStyle(container).minHeight;
      container.style.minHeight = "100vh";
      container.classList.add("has-expanded-card");
    } else {
      // Restore original height
      const originalHeight = container.dataset.originalMinHeight;
      if (originalHeight) {
        container.style.minHeight = originalHeight;
        delete container.dataset.originalMinHeight;
      } else {
        container.style.minHeight = "fit-content";
      }
      container.classList.remove("has-expanded-card");
    }
  }

  // Store current model state before any changes
  if (modelName) {
    const model = state.models.get(modelName);
    if (model) {
      // Always preserve the current rotation state
      setModelRotation(modelName, {
        x: model.rotation.x,
        y: model.rotation.y,
        z: model.rotation.z,
      });

      // Store scale based on current mode
      const isCurrentlyExpanded = card.classList.contains("expanded");
      setModelZoomLevel(modelName, model.scale.x, isCurrentlyExpanded);
    }
  }

  document.querySelectorAll(".project-card").forEach((c) => {
    if (c.id === id) {
      c.classList.toggle("expanded", expanding);
      c.classList.toggle("section-centered-card", expanding);
    } else {
      c.classList.toggle("hidden-card", expanding);
    }
  });

  document.body.classList.toggle("overflow-hidden", expanding);

  // When expanding, reset the model to original state for expanded view
  if (expanding && modelName) {
    const model = state.models.get(modelName);
    if (model) {
      // Reset to original expanded scale and rotation
      const originalScale = resetModelToOriginalScale(modelName, true);
      const originalRotation = resetModelToOriginalRotation(modelName);

      model.scale.setScalar(originalScale);
      model.rotation.set(
        originalRotation.x,
        originalRotation.y,
        originalRotation.z
      );
    }
  }

  // Update model positions immediately
  updateAllModelPositions();

  if (expanding) {
    card.scrollIntoView({ behavior: "instant", block: "center" });
  }
};

const setupInteraction = () => {
  const handleMove = (x, y) => {
    if (!state.dragging.active || !state.dragging.model) return;

    // Calculate the delta movement
    const deltaX = x - state.dragging.lastX;

    // Apply rotation based on delta - consistent direction
    state.dragging.model.rotation.y += deltaX * 0.01;

    // Update last position
    state.dragging.lastX = x;

    // Store the updated rotation
    const modelName = [...state.models.entries()].find(
      ([name, model]) => model === state.dragging.model
    )?.[0];

    if (modelName) {
      setModelRotation(modelName, {
        x: state.dragging.model.rotation.x,
        y: state.dragging.model.rotation.y,
        z: state.dragging.model.rotation.z,
      });
    }
  };

  const startDrag = (element, x) => {
    const win = element.closest(".model-view-window");
    const model = win && state.models.get(win.dataset.modelName);
    if (!model) return false;

    // Store initial drag state
    state.dragging = {
      active: true,
      model,
      lastX: x,
      startX: x, // Store starting position for reference
    };

    document.body.style.cursor = "grabbing";
    return true;
  };

  const endDrag = () => {
    state.dragging.active = false;
    state.dragging.model = null;
    document.body.style.cursor = "";
  };

  // Mouse events
  document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && startDrag(e.target, e.clientX)) {
      e.preventDefault();
    }
  });

  document.addEventListener("mousemove", (e) => {
    handleMove(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", endDrag);

  // Touch events - handle single touch only
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(e.target, touch.clientX);
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      // Only end drag if no touches remain
      if (e.touches.length === 0) {
        endDrag();
      }
    },
    { passive: true }
  );

  // Wheel event for zooming
  document.addEventListener(
    "wheel",
    (e) => {
      const win = e.target.closest(".model-view-window");
      const card = win?.closest(".project-card.expanded");
      const model = card && state.models.get(win.dataset.modelName);
      const modelName = win?.dataset.modelName;

      if (model && modelName) {
        e.preventDefault();
        const currentScale = model.scale.x;
        const newScale = Math.max(
          0.05,
          Math.min(0.8, currentScale * (1 - Math.sign(e.deltaY) * 0.1))
        );

        // Update the model scale
        model.scale.setScalar(newScale);

        // Store the new zoom level for expanded mode
        setModelZoomLevel(modelName, newScale, true);
      }
    },
    { passive: false }
  );

  // Keyboard events
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const expanded = document.querySelector(".project-card.expanded");
      if (expanded) toggleExpand(null, expanded.id);
    }
  });

  // Resize handling
  const handleResize = () => {
    if (!state.canvas || !state.camera) return;

    // Get the actual client dimensions
    const clientWidth = state.canvas.clientWidth;
    const clientHeight = state.canvas.clientHeight;

    // Skip if dimensions are invalid
    if (clientWidth <= 0 || clientHeight <= 0) return;

    // Only update if dimensions actually changed
    if (
      state.canvas.width !== clientWidth ||
      state.canvas.height !== clientHeight
    ) {
      state.canvas.width = clientWidth;
      state.canvas.height = clientHeight;

      // Update camera aspect ratio
      const aspect = clientWidth / clientHeight;
      state.camera.aspect = aspect;
      state.camera.updateProjectionMatrix();

      console.log(
        `Canvas resized to ${clientWidth}x${clientHeight}, aspect: ${aspect}`
      );
    }

    updateAllModelPositions();

    // Update original scales when window is resized
    state.models.forEach((model, modelName) => {
      // Clear existing original scales so they get recalculated with new responsive values
      state.modelOriginalScales.delete(modelName);
      initializeOriginalScales(modelName);
    });
  };

  window.addEventListener("resize", handleResize);
  new ResizeObserver(handleResize).observe(
    document.querySelector("#portfolio")
  );

  // Simple, immediate response to filter changes
  new MutationObserver(() => {
    // Use requestAnimationFrame for immediate updates
    requestAnimationFrame(() => {
      updateAllModelPositions();
    });
  }).observe(document.body, {
    attributes: true,
    attributeFilter: ["style"],
    subtree: true,
    childList: true,
  });
};

const loadProjectModel = async (name) => {
  if (!name) return null;
  try {
    const model = await loadModel(name);
    state.scene.add(model);
    createSpotlight(name);

    // Initialize original scales for this model
    initializeOriginalScales(name);

    return model;
  } catch (err) {
    console.error(`Failed to load model ${name}:`, err);
    return null;
  }
};

export const resetExpandedCards = () => {
  const expandedCard = document.querySelector(".project-card.expanded");
  if (expandedCard) {
    const modelName = expandedCard.dataset.model;

    // Reset container height
    const portfolioSection = document.querySelector("#portfolio");
    const container = portfolioSection?.querySelector(".container");

    if (container) {
      const originalHeight = container.dataset.originalMinHeight;
      if (originalHeight) {
        container.style.minHeight = originalHeight;
        delete container.dataset.originalMinHeight;
      } else {
        container.style.minHeight = "fit-content";
      }
      container.classList.remove("has-expanded-card");
    }

    // Preserve current state before closing
    if (modelName) {
      const model = state.models.get(modelName);
      if (model) {
        // Store current rotation and zoom before closing
        setModelRotation(modelName, {
          x: model.rotation.x,
          y: model.rotation.y,
          z: model.rotation.z,
        });
        // Store expanded scale separately
        setModelZoomLevel(modelName, model.scale.x, true);
      }
    }

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

  const modelNames = [...document.querySelectorAll("[data-model]")]
    .map((element) => element.dataset.model)
    .filter(Boolean);

  await Promise.all(
    modelNames.map(async (name) => {
      const model = await loadProjectModel(name);
      if (model) state.models.set(name, model);
    })
  );

  // Initial positioning
  requestAnimationFrame(() => {
    updateAllModelPositions();
    setupInteraction();
  });
};

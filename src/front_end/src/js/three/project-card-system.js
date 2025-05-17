/**
 * @fileoverview Unified project card system with 3D model integration
 */

import {
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "../extern/three/three.module.min.js";
import { updateOverlay } from "../grid-overlay.js";
import { isLowPoweredDevice } from "../utils/device";
import { calculateModelPositions, getModel } from "./model-manager.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { debounce } from "../utils/helper.js";
import { PROJECT_CARD_DATA } from "../data/projects.js";
import { random } from "../utils/random.js";

// DOM cache and scene references
const domCache = {};
let scene = null;
let projectCamera = null;
let cameraIndex = -1;
let raycaster = null;
let currentFocusedProject = null;
let projectModels = new Map(); // model name -> model reference
let animationFrameId = null;
let viewWindowPositions = new Map(); // model name -> viewport position

/**
 * DOM and UI helpers
 */
function createElement(tag, className, attributes = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attributes).forEach(([key, val]) => {
    if (val != null) {
      key === "textContent"
        ? (el.textContent = val)
        : el.setAttribute(key, val);
    }
  });
  return el;
}

function getElement(selector, cacheProp) {
  return (
    domCache[cacheProp] ||
    (domCache[cacheProp] = document.querySelector(selector))
  );
}

function getBackdrop() {
  if (domCache.backdrop) return domCache.backdrop;

  let backdrop = document.querySelector(".backdrop");
  if (!backdrop) {
    backdrop = createElement("div", "backdrop");
    backdrop.onclick = (e) => {
      const expandedCard = document.querySelector(".game-preview.expanded");
      if (expandedCard) toggleExpand(e, expandedCard.id);
    };
    document.body.appendChild(backdrop);
  }
  domCache.backdrop = backdrop;
  return backdrop;
}

/**
 * Project card functionality
 */
function createProjectCard(project) {
  if (!project?.id) return null;

  const card = createElement("div", "game-preview project-card", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  const imageContainer = createElement(
    "div",
    "game-image-container portfolio-canvas"
  );
  const isLowPower = isLowPoweredDevice();

  // Add container based on device capability
  if (isLowPower) {
    addStaticImage(imageContainer, project);
  } else {
    addModelViewWindow(imageContainer, project);
  }

  // Add close button
  const closeBtn = createElement("button", "btn-close", { textContent: "×" });
  closeBtn.onclick = (e) => toggleExpand(e, project.id);
  imageContainer.appendChild(closeBtn);

  // Create overlay with title and buttons
  const overlay = createElement("div", "game-overlay");
  overlay.appendChild(
    createElement("h3", "game-title", {
      textContent: project.title || "Untitled Project",
    })
  );
  overlay.appendChild(createButtons(project, "overlay", project.id));

  // Create expanded content
  card.append(
    imageContainer,
    overlay,
    createExpandedContent(project, project.id)
  );
  card.projectData = project;
  return card;
}

function addStaticImage(container, project) {
  const imageElement = createElement("div", "game-image");
  if (project.imageUrl) {
    imageElement.style.backgroundImage = `url(${project.imageUrl})`;
    container.appendChild(
      createElement("img", "fallback-image", {
        src: project.imageUrl,
        alt: project.title || "Project image",
        loading: "lazy",
      })
    );
  }
  container.appendChild(imageElement);
}

function addModelViewWindow(container, project) {
  const viewWindow = createElement("div", "model-view-window", {
    "data-model-name": project.modelName || "",
  });
  const scrollContainer = createElement("div", "model-view-scroll-container");
  const interactionHint = createElement("div", "model-interaction-hint", {
    textContent: "Drag to rotate",
  });

  // Show/hide hint on hover
  viewWindow.addEventListener(
    "mouseenter",
    () => (interactionHint.style.opacity = "0.7"),
    { passive: true }
  );
  viewWindow.addEventListener(
    "mouseleave",
    () => (interactionHint.style.opacity = "0"),
    { passive: true }
  );

  scrollContainer.appendChild(interactionHint);
  viewWindow.appendChild(scrollContainer);
  container.appendChild(viewWindow);
}

function createExpandedContent(project, projectId) {
  const expanded = createElement("div", "expanded-content");
  const inner = createElement("div", "expanded-content-inner");

  inner.appendChild(
    createElement("h2", "card-title", {
      textContent: project.title || "Untitled Project",
    })
  );

  // Add tags
  const tagsContainer = createElement("div", "project-tags");
  if (project.tags?.length) {
    const fragment = document.createDocumentFragment();
    project.tags.forEach((tag) => {
      fragment.appendChild(
        createElement("span", "project-tag", { textContent: tag })
      );
    });
    tagsContainer.appendChild(fragment);
  }
  inner.appendChild(tagsContainer);

  // Add descriptions
  if (project.shortDescription) {
    inner.appendChild(
      createElement("p", "project-description", {
        textContent: project.shortDescription,
      })
    );
  }

  if (project.fullDescription?.length) {
    project.fullDescription.forEach((paragraph) => {
      if (paragraph) {
        inner.appendChild(
          createElement("p", "project-description", { textContent: paragraph })
        );
      }
    });
  }

  // Add action buttons
  inner.appendChild(createButtons(project, "action", projectId));
  expanded.appendChild(inner);

  return expanded;
}

function toggleExpand(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const card = document.getElementById(id);
  if (!card) return;

  const expanding = !card.classList.contains("expanded");

  // Collapse other expanded cards
  document.querySelectorAll(".game-preview.expanded").forEach((el) => {
    if (el.id !== id) el.classList.remove("expanded", "expand-left");
  });

  // Toggle expanded state
  card.classList.toggle("expanded", expanding);

  if (expanding) {
    const rect = card.getBoundingClientRect();
    card.classList.toggle("expand-left", rect.right + 160 > window.innerWidth);
  } else {
    card.classList.remove("expand-left");
  }

  // Handle backdrop and body scroll
  const backdrop = getBackdrop();
  if (backdrop) backdrop.classList.toggle("active", expanding);
  document.body.classList.toggle("overflow-hidden", expanding);

  updateOverlay();
}

function createButtons(project, buttonType, projectId) {
  const fragment = document.createDocumentFragment();

  if (buttonType === "overlay") {
    // Create "View Details" button for the overlay
    const viewBtn = createElement("button", "btn btn-view", {
      textContent: "View Details",
    });
    viewBtn.onclick = (e) => toggleExpand(e, projectId);
    fragment.appendChild(viewBtn);
  } else if (buttonType === "action") {
    // Create action buttons for expanded view
    if (project.demoUrl) {
      // Create Live Demo button with proper styling
      const demoButton = createElement("a", "btn btn-primary", {
        href: project.demoUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      });

      // Add play icon and text to demo button
      demoButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>Live Demo</span>
      `;
      fragment.appendChild(demoButton);
    }

    if (project.githubUrl) {
      // Create source code button
      const sourceButton = createElement("a", "btn btn-secondary", {
        href: project.githubUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      });

      // Determine which icon to use based on URL
      let iconSvg;
      if (project.githubUrl.includes("github.com")) {
        // GitHub icon
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
        `;
      } else if (project.githubUrl.includes("gitlab.com")) {
        // GitLab icon
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"></path>
          </svg>
        `;
      } else if (project.githubUrl.includes("itch.io")) {
        // Itch.io icon
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2zm12 10l-4-4-4 4V5h8v10z"></path>
          </svg>
        `;
      } else {
        // Generic code icon for other repositories
        iconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        `;
      }

      sourceButton.innerHTML = `${iconSvg}<span>Source Code</span>`;
      fragment.appendChild(sourceButton);
    }

    // Add close button for mobile
    const closeBtn = createElement("button", "btn btn-close-expanded", {
      textContent: "Close",
    });
    closeBtn.onclick = (e) => toggleExpand(e, projectId);
    fragment.appendChild(closeBtn);
  }

  return fragment;
}
const grid = getElement(".project-card-grid", "portfolioGrid");
/**
 * Initialize project cards and 3D scene
 */
export function initProjectCards() {
  renderProjectsGrid(PROJECT_CARD_DATA);
  getBackdrop(); // Initialize backdrop
}

function renderProjectsGrid(projects) {
  if (!Array.isArray(projects)) return;

  const fragment = document.createDocumentFragment();
  projects.forEach((project) => {
    const card = createProjectCard(project);
    if (card) fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

/**
 * 3D scene functionality
 */
export function initProjectCardScene() {
  if (isLowPoweredDevice()) return;

  scene = getScene();
  raycaster = new Raycaster();

  // Create main canvas
  const canvas = createMainCanvas();
  if (!canvas) return;
  domCache.mainCanvas = canvas;

  // Get model names from portfolio items
  const modelNames = Array.from(document.querySelectorAll(".project-card"))
    .map((item) => item.getAttribute("data-model"))
    .filter(Boolean);

  // Setup scene components
  calculateModelPositions(modelNames);
  setupMainCamera(canvas);
  cacheViewWindowPositions();
  setupProjects();
  setupInteractions();
}

function createMainCanvas() {
  const portfolioSection = getElement("#portfolio", "portfolioSection");
  if (!portfolioSection) return null;

  const canvas = createElement("canvas", "portfolio-canvas", {
    id: "portfolio-main-canvas",
  });

  Object.assign(canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2",
    pointerEvents: "auto",
  });

  canvas.width = portfolioSection.clientWidth || 300;
  canvas.height = portfolioSection.clientHeight || 200;

  portfolioSection.style.position = "relative";
  portfolioSection.append(canvas);

  return canvas;
}

function setupMainCamera(canvas) {
  projectCamera = new PerspectiveCamera(
    45,
    canvas.width / canvas.height,
    0.1,
    16
  );
  projectCamera.position.set(0, 0, 10);
  projectCamera.lookAt(0, 0, 0);
  projectCamera.up.set(0, 1, 0);

  const ctx = canvas.getContext("2d", { alpha: true });
  cameraIndex = registerCamera(projectCamera, ctx);
}

async function setupProjects() {
  const loadPromises = [];

  document.querySelectorAll(".project-card").forEach((item) => {
    const modelName = item.getAttribute("data-model");
    if (!modelName) return;

    loadPromises.push(
      loadProjectModel(modelName)
        .then((model) => {
          if (model) {
            projectModels.set(modelName, model);
            positionModelForItem(model, modelName);
          }
        })
        .catch((err) =>
          console.error(`Failed to load model ${modelName}:`, err)
        )
    );
  });

  await Promise.all(loadPromises);
}

async function loadProjectModel(modelName) {
  if (!modelName) return null;

  try {
    const model = await getModel(modelName);
    if (!model.parent) scene.add(model);

    model.visible = true;
    model.userData.name = modelName;
    model.updateMatrix();
    model.matrixAutoUpdate = false;

    return model;
  } catch (error) {
    console.error(`Failed to load model ${modelName}:`, error);
    return null;
  }
}

function cacheViewWindowPositions() {
  const windows = document.querySelectorAll(".model-view-window");
  const canvas = domCache.mainCanvas;
  const canvasRect = canvas?.getBoundingClientRect();

  if (!canvasRect) return;
  viewWindowPositions.clear();

  windows.forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    const windowRect = viewWindow.getBoundingClientRect();

    viewWindowPositions.set(modelName, {
      x:
        ((windowRect.left + windowRect.width / 2 - canvasRect.left) /
          canvasRect.width) *
          2 -
        1,
      y: -(
        ((windowRect.top + windowRect.height / 2 - canvasRect.top) /
          canvasRect.height) *
          2 -
        1
      ),
      width: windowRect.width / canvasRect.width,
      height: windowRect.height / canvasRect.height,
      pixelWidth: windowRect.width,
      pixelHeight: windowRect.height,
    });
  });
}

function positionModelForItem(model, modelName) {
  if (!model || !modelName) return;

  const viewPos = viewWindowPositions.get(modelName);
  if (!viewPos) return;

  // Scale model to fit view window
  const modelSize = getModelSize(model);
  const containerScale = Math.min(viewPos.width, viewPos.height) * 10;
  const finalScale = Math.min(0.15, (containerScale / modelSize) * 0.15);

  model.scale.set(finalScale, finalScale, finalScale);

  if (!model.userData.initialScale) {
    model.userData.initialScale = finalScale;
    model.userData.currentScale = model.scale.clone();
  }

  // Position model in 3D space
  const zDistance = Math.max(6, modelSize * 3);
  const vector = new Vector3(viewPos.x, viewPos.y, 0.5);
  vector.unproject(projectCamera);
  vector.sub(projectCamera.position).normalize();
  vector.multiplyScalar(zDistance);
  vector.add(projectCamera.position);

  model.position.copy(vector);
  model.rotation.set(0, Math.PI, 0);

  if (!model.userData.originalPosition) {
    model.userData.originalPosition = model.position.clone();
  }
  if (!model.userData.originalRotation) {
    model.userData.originalRotation = model.rotation.clone();
  }

  model.updateMatrix();
  model.updateMatrixWorld(true);
}

function getModelSize(model) {
  const box = model.userData.boundingBox;
  if (box) {
    return Math.max(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    );
  }
  return 2; // Default size
}

/**
 * Interactions and animations
 */
function setupInteractions() {
  const canvas = domCache.mainCanvas;
  if (!canvas) return;

  // Setup resize and interaction handlers
  window.addEventListener("resize", debounce(handleResize, 100));
  setupDragInteraction();
  setupScrollInteraction();
  setupResizeObserver();
}

function handleResize() {
  const canvas = domCache.mainCanvas;
  if (canvas && projectCamera) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    projectCamera.aspect = canvas.width / canvas.height;
    projectCamera.updateProjectionMatrix();
    cacheViewWindowPositions();
    updateModelPositions();
  }
}

// Drag interaction state and handlers
function setupDragInteraction() {
  const dragState = {
    active: false,
    model: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    rotationSpeed: { x: 0, y: 0 },
  };

  // Add drag handlers to model view windows
  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    // Mouse events
    viewWindow.addEventListener(
      "mousedown",
      (e) => {
        if (e.button !== 0) return;
        startDrag(e, modelName, e.clientX, e.clientY, dragState, viewWindow);
      },
      { passive: true }
    );

    // Touch events
    viewWindow.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startDrag(
          e,
          modelName,
          touch.clientX,
          touch.clientY,
          dragState,
          viewWindow
        );
      },
      { passive: true }
    );

    viewWindow.addEventListener(
      "touchmove",
      (e) => {
        if (!dragState.active || e.touches.length !== 1) return;
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY, dragState);
      },
      { passive: true }
    );

    viewWindow.addEventListener(
      "touchend",
      () => endDrag(dragState, viewWindow),
      { passive: true }
    );
    viewWindow.addEventListener(
      "touchcancel",
      () => endDrag(dragState, viewWindow),
      { passive: true }
    );
  });

  // Global event handlers
  window.addEventListener(
    "mousemove",
    (e) => {
      if (dragState.active) moveDrag(e.clientX, e.clientY, dragState);
    },
    { passive: true }
  );

  window.addEventListener(
    "mouseup",
    () => {
      if (dragState.active) endDrag(dragState);
    },
    { passive: true }
  );
}

function startDrag(
  event,
  modelName,
  clientX,
  clientY,
  state,
  viewWindow = null
) {
  const model = projectModels.get(modelName);
  if (!model) return false;

  state.active = true;
  state.model = model;
  state.lastX = clientX;
  state.lastY = clientY;
  model.userData.animate = false;

  document.body.style.cursor = "grabbing";
  document.body.classList.add("model-interaction");
  if (viewWindow) viewWindow.style.cursor = "grabbing";

  return true;
}

function moveDrag(clientX, clientY, state) {
  if (!state.active || !state.model) return;

  const model = state.model;
  const deltaX = clientX - state.lastX;

  // Apply Y-axis rotation only
  model.rotation.y += deltaX * 0.01;
  model.rotation.x = 0;
  model.rotation.z = 0;

  model.updateMatrix();
  model.updateMatrixWorld(true);

  state.rotationSpeed.y = deltaX * 0.01;
  state.lastX = clientX;
  state.lastY = clientY;
}

function endDrag(state, viewWindow = null) {
  if (state.active && state.model) {
    applyRotationInertia(state.model, state.rotationSpeed);
  }

  state.active = false;
  state.model = null;
  document.body.style.cursor = "";
  document.body.classList.remove("model-interaction");
  if (viewWindow) viewWindow.style.cursor = "pointer";
}

function applyRotationInertia(model, speed) {
  if (!model) return;

  const friction = 0.95;
  let inertiaSpeed = { x: 0, y: speed.y * 0.5 };

  if (model.userData.inertiaAnimationId) {
    cancelAnimationFrame(model.userData.inertiaAnimationId);
  }

  if (Math.abs(inertiaSpeed.y) < 0.001) {
    model.userData.animate = true;
    return;
  }

  function animateInertia() {
    model.rotation.y += inertiaSpeed.y;
    model.rotation.x = 0;
    model.rotation.z = 0;

    model.updateMatrix();
    model.updateMatrixWorld(true);

    inertiaSpeed.y *= friction;

    if (Math.abs(inertiaSpeed.y) > 0.0001) {
      model.userData.inertiaAnimationId = requestAnimationFrame(animateInertia);
    } else {
      model.userData.animate = true;
    }
  }

  model.userData.inertiaAnimationId = requestAnimationFrame(animateInertia);
}

function setupScrollInteraction() {
  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    viewWindow.style.overscrollBehavior = "none";

    viewWindow.addEventListener(
      "wheel",
      (event) => {
        const model = projectModels.get(modelName);
        if (!model) return;

        const delta = Math.sign(event.deltaY) * -0.05;
        const scaleFactor = 1 + delta;

        if (!model.userData.currentScale) {
          model.userData.currentScale = model.scale.clone();
          model.userData.initialScale = model.scale.x;
        }

        const minScale = model.userData.initialScale * 0.5;
        const maxScale = model.userData.initialScale * 3;
        const newScale = model.userData.currentScale.x * scaleFactor;

        if (newScale >= minScale && newScale <= maxScale) {
          model.userData.currentScale.set(newScale, newScale, newScale);
          model.scale.copy(model.userData.currentScale);
          model.updateMatrix();
          model.updateMatrixWorld(true);
        }
      },
      { passive: true }
    );
  });
}

function setupResizeObserver() {
  if (!window.ResizeObserver) return;

  const resizeHandler = debounce(handleResize, 100);
  const observer = new ResizeObserver(resizeHandler);

  document
    .querySelectorAll(".project-card")
    .forEach((item) => observer.observe(item));

  const grid = getElement(".project-card-grid", "portfolioGrid");
  if (grid) observer.observe(grid);

  const portfolioSection = getElement("#portfolio", "portfolioSection");
  if (portfolioSection) observer.observe(portfolioSection);
}

function updateModelPositions() {
  projectModels.forEach((model, modelName) => {
    const viewPos = viewWindowPositions.get(modelName);
    if (!viewPos) return;

    positionModelForItem(model, modelName);

    if (model.userData.currentScale && model.userData.initialScale) {
      const ratio = model.userData.currentScale.x / model.userData.initialScale;
      const newScale = model.scale.x * ratio;
      model.scale.set(newScale, newScale, newScale);
    }
  });
}

/**
 * Setup model rotation animations
 */
export function setupModelRotationAnimations() {
  projectModels.forEach((model) => {
    if (!model) return;

    if (!model.userData.originalRotation) {
      model.rotation.set(0, Math.PI, 0);
      model.userData.originalRotation = model.rotation.clone();
    }

    model.userData.animate = true;
    model.userData.rotationSpeed = 0.003 + random() * 0.004;
    model.userData.isInteractive = true;
  });
}

/**
 * Utility function for prefetching
 */
export function getVisibleProjectModels() {
  const visibleModels = new Set();

  document.querySelectorAll(".project-card").forEach((item) => {
    const rect = item.getBoundingClientRect();
    const isVisible =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    if (isVisible) {
      const modelName = item.getAttribute("data-model");
      if (modelName) visibleModels.add(modelName);
    }
  });

  return Array.from(visibleModels);
}

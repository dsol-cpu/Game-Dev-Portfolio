/**
 * @fileoverview Unified project card system with 3D model integration
 * Combines project card creation/management with optimized ThreeJS rendering
 */

import { C } from "../constants/constants.js";
import { projectCardData } from "../data/project";
import {
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "../extern/three/three.module.min.js";
import { handleUserInteraction } from "../user-interaction.js";
import { isLowPoweredDevice } from "../utils/device";
import { calculateModelPositions, getModel } from "./model-manager.js";
import { getScene, registerCamera, renderFrame } from "./threejs-manager.js";

// DOM cache and scene references
const domCache = {
  portfolioGrid: null,
  backdrop: null,
  mainCanvas: null,
  portfolioSection: null,
};

let scene = null;
let projectCamera = null;
let cameraIndex = -1;
let raycaster = null;
let currentFocusedProject = null;
let projectModels = new Map(); // model name -> model reference
let animationFrameId = null;
let viewWindowPositions = new Map(); // model name -> viewport position

/**
 * DOM helper functions
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
  if (domCache[cacheProp]) return domCache[cacheProp];
  const element = document.querySelector(selector);
  if (element) domCache[cacheProp] = element;
  else console.warn(`${selector} not found`);
  return element;
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

function getPortfolioGrid() {
  return getElement(".portfolio-grid", "portfolioGrid");
}

function getPortfolioSection() {
  return getElement(
    ".portfolio-section, #portfolio, .portfolio",
    "portfolioSection"
  );
}

/**
 * Project card creation functions
 */
function createProjectCard(project) {
  if (!project?.id) return null;

  const card = createElement("div", "game-preview portfolio-item", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  const imageContainer = createElement(
    "div",
    "game-image-container portfolio-canvas"
  );

  // Add appropriate container based on device capability
  if (isLowPoweredDevice()) {
    // Add static image for low-end devices
    const imageElement = createElement("div", "game-image");
    if (project.imageUrl) {
      imageElement.style.backgroundImage = `url(${project.imageUrl})`;
      const fallbackImg = createElement("img", "fallback-image", {
        src: project.imageUrl,
        alt: project.title || "Project image",
        loading: "lazy",
      });
      imageContainer.appendChild(fallbackImg);
    }
    imageContainer.appendChild(imageElement);
  } else {
    // Add 3D model view window
    const viewWindow = createElement("div", "model-view-window", {
      "data-model-name": project.modelName || "",
    });

    Object.assign(viewWindow.style, {
      position: "relative",
      width: "100%",
      height: "180px",
      backgroundColor: "transparent",
      borderRadius: "8px",
      overflow: "hidden",
      cursor: "pointer",
    });

    // Add model interaction hint text
    const interactionHint = createElement("div", "model-interaction-hint");
    Object.assign(interactionHint.style, {
      position: "absolute",
      bottom: "8px",
      right: "8px",
      backgroundColor: "rgba(0,0,0,0.5)",
      color: "white",
      padding: "3px 6px",
      borderRadius: "4px",
      fontSize: "10px",
      opacity: "0.7",
      transition: "opacity 0.3s",
      pointerEvents: "none",
    });
    interactionHint.textContent = "Drag to rotate";

    // Show/hide hint on hover
    viewWindow.addEventListener("mouseenter", () => {
      interactionHint.style.opacity = "0.7";
    });
    viewWindow.addEventListener("mouseleave", () => {
      interactionHint.style.opacity = "0";
    });

    viewWindow.appendChild(interactionHint);
    imageContainer.appendChild(viewWindow);
  }

  // Add close button
  const closeBtn = createElement("button", "btn-close", { textContent: "×" });
  closeBtn.onclick = (e) => toggleExpand(e, project.id);
  imageContainer.appendChild(closeBtn);

  // Create overlay with title and buttons
  const overlay = createElement("div", "game-overlay");
  const title = createElement("h3", "game-title", {
    textContent: project.title || "Untitled Project",
  });
  overlay.appendChild(title);
  overlay.appendChild(createButtons(project, "overlay", project.id));

  // Create expanded content
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
  inner.appendChild(createButtons(project, "action", project.id));
  expanded.appendChild(inner);

  card.append(imageContainer, overlay, expanded);
  card.projectData = project;
  return card;
}

function createButtons(project, type, cardId) {
  const container = createElement(
    "div",
    type === "overlay" ? "overlay-buttons" : "action-buttons"
  );

  if (type === "overlay") {
    // Play button
    const playBtn = createElement("button", "btn btn-play", {
      textContent: "Play Demo",
    });
    if (project.demoUrl)
      playBtn.onclick = () => window.open(project.demoUrl, "_blank");

    // Details button
    const detailsBtn = createElement("button", "btn btn-details", {
      textContent: "Details",
    });
    detailsBtn.onclick = (e) => toggleExpand(e, cardId);

    container.append(playBtn, detailsBtn);
  } else {
    // Back button
    const backBtn = createElement("button", "btn btn-back", {
      textContent: "Close",
    });
    backBtn.onclick = (e) => toggleExpand(e, cardId);

    // View project button
    const viewBtn = createElement("button", "btn btn-full-details", {
      textContent: "View Project",
    });
    if (project.githubUrl)
      viewBtn.onclick = () => window.open(project.githubUrl, "_blank");

    container.append(backBtn, viewBtn);
  }

  return container;
}

/**
 * Project card interactions
 */
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
}

/**
 * Initialize project cards
 */
export function initProjectCards() {
  const grid = getPortfolioGrid();
  if (!grid) return;

  renderProjectsGrid(projectCardData);
  getBackdrop(); // Initialize backdrop
}

function renderProjectsGrid(projects) {
  if (!Array.isArray(projects)) return console.warn("Invalid projects data");

  const grid = getPortfolioGrid();
  if (!grid) return;

  grid.innerHTML = "";

  const fragment = document.createDocumentFragment();
  projects.forEach((project) => {
    const card = createProjectCard(project);
    if (card) fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function addNewProject(data) {
  if (!data?.id) return console.warn("Invalid project data") || null;

  const grid = getPortfolioGrid();
  if (!grid) return null;

  const card = createProjectCard(data);
  if (!card) return null;

  grid.appendChild(card);

  // Update 3D scene if using 3D
  if (!isLowPoweredDevice() && scene) {
    loadProjectModel(data.modelName).then((model) => {
      if (model) {
        projectModels.set(data.modelName, model);
        cacheViewWindowPositions();
        positionModelForItem(model, data.modelName);
        renderFrame();
      }
    });
  }

  return data.id;
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
  const modelNames = Array.from(document.querySelectorAll(".portfolio-item"))
    .map((item) => item.getAttribute("data-model"))
    .filter(Boolean);

  // Setup scene components
  calculateModelPositions(modelNames);
  setupMainCamera(canvas);
  cacheViewWindowPositions();
  setupProjects();
  setupInteractions();
  setupResizeObserver();
}

function createMainCanvas() {
  const portfolioSection = getPortfolioSection();
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
    zIndex: "1",
    pointerEvents: "auto",
  });

  canvas.width = portfolioSection.clientWidth || C.DEFAULT_WIDTH;
  canvas.height = portfolioSection.clientHeight || C.DEFAULT_HEIGHT;

  portfolioSection.style.position = "relative";
  portfolioSection.append(canvas);

  return canvas;
}

/**
 * Setup main camera with proper orientation
 */
function setupMainCamera(canvas) {
  projectCamera = new PerspectiveCamera(
    C.DEFAULT_FOV,
    canvas.width / canvas.height,
    C.NEAR,
    C.FAR
  );

  projectCamera.position.set(0, 0, 10); // Changed Y to 0 (was 5)
  projectCamera.lookAt(0, 0, 0);

  // FIXED: Ensure camera up vector is properly aligned
  projectCamera.up.set(0, 1, 0);

  const ctx = canvas.getContext("2d", { alpha: true });
  cameraIndex = registerCamera(projectCamera, ctx);
}

async function setupProjects() {
  const loadPromises = [];

  document.querySelectorAll(".portfolio-item").forEach((item) => {
    const modelName = item.getAttribute("data-model");
    if (!modelName) return;

    const loadPromise = loadProjectModel(modelName)
      .then((model) => {
        if (model) {
          projectModels.set(modelName, model);
          positionModelForItem(model, modelName);
        }
      })
      .catch((err) => console.error(`Failed to load model ${modelName}:`, err));

    loadPromises.push(loadPromise);
  });

  await Promise.all(loadPromises);
  renderFrame();
}

async function loadProjectModel(modelName) {
  if (!modelName) return null;

  try {
    const model = await getModel(modelName);

    if (!model.parent) {
      scene.add(model);
    }

    model.visible = true;
    model.scale.set(0.5, 0.5, 0.5);
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

    // Calculate normalized position (0-1 range)
    const centerX =
      (windowRect.left + windowRect.width / 2 - canvasRect.left) /
      canvasRect.width;
    const centerY =
      (windowRect.top + windowRect.height / 2 - canvasRect.top) /
      canvasRect.height;

    viewWindowPositions.set(modelName, {
      x: centerX * 2 - 1,
      y: -(centerY * 2 - 1), // Convert to ThreeJS Y coordinate system
      width: windowRect.width / canvasRect.width,
      height: windowRect.height / canvasRect.height,
    });
  });
}

/**
 * Position model for a specific item view window
 *
 * @param {Object} model - The 3D model to position
 * @param {String} modelName - Name of the model
 */
function positionModelForItem(model, modelName) {
  if (!model || !modelName) return;

  const viewPos = viewWindowPositions.get(modelName);
  if (!viewPos) {
    console.warn(`No position found for model ${modelName}`);
    return;
  }

  // Calculate suitable z-distance based on model size
  const modelSize = getModelSize(model);
  const zDistance = Math.max(6, modelSize * 5);

  // Convert to world coordinates
  const vector = new Vector3(viewPos.x, viewPos.y, 0.5);
  vector.unproject(projectCamera);
  vector.sub(projectCamera.position).normalize();
  vector.multiplyScalar(zDistance);
  vector.add(projectCamera.position);

  // Position the model - FIXED: Don't use lookAt which causes slant
  model.position.copy(vector);

  // FIXED: Reset rotation to default orientation instead of looking at camera
  // This ensures models maintain consistent orientation in orthographic view
  model.rotation.set(0, 0, 0);

  // For animated models, we can set a slightly different default rotation
  // that looks good in the front-facing orthographic camera
  model.rotation.y = Math.PI; // This rotates to face forward

  // Save original position for animations
  if (!model.userData.originalPosition) {
    model.userData.originalPosition = model.position.clone();
  }

  // Save original rotation as well
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

  // Interaction state
  const interactionState = {
    dragging: false,
    currentModel: null,
    lastX: 0,
    lastY: 0,
    rotationSpeed: { x: 0, y: 0 },
  };

  // Handle window resize
  window.addEventListener("resize", () => {
    if (canvas && projectCamera) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      projectCamera.aspect = canvas.width / canvas.height;
      projectCamera.updateProjectionMatrix();
      cacheViewWindowPositions();
      updateModelPositions();
      renderFrame();
    }
  });

  // Setup drag interaction for model rotation
  setupDragInteraction(canvas, interactionState);

  // Setup card-based drag interaction
  setupCardDragInteraction(interactionState);

  // Setup scroll interaction for model scaling
  setupScrollInteraction();

  // Add reset view button
  const resetButton = createElement("button", "reset-view-btn", {
    textContent: "Reset View",
  });

  Object.assign(resetButton.style, {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    zIndex: "10",
    padding: "8px 16px",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  });

  resetButton.addEventListener("click", resetView);
  const portfolioSection = canvas.parentElement;
  if (portfolioSection) portfolioSection.appendChild(resetButton);
}

/**
 * Setup drag interaction for main canvas
 */
function setupDragInteraction(canvas, state) {
  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return; // Left click only

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
    const y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

    raycaster.setFromCamera({ x, y }, projectCamera);
    const models = Array.from(projectModels.values());
    const intersects = raycaster.intersectObjects(models, true);

    if (intersects.length > 0) {
      // Find the model that was clicked
      let model = intersects[0].object;
      while (model.parent && !projectModels.has(model.userData?.name)) {
        model = model.parent;
      }

      const modelName = model.userData?.name;
      if (modelName) {
        state.dragging = true;
        state.currentModel = projectModels.get(modelName);
        state.lastX = event.clientX;
        state.lastY = event.clientY;

        // Pause automatic rotation
        if (state.currentModel) {
          state.currentModel.userData.animate = false;
        }

        // Add dragging class to cursor
        document.body.style.cursor = "grabbing";
      }
    }
  });

  // Mouse move handler
  window.addEventListener("mousemove", (event) => {
    if (!state.dragging || !state.currentModel) return;

    const model = state.currentModel;
    const deltaX = event.clientX - state.lastX;
    const deltaY = event.clientY - state.lastY;

    // Rotate the model based on mouse movement
    model.rotation.y += deltaX * 0.01;
    model.rotation.x += deltaY * 0.01;

    // Clamp x rotation to avoid flipping
    model.rotation.x = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, model.rotation.x)
    );

    // Update model matrices
    model.updateMatrix();
    model.updateMatrixWorld(true);

    // Store rotation speed for inertia
    state.rotationSpeed.x = deltaY * 0.01;
    state.rotationSpeed.y = deltaX * 0.01;

    // Update last position
    state.lastX = event.clientX;
    state.lastY = event.clientY;

    renderFrame();

    // Mark as dragging to prevent click
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      state.dragging = true;
    }
  });

  // Mouse up handler
  window.addEventListener("mouseup", () => {
    if (state.dragging && state.currentModel) {
      // Apply inertia
      applyRotationInertia(state.currentModel, state.rotationSpeed);
    }

    // Reset state
    state.dragging = false;
    state.currentModel = null;
    document.body.style.cursor = "";
  });

  // Handle mouse leave
  canvas.addEventListener("mouseleave", () => {
    if (state.dragging && state.currentModel) {
      // Apply inertia
      applyRotationInertia(state.currentModel, state.rotationSpeed);

      // Reset state
      state.dragging = false;
      state.currentModel = null;
      document.body.style.cursor = "";
    }
  });
}

/**
 * Setup scroll interaction for model scaling within project cards
 */
function setupScrollInteraction() {
  // Add wheel event listeners to each model view window
  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    viewWindow.addEventListener("wheel", (event) => {
      event.preventDefault(); // Prevent page scrolling

      const model = projectModels.get(modelName);
      if (!model) return;

      // Get scroll direction and calculate scale factor
      const delta = Math.sign(event.deltaY) * -0.05;
      const scaleFactor = 1 + delta;

      // Get current scale
      if (!model.userData.currentScale) {
        model.userData.currentScale = model.scale.clone();
      }

      // Apply scaling with limits
      const newScale = model.userData.currentScale.x * scaleFactor;
      const minScale = 0.3;
      const maxScale = 1.5;

      if (newScale >= minScale && newScale <= maxScale) {
        model.userData.currentScale.set(newScale, newScale, newScale);
        model.scale.copy(model.userData.currentScale);
        model.updateMatrix();
        model.updateMatrixWorld(true);
        renderFrame();
      }
    });
  });
}

/**
 * Setup drag interaction for individual project cards
 */
function setupCardDragInteraction(state) {
  // Add interaction to each model view window
  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    viewWindow.addEventListener("mousedown", (event) => {
      // Don't interfere with click events
      if (event.button !== 0) return;

      const model = projectModels.get(modelName);
      if (model) {
        state.dragging = true;
        state.currentModel = model;
        state.lastX = event.clientX;
        state.lastY = event.clientY;

        // Pause automatic rotation
        model.userData.animate = false;

        // Add dragging class to cursor
        document.body.style.cursor = "grabbing";
        viewWindow.style.cursor = "grabbing";

        // Prevent default to avoid text selection
        event.preventDefault();
      }
    });

    // Mouse move is handled by the global handler

    // Mouse up handler specific to this window
    viewWindow.addEventListener("mouseup", () => {
      if (state.dragging && state.currentModel) {
        // Apply inertia
        applyRotationInertia(state.currentModel, state.rotationSpeed);
      }

      // Reset state
      state.dragging = false;
      state.currentModel = null;
      document.body.style.cursor = "";
      viewWindow.style.cursor = "pointer";
    });

    // Mouse leave handler
    viewWindow.addEventListener("mouseleave", () => {
      if (state.dragging && state.currentModel) {
        // Apply inertia when cursor leaves the window
        applyRotationInertia(state.currentModel, state.rotationSpeed);

        // Reset state
        state.dragging = false;
        state.currentModel = null;
        document.body.style.cursor = "";
        viewWindow.style.cursor = "pointer";
      }
    });
  });
}
/**
 * Apply rotation inertia to model after drag ends
 * FIXED: Constrain rotation to maintain proper alignment
 */
function applyRotationInertia(model, speed) {
  if (!model) return;

  const friction = 0.95; // Friction factor
  let inertiaSpeed = {
    x: speed.x * 0.5,
    y: speed.y * 0.5,
  };

  // Cancel any existing inertia animation
  if (model.userData.inertiaAnimationId) {
    cancelAnimationFrame(model.userData.inertiaAnimationId);
  }

  // Only apply inertia if speed is significant
  if (Math.abs(inertiaSpeed.x) < 0.001 && Math.abs(inertiaSpeed.y) < 0.001) {
    model.userData.animate = true; // Resume automatic rotation
    return;
  }

  function animateInertia() {
    // Apply inertia
    model.rotation.y += inertiaSpeed.y;
    model.rotation.x += inertiaSpeed.x;

    // Clamp x rotation to avoid flipping
    model.rotation.x = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, model.rotation.x)
    );

    // FIXED: Ensure model maintains proper alignment
    // Prevent extreme rotations and keep model upright
    model.rotation.z = 0; // Prevent roll rotation which causes slant

    // Update model matrices
    model.updateMatrix();
    model.updateMatrixWorld(true);

    // Apply friction
    inertiaSpeed.x *= friction;
    inertiaSpeed.y *= friction;

    renderFrame();

    // Continue animation until speed is negligible
    if (
      Math.abs(inertiaSpeed.x) > 0.0001 ||
      Math.abs(inertiaSpeed.y) > 0.0001
    ) {
      model.userData.inertiaAnimationId = requestAnimationFrame(animateInertia);
    } else {
      model.userData.animate = true; // Resume automatic rotation
    }
  }

  // Start inertia animation
  model.userData.inertiaAnimationId = requestAnimationFrame(animateInertia);
}

function setupResizeObserver() {
  if (!window.ResizeObserver) return;

  const observer = new ResizeObserver(() => {
    cacheViewWindowPositions();
    updateModelPositions();
    renderFrame();
  });

  // Observe each item and the grid
  document
    .querySelectorAll(".portfolio-item")
    .forEach((item) => observer.observe(item));

  const grid = getPortfolioGrid();
  if (grid) observer.observe(grid);
}

function updateModelPositions() {
  projectModels.forEach((model, modelName) =>
    positionModelForItem(model, modelName)
  );
}

/**
 * Setup model rotation animations with improved orientation
 */
export function setupModelRotationAnimations() {
  projectModels.forEach((model) => {
    if (!model) return;

    // Store original rotation or set default if not yet defined
    if (!model.userData.originalRotation) {
      // FIXED: Set a rotation that looks good with orthographic camera
      model.rotation.set(0, Math.PI, 0); // Face forward (y-axis rotation)
      model.userData.originalRotation = model.rotation.clone();
    }

    model.userData.animate = true;

    // Set rotation speed with slight randomization for each model
    model.userData.rotationSpeed = 0.003 + Math.random() * 0.004;

    // Add hover info for interactive models
    model.userData.isInteractive = true;
  });
}

/**
 * Animate models with improved orientation
 */
export function animateModels(deltaTime) {
  let needsRender = false;

  projectModels.forEach((model) => {
    if (model?.userData?.animate) {
      // Rotate model if animation is enabled - ONLY around Y axis to prevent slant
      model.rotation.y += model.userData.rotationSpeed * deltaTime;

      // Apply slight oscillation on X axis for more interesting motion
      if (model.userData.oscillate !== false) {
        // Initialize oscillation data if not present
        if (!model.userData.oscillation) {
          model.userData.oscillation = {
            phase: Math.random() * Math.PI * 2, // Random starting phase
            amplitude: 0.02 + Math.random() * 0.03, // FIXED: Reduced amplitude for less extreme motion
            frequency: 0.2 + Math.random() * 0.3, // Different frequency for each model
          };
        }

        const osc = model.userData.oscillation;
        osc.phase += 0.01 * deltaTime;

        // Apply gentle oscillation to X rotation - REDUCED to minimize slant appearance
        model.rotation.x = Math.sin(osc.phase * osc.frequency) * osc.amplitude;

        // FIXED: Ensure Z rotation stays at 0 to prevent unwanted tilt
        model.rotation.z = 0;
      }

      model.updateMatrix();
      model.updateMatrixWorld(true);
      needsRender = true;
    }
  });

  // Only render if models were actually updated
  if (needsRender) {
    renderFrame();
  }

  animationFrameId = requestAnimationFrame(animateModels);
}

function focusOnProject(item) {
  const modelName = item.getAttribute("data-model");
  if (!modelName || !projectModels.has(modelName)) return;

  const model = projectModels.get(modelName);
  currentFocusedProject = modelName;

  // Cancel any ongoing animations
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Animate camera transition
  animateTransition({
    start: projectCamera.position.clone(),
    target: new Vector3(
      model.position.x,
      model.position.y + 1.5,
      model.position.z + 3.5
    ),
    lookAt: model.position.clone(),
    onComplete: setupModelRotationAnimations,
  });

  // Handle model scaling
  projectModels.forEach((m, name) => {
    if (!m.userData.originalScale) {
      m.userData.originalScale = m.scale.clone();
    }

    // Scale selected model up, reset others
    if (name === modelName) {
      m.scale.set(
        m.userData.originalScale.x * 1.5,
        m.userData.originalScale.y * 1.5,
        m.userData.originalScale.z * 1.5
      );
    } else {
      m.scale.copy(m.userData.originalScale);
    }
  });

  // Highlight selected item
  document.querySelectorAll(".portfolio-item").forEach((el) => {
    el.classList.toggle("focused", el === item);
  });

  handleUserInteraction();
}

function resetView() {
  currentFocusedProject = null;

  // Cancel any ongoing animations
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Reset all models to original scale
  projectModels.forEach((model) => {
    if (model.userData.originalScale) {
      model.scale.copy(model.userData.originalScale);
      // Reset the custom scale tracking
      if (model.userData.currentScale) {
        model.userData.currentScale.copy(model.userData.originalScale);
      }
    }
  });

  // Animate camera back to default position
  animateTransition({
    start: projectCamera.position.clone(),
    target: new Vector3(0, 5, 10),
    lookAt: new Vector3(0, 0, 0),
    onComplete: () => {
      cacheViewWindowPositions();
      updateModelPositions();
      setupModelRotationAnimations();
    },
  });

  // Remove highlighting
  document.querySelectorAll(".portfolio-item").forEach((el) => {
    el.classList.remove("focused");
  });

  handleUserInteraction();
}

function animateTransition({ start, target, lookAt, onComplete }) {
  const duration = 1000; // ms
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease function
    const t =
      progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

    projectCamera.position.lerpVectors(start, target, t);
    projectCamera.lookAt(lookAt);
    renderFrame();

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else if (onComplete) {
      onComplete();
    }
  }

  animate();
}

/**
 * Utility function for prefetching
 */
export function getVisibleProjectModels() {
  const visibleModels = new Set();

  document.querySelectorAll(".portfolio-item").forEach((item) => {
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

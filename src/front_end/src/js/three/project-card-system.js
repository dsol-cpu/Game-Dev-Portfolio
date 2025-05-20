import {
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "../extern/three/three.module.min.js";
import { isLowPoweredDevice } from "../utils/device";
import { calculateModelPositions, getModel } from "./model-manager.js";
import { getScene, registerCamera } from "./threejs-manager.js";
import { debounce } from "../utils/helper.js";
import { PROJECT_CARD_DATA } from "../data/projects.js";

const domCache = {};
let scene = null;
let projectCamera = null;
let cameraIndex = -1;
let raycaster = null;
let projectModels = new Map();
let viewWindowPositions = new Map();

function getElement(selector, cacheProp) {
  return (
    domCache[cacheProp] ||
    (domCache[cacheProp] = document.querySelector(selector))
  );
}

function createElement(tag, className, attributes = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attributes).forEach(([key, val]) => {
    if (val == null) return;
    key === "textContent" ? (el.textContent = val) : el.setAttribute(key, val);
  });
  return el;
}

function createButtons(project, buttonType, projectId) {
  const fragment = document.createDocumentFragment();

  if (buttonType === "overlay") {
    const viewBtn = createElement("button", "btn btn-view", {
      textContent: "View Details",
    });
    viewBtn.onclick = (e) => toggleExpand(e, projectId);
    fragment.appendChild(viewBtn);
    return fragment;
  }

  if (buttonType !== "action") return fragment;

  if (project.demoUrl) {
    const demoButton = createElement("a", "btn btn-primary", {
      href: project.demoUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    demoButton.innerHTML = `<svg aria-hidden="true"><use href="#icon-play-btn" /></svg><span>Live Demo</span>`;
    fragment.appendChild(demoButton);
  }

  if (project.githubUrl) {
    const sourceButton = createElement("a", "btn btn-secondary", {
      href: project.githubUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    });

    let iconSvg;
    if (project.githubUrl.includes("github.com")) {
      iconSvg = `<svg aria-hidden="true"><use href="#icon-github" /></svg>`;
    } else if (project.githubUrl.includes("gitlab.com")) {
      iconSvg = `<svg aria-hidden="true"><use href="#icon-gitlab" /></svg>`;
    } else if (project.githubUrl.includes("itch.io")) {
      iconSvg = `<svg aria-hidden="true"><use href="#icon-itch" /></svg>`;
    } else {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    }

    sourceButton.innerHTML = `${iconSvg}<span>Source Code</span>`;
    fragment.appendChild(sourceButton);
  }

  const closeBtn = createElement("button", "btn btn-close-expanded", {
    textContent: "Close",
  });
  closeBtn.onclick = (e) => toggleExpand(e, projectId);
  fragment.appendChild(closeBtn);

  return fragment;
}

function addStaticImage(container, project) {
  if (!project.imageUrl) return;

  const imageElement = createElement("div", "game-image");
  imageElement.style.backgroundImage = `url(${project.imageUrl})`;

  container.appendChild(
    createElement("img", "fallback-image", {
      src: project.imageUrl,
      alt: project.title || "Project image",
      loading: "lazy",
    })
  );

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

  inner.appendChild(createButtons(project, "action", projectId));
  expanded.appendChild(inner);

  return expanded;
}

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

  isLowPower
    ? addStaticImage(imageContainer, project)
    : addModelViewWindow(imageContainer, project);

  const closeBtn = createElement("button", "btn-close", { textContent: "×" });
  closeBtn.onclick = (e) => toggleExpand(e, project.id);
  imageContainer.appendChild(closeBtn);

  const overlay = createElement("div", "game-overlay");
  overlay.appendChild(
    createElement("h3", "game-title", {
      textContent: project.title || "Untitled Project",
    })
  );
  overlay.appendChild(createButtons(project, "overlay", project.id));

  card.append(
    imageContainer,
    overlay,
    createExpandedContent(project, project.id)
  );
  card.projectData = project;
  return card;
}

function toggleExpand(e, id) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const card = document.getElementById(id);
  if (!card) return;

  const expanding = !card.classList.contains("expanded");
  const allCards = document.querySelectorAll(".game-preview.project-card");
  const currentModelName = card.getAttribute("data-model");

  if (expanding) {
    projectModels.forEach((model, modelName) => {
      if (modelName !== currentModelName) {
        model.userData.wasVisible = model.visible;
        model.visible = false;
      }
    });

    if (currentModelName && projectModels.has(currentModelName)) {
      const currentModel = projectModels.get(currentModelName);
      currentModel.visible = true;
      currentModel.userData.preExpandPosition = currentModel.position.clone();

      const viewWindow = card.querySelector(".model-view-window");

      setTimeout(() => {
        cacheViewWindowPositions();
        const viewPos = viewWindowPositions.get(currentModelName);

        if (viewPos) {
          const targetPosition = calculateModelPositionForExpandedCard(
            currentModelName,
            viewWindow
          );
          const enhancedScale = currentModel.userData.initialScale * 1.2;

          animateModelTransition(
            currentModel,
            currentModel.position.clone(),
            targetPosition,
            currentModel.scale.x,
            enhancedScale,
            500
          );
        }
      }, 50);
    }

    allCards.forEach((otherCard) => {
      if (otherCard.id !== id) {
        otherCard.classList.add("hidden-card");
      }
    });

    card.classList.add("expanded", "centered-card");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    if (currentModelName && projectModels.has(currentModelName)) {
      const currentModel = projectModels.get(currentModelName);
      const originalScale = currentModel.userData.initialScale || 1;
      const originalPosition =
        currentModel.userData.preExpandPosition ||
        currentModel.userData.originalPosition ||
        new Vector3(0, 0, 10);

      animateModelTransition(
        currentModel,
        currentModel.position.clone(),
        originalPosition,
        currentModel.scale.x,
        originalScale,
        350
      );
    }

    card.classList.remove("expanded", "centered-card");

    setTimeout(() => {
      allCards.forEach((otherCard) => {
        otherCard.classList.remove("hidden-card");
      });

      projectModels.forEach((model, modelName) => {
        if (model.userData.wasVisible !== undefined) {
          model.visible = model.userData.wasVisible;
          delete model.userData.wasVisible;
        } else {
          model.visible = true;
        }
      });

      setTimeout(updateModelPositions, 150);
    }, 300);
  }

  document.body.classList.toggle("overflow-hidden", expanding);
}

function cubicBezier(x1, y1, x2, y2, t) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t) {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleCurveY(t) {
    return ((ay * t + by) * t + cy) * t;
  }

  function solveCurveX(x) {
    let t2 = x;
    const epsilon = 1e-6;
    let d2, i;

    for (i = 0; i < 8; i++) {
      d2 = sampleCurveX(t2) - x;
      if (Math.abs(d2) < epsilon) return t2;
      let d1 = (3 * ax * t2 + 2 * bx) * t2 + cx;
      if (Math.abs(d1) < 1e-6) break;
      t2 = t2 - d2 / d1;
    }

    let t0 = 0;
    let t1 = 1;
    t2 = x;

    if (t2 < t0) return t0;
    if (t2 > t1) return t1;

    while (t0 < t1) {
      d2 = sampleCurveX(t2);
      if (Math.abs(d2 - x) < epsilon) break;
      if (x > d2) t0 = t2;
      else t1 = t2;
      t2 = (t1 - t0) * 0.5 + t0;
    }

    return t2;
  }

  return sampleCurveY(solveCurveX(t));
}

function animateModelTransition(
  model,
  fromPosition,
  toPosition,
  fromScale,
  toScale,
  duration = 500
) {
  if (!model) return;

  // Cancel any ongoing animation
  if (model.userData.transitionAnimationId) {
    cancelAnimationFrame(model.userData.transitionAnimationId);
  }

  const startTime = performance.now();
  const wasAnimating = model.userData.animate;
  model.userData.animate = false;

  // Pre-compute values that don't change during animation
  const scaleDiff = toScale - fromScale;

  // Use a shared function for animation to reduce memory allocation
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Use pre-computed lookup table for cubic-bezier
    const easedProgress = cubicBezierLookup(progress);

    // Use vector operations directly instead of lerpVectors to avoid object creation
    model.position.x =
      fromPosition.x + (toPosition.x - fromPosition.x) * easedProgress;
    model.position.y =
      fromPosition.y + (toPosition.y - fromPosition.y) * easedProgress;
    model.position.z =
      fromPosition.z + (toPosition.z - fromPosition.z) * easedProgress;

    // Calculate scale only once and reuse
    const currentScale = fromScale + scaleDiff * easedProgress;
    model.scale.set(currentScale, currentScale, currentScale);

    // Only update matrix when needed
    model.matrixWorldNeedsUpdate = true;

    if (progress < 1) {
      model.userData.transitionAnimationId = requestAnimationFrame(animate);
    } else {
      delete model.userData.transitionAnimationId;
      model.userData.animate = wasAnimating;
      model.updateMatrix();
      model.updateMatrixWorld(true);
    }
  }

  model.userData.transitionAnimationId = requestAnimationFrame(animate);
}

const BEZIER_TABLE_SIZE = 100;
const cubicBezierTable = new Float32Array(BEZIER_TABLE_SIZE + 1);

// Initialize the lookup table only once
(function initBezierTable() {
  for (let i = 0; i <= BEZIER_TABLE_SIZE; i++) {
    const t = i / BEZIER_TABLE_SIZE;
    cubicBezierTable[i] = cubicBezier(0.33, 1, 0.68, 1, t);
  }
})();

function cubicBezierLookup(t) {
  // Fast path for common cases
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // Use lookup table with linear interpolation between points
  const index = t * BEZIER_TABLE_SIZE;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.min(lowerIndex + 1, BEZIER_TABLE_SIZE);
  const fraction = index - lowerIndex;

  return (
    cubicBezierTable[lowerIndex] +
    (cubicBezierTable[upperIndex] - cubicBezierTable[lowerIndex]) * fraction
  );
}

function calculateModelPositionForExpandedCard(modelName, viewWindow) {
  if (!viewWindow) return new Vector3(0, 0, 10);

  const card = viewWindow.closest(".project-card");
  if (!card) return new Vector3(0, 0, 10);

  const cardRect = viewWindow.getBoundingClientRect();
  const canvas = domCache.mainCanvas;
  const canvasRect = canvas?.getBoundingClientRect();

  if (!canvasRect) return new Vector3(0, 0, 10);

  const x =
    ((cardRect.left + cardRect.width / 2 - canvasRect.left) /
      canvasRect.width) *
      2 -
    1;
  const y = -(
    ((cardRect.top + cardRect.height / 2 - canvasRect.top) /
      canvasRect.height) *
      2 -
    1
  );

  const vector = new Vector3(x, y, 0.5);
  vector.unproject(projectCamera);
  vector.sub(projectCamera.position).normalize();

  const zDistance = 7;
  vector.multiplyScalar(zDistance);
  vector.add(projectCamera.position);

  return vector;
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
  return 2;
}

function positionModelForItem(model, modelName) {
  if (!model || !modelName) return;

  const viewPos = viewWindowPositions.get(modelName);
  if (!viewPos) return;

  const modelSize = getModelSize(model);
  const containerScale = Math.min(viewPos.width, viewPos.height) * 7;
  const finalScale = Math.min(0.15, (containerScale / modelSize) * 0.15);

  model.scale.set(finalScale, finalScale, finalScale);

  if (!model.userData.initialScale) {
    model.userData.initialScale = finalScale;
    model.userData.currentScale = model.scale.clone();
  }

  const zDistance = Math.max(6, modelSize * 3);
  const vector = new Vector3(viewPos.x, viewPos.y, 0.5);
  vector.unproject(projectCamera);
  vector.sub(projectCamera.position).normalize();
  vector.multiplyScalar(zDistance);
  vector.add(projectCamera.position);

  model.position.copy(vector);

  if (model.userData.originalRotation) {
    model.rotation.copy(model.userData.originalRotation);
  } else {
    model.rotation.set(0, Math.PI, 0);
    model.userData.originalRotation = model.rotation.clone();
  }

  if (!model.userData.originalPosition) {
    model.userData.originalPosition = model.position.clone();
  }

  model.updateMatrix();
  model.updateMatrixWorld(true);
}

function updateModelPositions() {
  cacheViewWindowPositions();

  projectModels.forEach((model, modelName) => {
    if (model.userData.transitionAnimationId) return;

    const card = document.querySelector(
      `.project-card[data-model="${modelName}"]`
    );
    if (!card) return;

    const isExpanded = card.classList.contains("expanded");
    const viewPos = viewWindowPositions.get(modelName);
    if (!viewPos) return;

    if (isExpanded) {
      const viewWindow = card.querySelector(".model-view-window");
      if (viewWindow) {
        const targetPosition = calculateModelPositionForExpandedCard(
          modelName,
          viewWindow
        );
        const enhancedScale = model.userData.initialScale * 1.2;

        if (model.position.distanceTo(targetPosition) > 0.1) {
          animateModelTransition(
            model,
            model.position.clone(),
            targetPosition,
            model.scale.x,
            enhancedScale,
            350
          );
        }
      }
    } else {
      positionModelForItem(model, modelName);
    }
  });
}

function cacheViewWindowPositions() {
  const windows = document.querySelectorAll(".model-view-window");
  const canvas = domCache.mainCanvas;
  const canvasRect = canvas?.getBoundingClientRect();

  if (!canvasRect) return;

  // Don't clear and recreate map - update existing entries
  const newModelNames = new Set();

  // Pre-calculate canvas dimensions for faster calculations
  const canvasWidth = canvasRect.width;
  const canvasHeight = canvasRect.height;
  const canvasLeft = canvasRect.left;
  const canvasTop = canvasRect.top;
  const invCanvasWidth = 2 / canvasWidth;
  const invCanvasHeight = 2 / canvasHeight;

  windows.forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    newModelNames.add(modelName);
    const windowRect = viewWindow.getBoundingClientRect();

    // Calculate center points and dimensions only once
    const centerX = windowRect.left + windowRect.width / 2 - canvasLeft;
    const centerY = windowRect.top + windowRect.height / 2 - canvasTop;

    // Faster coordinate calculations
    const x = centerX * invCanvasWidth - 1;
    const y = -(centerY * invCanvasHeight - 1);

    // Reuse existing position object if available
    let position = viewWindowPositions.get(modelName);
    if (position) {
      position.x = x;
      position.y = y;
      position.width = windowRect.width / canvasWidth;
      position.height = windowRect.height / canvasHeight;
      position.pixelWidth = windowRect.width;
      position.pixelHeight = windowRect.height;
      position.rect = windowRect;
    } else {
      viewWindowPositions.set(modelName, {
        x,
        y,
        width: windowRect.width / canvasWidth,
        height: windowRect.height / canvasHeight,
        pixelWidth: windowRect.width,
        pixelHeight: windowRect.height,
        rect: windowRect,
      });
    }
  });

  // Remove positions for models that no longer exist
  for (const modelName of viewWindowPositions.keys()) {
    if (!newModelNames.has(modelName)) {
      viewWindowPositions.delete(modelName);
    }
  }
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

function handleDragStart(e, modelName, clientX, clientY, state, viewWindow) {
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

function handleDragMove(clientX, clientY, state) {
  if (!state.active || !state.model) return;

  const model = state.model;
  const deltaX = clientX - state.lastX;

  // Apply rotation directly without unnecessary calculations
  model.rotation.y += deltaX * 0.01;

  // Keep other rotations fixed to avoid unnecessary calculations
  if (model.rotation.x !== 0) model.rotation.x = 0;
  if (model.rotation.z !== 0) model.rotation.z = 0;

  // Mark matrix for update rather than updating immediately
  model.matrixWorldNeedsUpdate = true;

  // Store rotation speed for inertia calculations
  state.rotationSpeed.y = deltaX * 0.01;
  state.lastX = clientX;
  state.lastY = clientY;

  // Throttle actual matrix updates to once per frame
  if (!state.pendingMatrixUpdate) {
    state.pendingMatrixUpdate = true;
    requestAnimationFrame(() => {
      if (state.model) {
        state.model.updateMatrix();
        state.model.updateMatrixWorld(true);
      }
      state.pendingMatrixUpdate = false;
    });
  }
}

function handleDragEnd(state, viewWindow) {
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

  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    viewWindow.addEventListener(
      "mousedown",
      (e) => {
        if (e.button !== 0) return;
        handleDragStart(
          e,
          modelName,
          e.clientX,
          e.clientY,
          dragState,
          viewWindow
        );
      },
      { passive: true }
    );

    viewWindow.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        handleDragStart(
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
        handleDragMove(touch.clientX, touch.clientY, dragState);
      },
      { passive: true }
    );

    viewWindow.addEventListener(
      "touchend",
      () => handleDragEnd(dragState, viewWindow),
      { passive: true }
    );
    viewWindow.addEventListener(
      "touchcancel",
      () => handleDragEnd(dragState, viewWindow),
      { passive: true }
    );
  });

  window.addEventListener(
    "mousemove",
    (e) => {
      if (dragState.active) handleDragMove(e.clientX, e.clientY, dragState);
    },
    { passive: true }
  );

  window.addEventListener(
    "mouseup",
    () => {
      if (dragState.active) handleDragEnd(dragState);
    },
    { passive: true }
  );
}

function setupScrollInteraction() {
  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    viewWindow.style.overscrollBehavior = "none";

    viewWindow.addEventListener(
      "wheel",
      (event) => {
        const projectCard = viewWindow.closest(".project-card");
        if (!projectCard?.classList.contains("expanded")) return;

        event.preventDefault();
        event.stopPropagation();

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
      { passive: false }
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

let resizeRAFPending = false;
function handleResize() {
  if (resizeRAFPending) return;

  resizeRAFPending = true;
  requestAnimationFrame(() => {
    const canvas = domCache.mainCanvas;
    if (!canvas || !projectCamera) return;

    // Only resize if dimensions actually changed
    if (
      canvas.width !== canvas.clientWidth ||
      canvas.height !== canvas.clientHeight
    ) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      projectCamera.aspect = canvas.width / canvas.height;
      projectCamera.updateProjectionMatrix();
    }

    cacheViewWindowPositions();
    updateModelPositions();
    resizeRAFPending = false;
  });
}

function setupKeyboardSupport() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const expandedCard = document.querySelector(".game-preview.expanded");
      if (expandedCard) toggleExpand(null, expandedCard.id);
    }
  });
}

function enhanceProjectCards() {
  setupKeyboardSupport();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.attributeName === "class" &&
        mutation.target.classList.contains("project-card")
      ) {
        setTimeout(updateModelPositions, 100);
      }
    });
  });

  document.querySelectorAll(".project-card").forEach((card) => {
    observer.observe(card, { attributes: true });
  });
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
  enhanceProjectCards();
}

function setupInteractions() {
  const canvas = domCache.mainCanvas;
  if (!canvas) return;

  window.addEventListener("resize", debounce(handleResize, 100));
  setupDragInteraction();
  setupScrollInteraction();
  setupResizeObserver();
}

export function initProjectCards() {
  const grid = getElement(".project-card-grid", "portfolioGrid");
  if (!Array.isArray(PROJECT_CARD_DATA)) return;

  const fragment = document.createDocumentFragment();
  PROJECT_CARD_DATA.forEach((project) => {
    const card = createProjectCard(project);
    if (card) fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

export function initProjectCardScene() {
  if (isLowPoweredDevice()) return;

  scene = getScene();
  raycaster = new Raycaster();

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

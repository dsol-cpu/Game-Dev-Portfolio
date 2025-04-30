/**
 * @fileoverview Optimized project card creation and management functionality.
 */

import { projectCardData } from "./data/project";
import { detectLowEndDevice } from "./utils/device";

const domCache = {
  portfolioGrid: null,
  backdrop: null,
};

function initProjectCards() {
  const portfolioGrid = document.querySelector(".portfolio-grid");
  if (!portfolioGrid) return;
  renderProjectsGrid(projectCardData);
}

function createElement(tag, className, attributes = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attributes).forEach(([key, val]) => {
    if (val != null) el.setAttribute(key, val);
  });
  return el;
}

function createTagElements(tags = []) {
  const fragment = document.createDocumentFragment();
  for (const tag of tags) {
    const el = createElement("span", "project-tag");
    el.textContent = tag;
    fragment.appendChild(el);
  }
  return fragment;
}

function createDescriptionElements(shortDesc, fullDesc = []) {
  const fragment = document.createDocumentFragment();
  if (shortDesc) {
    const p = createElement("p", "project-description");
    p.textContent = shortDesc;
    fragment.appendChild(p);
  }
  for (const paragraph of fullDesc) {
    if (!paragraph) continue;
    const p = createElement("p", "project-description");
    p.textContent = paragraph;
    fragment.appendChild(p);
  }
  return fragment;
}

function createOverlayButtons(project, cardId) {
  const container = createElement("div", "overlay-buttons");

  const playBtn = createElement("button", "btn btn-play");
  playBtn.textContent = "Play Demo";
  if (project.demoUrl)
    playBtn.onclick = () => window.open(project.demoUrl, "_blank");

  const detailsBtn = createElement("button", "btn btn-details");
  detailsBtn.textContent = "Details";
  detailsBtn.onclick = (e) => toggleExpand(e, cardId);

  container.append(playBtn, detailsBtn);
  return container;
}

function createActionButtons(project, cardId) {
  const container = createElement("div", "action-buttons");

  const backBtn = createElement("button", "btn btn-back");
  backBtn.textContent = "Close";
  backBtn.onclick = (e) => toggleExpand(e, cardId);

  const viewBtn = createElement("button", "btn btn-full-details");
  viewBtn.textContent = "View Project";
  if (project.githubUrl)
    viewBtn.onclick = () => window.open(project.githubUrl, "_blank");

  container.append(backBtn, viewBtn);
  return container;
}

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

  const isLowEndDevice = detectLowEndDevice();

  if (isLowEndDevice) {
    // Add background image and img element for low-end devices
    const imageElement = createElement("div", "game-image");
    if (project.imageUrl)
      imageElement.style.backgroundImage = `url(${project.imageUrl})`;

    imageContainer.appendChild(imageElement);

    if (project.imageUrl) {
      const fallbackImg = createElement("img", "fallback-image", {
        src: project.imageUrl,
        alt: project.title || "Project image",
        loading: "lazy",
      });
      imageContainer.appendChild(fallbackImg);
    }
  } else {
    // Add canvas for 3D visualization for capable devices - no image
    const canvas = createElement("canvas", "threejs-canvas", {
      width: 300,
      height: 200,
    });
    canvas.style.cursor = "grab";
    canvas.onmousedown = () => (canvas.style.cursor = "grabbing");
    canvas.onmouseup = canvas.onmouseleave = () =>
      (canvas.style.cursor = "grab");
    imageContainer.appendChild(canvas);
  }

  const closeBtn = createElement("button", "btn-close");
  closeBtn.textContent = "×";
  closeBtn.onclick = (e) => toggleExpand(e, project.id);

  imageContainer.appendChild(closeBtn);

  const overlay = createElement("div", "game-overlay");
  const title = createElement("h3", "game-title");
  title.textContent = project.title || "Untitled Project";
  overlay.append(title, createOverlayButtons(project, project.id));

  const expanded = createElement("div", "expanded-content");
  const inner = createElement("div", "expanded-content-inner");

  inner.append(
    createElement("h2", "card-title", {
      textContent: project.title || "Untitled Project",
    }),
    createElement("div", "project-tags").appendChild(
      createTagElements(project.tags)
    ),
    createDescriptionElements(
      project.shortDescription,
      project.fullDescription
    ),
    createActionButtons(project, project.id)
  );
  expanded.appendChild(inner);

  card.append(imageContainer, overlay, expanded);
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

  // Collapse all other expanded cards
  document.querySelectorAll(".game-preview.expanded").forEach((el) => {
    if (el.id !== id) el.classList.remove("expanded", "expand-left");
  });

  // Apply expand class
  card.classList.toggle("expanded", expanding);

  if (expanding) {
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    if (rect.right + 160 > viewportWidth) {
      card.classList.add("expand-left");
    } else {
      card.classList.remove("expand-left");
    }
  } else {
    card.classList.remove("expand-left");
  }

  // Handle backdrop
  const backdrop = getBackdrop();
  if (backdrop) backdrop.classList.toggle("active", expanding);

  document.body.classList.toggle("overflow-hidden", expanding);
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
  if (domCache.portfolioGrid) return domCache.portfolioGrid;
  const grid = document.querySelector(".portfolio-grid");
  if (grid) domCache.portfolioGrid = grid;
  else console.warn("Portfolio grid not found");
  return grid;
}

function renderProjectsGrid(projects) {
  if (!Array.isArray(projects)) return console.warn("Invalid projects data");

  const grid = getPortfolioGrid();
  if (!grid) return;

  grid.innerHTML = "";
  getBackdrop();

  const fragment = document.createDocumentFragment();
  for (const project of projects) {
    const card = createProjectCard(project);
    if (card) fragment.appendChild(card);
  }
  grid.appendChild(fragment);

  // Only initialize canvases if not a low-end device
  if (!detectLowEndDevice()) {
    initializeAllCanvases(grid);
  }
}

function initializeAllCanvases(container) {
  if (!container) return;
  const canvases = container.querySelectorAll(".threejs-canvas");
  for (const canvas of canvases) {
    const card = canvas.closest(".portfolio-item");
    if (card?.projectData) initThreeJsCanvas(canvas, card.projectData);
  }
}

function initThreeJsCanvas(canvas, data) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  canvas.setAttribute("data-needs-init", "true");
  canvas.setAttribute("data-project-id", data.id || "");
  document.dispatchEvent(
    new CustomEvent("canvasCreated", {
      detail: {
        canvasId: canvas.id || canvas.parentElement?.id || "",
        projectId: data.id || "",
      },
    })
  );
}

function addNewProject(data) {
  if (!data?.id) return console.warn("Invalid project data") || null;
  const grid = getPortfolioGrid();
  if (!grid) return null;
  const card = createProjectCard(data);
  if (!card) return null;
  grid.appendChild(card);

  // Only initialize the canvas if not a low-end device
  if (!detectLowEndDevice()) {
    const canvas = card.querySelector(".threejs-canvas");
    if (canvas) initThreeJsCanvas(canvas, data);
  }
  return data.id;
}

function setupBackdropListener() {
  getBackdrop();
}

export { initProjectCards, setupBackdropListener };

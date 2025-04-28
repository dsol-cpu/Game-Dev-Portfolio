/**
 * @fileoverview Project card creation and management functionality.
 * Handles creation, display, and interaction with project cards.
 * @version 1.1.0
 */

// DOM element cache
const domCache = {
  portfolioGrid: null,
  backdrop: null,
};

/**
 * @param {string} tag - HTML tag name
 * @param {string} className - CSS class names
 * @param {Object} attributes - HTML attributes
 * @returns {HTMLElement} The created element
 */
function createElement(tag, className, attributes = {}) {
  const element = document.createElement(tag);

  if (className) element.className = className;

  for (const key in attributes) {
    if (attributes[key] != null) {
      element.setAttribute(key, attributes[key]);
    }
  }

  return element;
}

/**
 * Creates a project card element from project data
 * @param {Object} project - Project data object
 * @returns {HTMLElement|null} The created card element or null if invalid input
 */
function createProjectCard(project) {
  if (!project?.id) return null;

  // Use the project's hardcoded ID
  const cardId = project.id;

  // Create the card element with the project's ID
  const cardElement = createElement("div", "game-preview portfolio-item", {
    id: cardId,
    "data-category":
      project.category || (project.tags?.[0] || "").toLowerCase(),
    "data-model": project.modelName || "",
  });

  // Create image container
  const imageContainer = createElement(
    "div",
    "game-image-container portfolio-canvas"
  );

  // Create canvas with fixed dimensions
  const canvasElement = createElement("canvas", "threejs-canvas", {
    width: 300,
    height: 200,
  });

  // Add cursor styles directly to canvas element
  canvasElement.style.cursor = "grab";

  // Use event delegation for cursor interaction
  const handleMouseDown = () => (canvasElement.style.cursor = "grabbing");
  const handleMouseUp = () => (canvasElement.style.cursor = "grab");

  canvasElement.addEventListener("mousedown", handleMouseDown);
  canvasElement.addEventListener("mouseup", handleMouseUp);
  canvasElement.addEventListener("mouseleave", handleMouseUp);

  // Create image element
  const imageElement = createElement("div", "game-image");
  if (project.imageUrl) {
    imageElement.style.backgroundImage = `url(${project.imageUrl})`;
  }

  // Create close button
  const closeButton = createElement("button", "btn-close");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", (e) => toggleExpand(e, cardId));

  // Create overlay
  const overlayElement = createElement("div", "game-overlay");

  // Create title
  const titleElement = createElement("h3", "game-title");
  titleElement.textContent = project.title || "Untitled Project";

  // Create buttons container
  const overlayButtons = createElement("div", "overlay-buttons");

  // Create play button
  const playButton = createElement("button", "btn btn-play");
  playButton.textContent = "Play Demo";
  if (project.demoUrl) {
    playButton.addEventListener("click", () =>
      window.open(project.demoUrl, "_blank")
    );
  }

  // Create details button
  const detailsButton = createElement("button", "btn btn-details");
  detailsButton.textContent = "Details";
  detailsButton.addEventListener("click", (e) => toggleExpand(e, cardId));

  // Create expanded content
  const expandedContent = createElement("div", "expanded-content");
  const expandedContentInner = createElement("div", "expanded-content-inner");

  // Create card title
  const cardTitle = createElement("h2", "card-title");
  cardTitle.textContent = project.title || "Untitled Project";

  // Create tags container
  const tagsContainer = createElement("div", "project-tags");

  // Add tags if available
  if (project.tags?.length) {
    // Create all tags at once with a document fragment
    const tagsFragment = document.createDocumentFragment();
    for (let i = 0; i < project.tags.length; i++) {
      const tagElement = createElement("span", "project-tag");
      tagElement.textContent = project.tags[i];
      tagsFragment.appendChild(tagElement);
    }
    tagsContainer.appendChild(tagsFragment);
  }

  // Create description fragment
  const descFragment = document.createDocumentFragment();

  // Add short description if available
  if (project.shortDescription) {
    const p = createElement("p", "project-description");
    p.textContent = project.shortDescription;
    descFragment.appendChild(p);
  }

  // Add full description paragraphs if available
  if (project.fullDescription?.length) {
    for (let i = 0; i < project.fullDescription.length; i++) {
      const paragraph = project.fullDescription[i];
      if (!paragraph) continue;

      const p = createElement("p", "project-description");
      p.textContent = paragraph;
      descFragment.appendChild(p);
    }
  }

  // Create action buttons
  const actionButtons = createElement("div", "action-buttons");

  // Create back button
  const backButton = createElement("button", "btn btn-back");
  backButton.textContent = "Close";
  backButton.addEventListener("click", (e) => toggleExpand(e, cardId));

  // Create view project button
  const viewProjectButton = createElement("button", "btn btn-full-details");
  viewProjectButton.textContent = "View Project";
  if (project.githubUrl) {
    viewProjectButton.addEventListener("click", () =>
      window.open(project.githubUrl, "_blank")
    );
  }

  // Assemble components
  imageContainer.append(canvasElement, imageElement, closeButton);

  overlayButtons.append(playButton, detailsButton);
  overlayElement.append(titleElement, overlayButtons);

  expandedContentInner.appendChild(cardTitle);
  expandedContentInner.appendChild(tagsContainer);
  expandedContentInner.appendChild(descFragment);

  actionButtons.append(backButton, viewProjectButton);
  expandedContentInner.appendChild(actionButtons);

  expandedContent.appendChild(expandedContentInner);

  cardElement.append(imageContainer, overlayElement, expandedContent);

  // Store original project data for reference
  cardElement.projectData = project;

  return cardElement;
}

/**
 * Toggle expanded state of a card
 * @param {Event} event - The triggering event
 * @param {string} projectId - ID of the project card to toggle
 */
function toggleExpand(event, projectId) {
  if (!projectId) return;

  // Stop event propagation
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Get project card element
  const projectCard = document.getElementById(projectId);
  if (!projectCard) return;

  // Check if we're expanding
  const isExpanding = !projectCard.classList.contains("expanded");

  // Collapse other expanded cards
  if (isExpanding) {
    const expandedCards = document.querySelectorAll(".game-preview.expanded");
    for (let i = 0; i < expandedCards.length; i++) {
      if (expandedCards[i].id !== projectId) {
        expandedCards[i].classList.remove("expanded");
      }
    }

    // Add expand-left class
    projectCard.classList.add("expand-left");
  } else {
    // Remove expand-left class when collapsing
    projectCard.classList.remove("expand-left");
  }

  // Toggle expanded class
  projectCard.classList.toggle("expanded", isExpanding);

  // Handle backdrop
  const backdrop = getBackdrop();
  if (backdrop) {
    backdrop.classList.toggle("active", isExpanding);
  }

  // Toggle body overflow
  document.body.classList.toggle("overflow-hidden", isExpanding);
}

/**
 * Get or create the backdrop element
 * @returns {HTMLElement} The backdrop element
 */
function getBackdrop() {
  // Use cached element if available
  if (domCache.backdrop) {
    return domCache.backdrop;
  }

  // Check if backdrop exists in DOM
  let backdrop = document.querySelector(".backdrop");

  // Create backdrop if needed
  if (!backdrop) {
    backdrop = createElement("div", "backdrop");
    backdrop.addEventListener("click", closeOnBackdropClick);
    document.body.appendChild(backdrop);
  }

  // Cache for future use
  domCache.backdrop = backdrop;

  return backdrop;
}

/**
 * Close expanded card when clicking on backdrop
 * @param {Event} event - The click event
 */
function closeOnBackdropClick(event) {
  const expandedCard = document.querySelector(".game-preview.expanded");
  if (expandedCard) {
    toggleExpand(event, expandedCard.id);
  }
}

/**
 * Get the portfolio grid element
 * @returns {HTMLElement} The portfolio grid element
 */
function getPortfolioGrid() {
  // Use cached element if available
  if (domCache.portfolioGrid) {
    return domCache.portfolioGrid;
  }

  // Get element from DOM
  const grid = document.querySelector(".portfolio-grid");

  // Cache for future use
  if (grid) {
    domCache.portfolioGrid = grid;
  }
  console.warn("Portfolio grid not found");

  return grid;
}

/**
 * Render all projects into the grid
 * @param {Array} projectsData - Array of project data objects
 */
function renderProjectsGrid(projectsData) {
  if (!Array.isArray(projectsData)) {
    console.warn("Invalid projects data format");
    return;
  }

  // Get portfolio grid
  const portfolioGrid = getPortfolioGrid();
  if (!portfolioGrid) {
    console.warn("Portfolio grid not found");
    return;
  }

  // Clear existing content
  portfolioGrid.innerHTML = "";

  // Ensure backdrop exists
  getBackdrop();

  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment();

  // Create card elements
  for (let i = 0; i < projectsData.length; i++) {
    const cardElement = createProjectCard(projectsData[i]);
    if (cardElement) {
      fragment.appendChild(cardElement);
    }
  }

  // Single DOM operation to add all cards
  portfolioGrid.appendChild(fragment);

  // Initialize Three.js for all cards
  initializeAllCanvases(portfolioGrid);
}

/**
 * Initialize all canvas elements in container
 * @param {HTMLElement} container - Container element
 */
function initializeAllCanvases(container) {
  if (!container) return;

  const canvases = container.querySelectorAll(".threejs-canvas");

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const card = canvas.closest(".portfolio-item");

    if (card?.projectData) {
      initThreeJsCanvas(canvas, card.projectData);
    }
  }
}

/**
 * Initialize Three.js scene for a project card
 * @param {HTMLElement} canvas - The canvas element to initialize
 * @param {Object} projectData - Project data for customizing the scene
 */
function initThreeJsCanvas(canvas, projectData) {
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  // Set data attributes for initialization
  canvas.setAttribute("data-needs-init", "true");
  canvas.setAttribute("data-project-id", projectData.id || "");

  // Dispatch event for main.js to handle
  const event = new CustomEvent("canvasCreated", {
    detail: {
      canvasId: canvas.id || canvas.parentElement?.id || "",
      projectId: projectData.id || "",
    },
  });

  document.dispatchEvent(event);
}

/**
 * Add a new project card dynamically to the grid
 * @param {Object} projectData - Project data object
 * @returns {string|null} The project ID or null if failed
 */
function addNewProject(projectData) {
  if (!projectData?.id) {
    console.warn("Invalid project data - must include ID");
    return null;
  }

  // Get portfolio grid
  const portfolioGrid = getPortfolioGrid();
  if (!portfolioGrid) return null;

  // Create card element
  const cardElement = createProjectCard(projectData);
  if (!cardElement) return null;

  // Add card to grid
  portfolioGrid.appendChild(cardElement);

  // Get the canvas element
  const canvas = cardElement.querySelector(".threejs-canvas");
  if (canvas) initThreeJsCanvas(canvas, projectData);

  return projectData.id;
}

/**
 * Setup backdrop listener for closing expanded cards
 */
function setupBackdropListener() {
  getBackdrop();
}

// Export functions
export {
  createProjectCard,
  toggleExpand,
  closeOnBackdropClick,
  setupBackdropListener,
  addNewProject,
  renderProjectsGrid,
  initThreeJsCanvas,
};

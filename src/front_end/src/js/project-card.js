/**
 * @fileoverview Project card creation and management functionality.
 * Handles creation, display, and interaction with project cards.
 * @author Portfolio Developer
 * @version 1.0.0
 */

// Create elements efficiently with a helper function
function createElement(tag, className, attributes = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;

  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) {
      element.setAttribute(key, value);
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

  // Create main wrapper with BOTH classes to maintain compatibility
  const cardElement = createElement("div", "game-preview portfolio-item", {
    id: project.id,
    "data-category": project.category || project.tags?.[0]?.toLowerCase() || "",
    "data-model": project.modelName || "",
  });

  // Create image container
  const imageContainer = createElement(
    "div",
    "game-image-container portfolio-canvas"
  );

  // Add Three.js canvas - make sure it has the right dimensions and cursor styles
  const canvasElement = createElement("canvas", "threejs-canvas", {
    width: 300,
    height: 200,
  });

  // Add cursor styles to canvas element
  canvasElement.style.cursor = "grab"; // Default to grab cursor on hover

  // Add event listeners for cursor changes
  canvasElement.addEventListener("mousedown", () => {
    canvasElement.style.cursor = "grabbing"; // Change to grabbing when clicking
  });

  canvasElement.addEventListener("mouseup", () => {
    canvasElement.style.cursor = "grab"; // Change back to grab when releasing
  });

  canvasElement.addEventListener("mouseleave", () => {
    canvasElement.style.cursor = "grab"; // Ensure it resets if mouse leaves while down
  });

  // The rest of your function remains the same...
  // Create image element
  const imageElement = createElement("div", "game-image");
  if (project.imageUrl)
    imageElement.style.backgroundImage = `url(${project.imageUrl})`;

  // Create close button
  const closeButton = createElement("button", "btn-close");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", (e) => toggleExpand(e, project.id));

  // Build overlay elements - appears on hover
  const overlayElement = createElement("div", "game-overlay");

  const titleElement = createElement("h3", "game-title");
  titleElement.textContent = project.title;

  // Create overlay buttons
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
  detailsButton.addEventListener("click", (e) => toggleExpand(e, project.id));

  // Build expanded content - appears when Details is clicked
  const expandedContent = createElement("div", "expanded-content");
  const expandedContentInner = createElement("div", "expanded-content-inner");

  const cardTitle = createElement("h2", "card-title");
  cardTitle.textContent = project.title;

  // Create tags container
  const tagsContainer = createElement("div", "project-tags");
  if (project.tags?.length) {
    const tagsFragment = document.createDocumentFragment();
    project.tags.forEach((tag) => {
      const tagElement = createElement("span", "project-tag");
      tagElement.textContent = tag;
      tagsFragment.appendChild(tagElement);
    });
    tagsContainer.appendChild(tagsFragment);
  }

  // Create description paragraphs
  const descFragment = document.createDocumentFragment();

  // Add short description as first paragraph
  if (project.shortDescription) {
    const p = createElement("p", "project-description");
    p.textContent = project.shortDescription;
    descFragment.appendChild(p);
  }

  // Add additional paragraphs from full description
  if (project.fullDescription?.length) {
    project.fullDescription.forEach((paragraph) => {
      if (!paragraph) return;
      const p = createElement("p", "project-description");
      p.textContent = paragraph;
      descFragment.appendChild(p);
    });
  }

  // Action buttons
  const actionButtons = createElement("div", "action-buttons");

  const backButton = createElement("button", "btn btn-back");
  backButton.textContent = "Close";
  backButton.addEventListener("click", (e) => toggleExpand(e, project.id));

  const viewProjectButton = createElement("button", "btn btn-full-details");
  viewProjectButton.textContent = "View Project";
  if (project.githubUrl) {
    viewProjectButton.addEventListener("click", () =>
      window.open(project.githubUrl, "_blank")
    );
  }

  // Add Three.js canvas and image element to image container
  imageContainer.append(canvasElement, imageElement, closeButton);

  // Add title and buttons to overlay
  overlayButtons.append(playButton, detailsButton);
  overlayElement.append(titleElement, overlayButtons);

  // Add all elements to expanded content inner
  expandedContentInner.appendChild(cardTitle);
  expandedContentInner.appendChild(tagsContainer);
  expandedContentInner.appendChild(descFragment);

  // Add buttons to action buttons container
  actionButtons.append(backButton, viewProjectButton);
  expandedContentInner.appendChild(actionButtons);

  // Add inner content to expanded content
  expandedContent.appendChild(expandedContentInner);

  // Add all main sections to card element in order
  cardElement.append(imageContainer, overlayElement, expandedContent);

  return cardElement;
}
/**
 * Toggle expanded state of a card
 * @param {Event} event - The triggering event
 * @param {string} projectId - ID of the project card to toggle
 */
function toggleExpand(event, projectId) {
  // Early returns
  if (!projectId) return;

  // Stop event propagation if it exists
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Find the card element
  const projectCard = document.getElementById(projectId);
  if (!projectCard) {
    console.warn(`Card with ID ${projectId} not found`);
    return;
  }

  // Use classList.toggle for better performance
  const isExpanding = !projectCard.classList.contains("expanded");

  // If expanding, first close any other expanded cards
  if (isExpanding) {
    const expandedCards = document.querySelectorAll(".game-preview.expanded");
    expandedCards.forEach((card) => {
      if (card.id !== projectId) {
        card.classList.remove("expanded");
      }
    });

    // Check if card is near the right edge of the viewport
    const cardRect = projectCard.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const expandedWidth = 500; // Match the CSS width for expanded cards

    // Calculate if there's enough space to the right
    const spaceToRight = viewportWidth - cardRect.right;

    if (spaceToRight < expandedWidth - cardRect.width) {
      // Not enough space to the right, adjust position
      // Add a class to handle this case
      projectCard.classList.add("expand-left");

      // Calculate how much to adjust
      const overflowAmount = expandedWidth - cardRect.width - spaceToRight;

      // Apply inline style to shift left
      projectCard.style.transform = `translateX(-${overflowAmount}px)`;
    } else {
      // Enough space to right, expand normally
      projectCard.classList.remove("expand-left");
      projectCard.style.transform = "";
    }
  } else {
    // When closing, reset any positioning
    projectCard.classList.remove("expand-left");
    projectCard.style.transform = "";
  }

  // Toggle expanded class
  projectCard.classList.toggle("expanded");

  // Toggle backdrop
  const backdrop = document.querySelector(".backdrop");
  if (backdrop) {
    backdrop.classList.toggle("active", isExpanding);
  }

  // Set overflow on body
  document.body.style.overflow = isExpanding ? "hidden" : "";
}

/**
 * Close expanded card when clicking on backdrop
 * @param {Event} event - The click event
 */
function closeOnBackdropClick(event) {
  const expandedCard = document.querySelector(".game-preview.expanded");
  if (expandedCard) toggleExpand(event, expandedCard.id);
}

/**
 * Setup backdrop listener for closing expanded cards
 */
function setupBackdropListener() {
  let backdrop = document.querySelector(".backdrop");
  if (!backdrop) {
    // Create backdrop if it doesn't exist
    backdrop = createElement("div", "backdrop");
    backdrop.addEventListener("click", closeOnBackdropClick);
    document.body.appendChild(backdrop);
  } else {
    // Ensure event listener is attached
    backdrop.removeEventListener("click", closeOnBackdropClick);
    backdrop.addEventListener("click", closeOnBackdropClick);
  }
}

/**
 * Render all projects into the grid
 * @param {Array} projectsData - Array of project data objects
 */
function renderProjectsGrid(projectsData) {
  if (!projectsData || !Array.isArray(projectsData)) {
    console.warn("No valid project data provided");
    return;
  }

  const portfolioGrid = document.querySelector(".portfolio-grid");
  if (!portfolioGrid) {
    console.warn("Portfolio grid container not found");
    return;
  }

  // Clear existing content
  portfolioGrid.innerHTML = "";

  // Ensure backdrop exists
  setupBackdropListener();

  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment();

  projectsData.forEach((project) => {
    const cardElement = createProjectCard(project);
    if (cardElement) {
      fragment.appendChild(cardElement);
    }
  });

  // Single DOM operation to add all cards
  portfolioGrid.appendChild(fragment);
}

/**
 * Initialize Three.js scene for a project card
 * @param {HTMLElement} canvas - The canvas element to initialize
 * @param {Object} projectData - Project data for customizing the scene
 */
function initThreeJsCanvas(canvas, projectData) {
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    console.warn("Invalid canvas element provided");
    return;
  }

  // Set initial canvas dimensions
  canvas.width = 300;
  canvas.height = 200;

  // Signal to main.js that this canvas needs initialization
  canvas.setAttribute("data-needs-init", "true");

  // Dispatch an event that main.js can listen for
  const event = new CustomEvent("canvasCreated", {
    detail: { canvasId: canvas.id, projectId: projectData.id },
  });
  document.dispatchEvent(event);
}

/**
 * Add a new project card dynamically to the grid
 * @param {Object} projectData - Project data object
 */
function addNewProject(projectData) {
  if (!projectData?.id) {
    console.warn("Invalid project data provided");
    return;
  }

  // Ensure backdrop exists
  setupBackdropListener();

  // Append the new card
  const portfolioGrid = document.querySelector(".portfolio-grid");
  if (!portfolioGrid) {
    console.warn("Portfolio grid container not found");
    return;
  }

  const cardElement = createProjectCard(projectData);
  if (cardElement) {
    portfolioGrid.appendChild(cardElement);

    const cardElement = createElement("div", "game-preview portfolio-item", {
      id: project.id,
      "data-category": project.tags?.[0]?.toLowerCase() || "",
      "data-model": project.modelName || "",
    });

    // Get the canvas element from the new card
    const canvas = cardElement.querySelector(".threejs-canvas");
    if (canvas) {
      // Initialize Three.js scene on the canvas
      initThreeJsCanvas(canvas, projectData);
    }
  }
}

// Export functions for use in main.js
export {
  createProjectCard,
  toggleExpand,
  closeOnBackdropClick,
  setupBackdropListener,
  addNewProject,
  renderProjectsGrid,
  initThreeJsCanvas,
};

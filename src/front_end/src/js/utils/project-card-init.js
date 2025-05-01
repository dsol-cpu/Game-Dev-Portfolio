/**
 * Enhanced intersection observer for project cards that enables/disables cameras
 * based on visibility in the viewport
 */
import {
  getCamerasByElementId,
  enableCamera,
  disableCamera,
  getCameraRegistry,
} from "../camera-registry.js";
import { debounce } from "../utils/performance.js";

// Configuration
const INTERSECTION_OPTIONS = {
  root: null,
  rootMargin: "100px", // Add some margin to start loading before fully visible
  threshold: 0.1, // Trigger when 10% visible
};

// Store observer instance
let projectCardObserver = null;

/**
 * Initialize intersection observer for all project cards
 */
export function initProjectCardObserver() {
  if (projectCardObserver) {
    projectCardObserver.disconnect();
  }

  // Create observer
  projectCardObserver = new IntersectionObserver(
    handleProjectCardIntersection,
    INTERSECTION_OPTIONS
  );

  // Get all project cards and observe them
  const projectCards = document.querySelectorAll(".project-card");
  projectCards.forEach((card) => {
    projectCardObserver.observe(card);

    // Initially check if already in viewport
    if (isElementInViewport(card)) {
      enableProjectCardCamera(card);
    } else {
      disableProjectCardCamera(card);
    }
  });
}

/**
 * Handle intersection events for project cards
 * @param {IntersectionObserverEntry[]} entries
 */
function handleProjectCardIntersection(entries) {
  for (const entry of entries) {
    const projectCard = entry.target;

    if (entry.isIntersecting) {
      enableProjectCardCamera(projectCard);
    } else {
      disableProjectCardCamera(projectCard);
    }
  }
}

/**
 * Enable cameras associated with a project card
 * @param {HTMLElement} projectCard
 */
function enableProjectCardCamera(projectCard) {
  const elementId =
    projectCard.id || `portfolio-item-${getCardIndex(projectCard)}`;
  const cameraIndices = getCamerasByElementId(elementId);

  if (cameraIndices && cameraIndices.length > 0) {
    // Enable each camera in the bitmask
    for (const index of cameraIndices) {
      enableCamera(index);
    }

    // Force an update on the next frame
    requestAnimationFrame(() => {
      const controls = cameraIndices
        .map((i) => cameraRegistry.controls[i])
        .filter((control) => control !== null);

      for (const control of controls) {
        if (control && typeof control.update === "function") {
          control.update();
        }
      }
    });
  }
}

/**
 * Disable cameras associated with a project card
 * @param {HTMLElement} projectCard
 */
function disableProjectCardCamera(projectCard) {
  const elementId =
    projectCard.id || `portfolio-item-${getCardIndex(projectCard)}`;
  const cameraIndices = getCamerasByElementId(elementId);

  if (cameraIndices && cameraIndices.length > 0) {
    // Disable each camera in the bitmask
    for (const index of cameraIndices) {
      disableCamera(index);
    }
  }
}

/**
 * Get the index of a project card
 * @param {HTMLElement} card
 * @returns {number}
 */
function getCardIndex(card) {
  const cards = Array.from(document.querySelectorAll(".project-card"));
  return cards.indexOf(card);
}

/**
 * Check if an element is in the viewport
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isElementInViewport(element) {
  if (!element?.getBoundingClientRect) return false;

  const rect = element.getBoundingClientRect();
  const windowHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.top <= windowHeight &&
    rect.left <= windowWidth &&
    rect.bottom >= 0 &&
    rect.right >= 0
  );
}

/**
 * Window resize handler to update camera visibility
 */
const handleWindowResize = debounce(() => {
  const projectCards = document.querySelectorAll(".project-card");
  projectCards.forEach((card) => {
    if (isElementInViewport(card)) {
      enableProjectCardCamera(card);
    } else {
      disableProjectCardCamera(card);
    }
  });
}, 100);

/**
 * Initialize the window resize listener
 */
export function initWindowResizeListener() {
  window.removeEventListener("resize", handleWindowResize);
  window.addEventListener("resize", handleWindowResize, { passive: true });
}

/**
 * Clean up the intersection observer
 */
export function cleanupProjectCardObserver() {
  if (projectCardObserver) {
    projectCardObserver.disconnect();
    projectCardObserver = null;
  }

  window.removeEventListener("resize", handleWindowResize);
}

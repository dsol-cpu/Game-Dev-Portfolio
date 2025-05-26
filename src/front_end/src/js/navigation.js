/**
 * @fileoverview Enhanced navigation system that handles both scroll view and game view
 * Integrates with ship navigation for seamless island hopping in game mode
 */

import { navigateShipToSection } from "./three/ship-navigation.js";

// Constants and cached DOM queries
const ACTIVE_CLASS = "active";
let navLinks;
let sections;
let shipNavigation; // Will hold the ship navigation module when loaded

/**
 * Scroll to section and update active navigation state (scroll view only)
 * @param {string} sectionId - ID of the section to scroll to
 */
export function scrollToSection(sectionId) {
  // Make sure we have our DOM elements
  if (!navLinks) {
    navLinks = document.querySelectorAll(".nav-link");
  }

  const targetSection = document.getElementById(sectionId);
  if (!targetSection) return;

  // Smooth scroll to section
  targetSection.scrollIntoView({ behavior: "smooth", block: "start" });

  // Update navigation active state
  updateActiveNavLink(sectionId);

  // Call any available window handlers
  window.handleUserInteraction?.();
}

/**
 * Update active navigation link styling
 * @param {string} sectionId - ID of the active section
 */
function updateActiveNavLink(sectionId) {
  if (!navLinks) {
    navLinks = document.querySelectorAll(".nav-link");
  }

  navLinks.forEach((link) => {
    link.classList.toggle(
      ACTIVE_CLASS,
      link.getAttribute("data-target") === sectionId
    );
  });
}

/**
 * Handle navigation based on current view mode
 * @param {string} sectionId - Target section ID
 * @param {Event} event - Click event (for prevention)
 */
async function handleNavigation(sectionId, event) {
  event.preventDefault();

  // Check if we're in game view
  const isGameView = window.isGameView?.();

  if (isGameView) {
    // Game view: Use ship navigation
    try {
      if (!shipNavigation) {
        // Get required DOM elements for ship navigation
        const elements = {
          viewToggleBtn: document.getElementById("view-toggle-btn"),
          mainGameCanvas: document.getElementById("main-game-canvas"),
          gameViewContainer: document.getElementById("game-view-container"),
          sidebar: document.querySelector(".sidebar"),
          body: document.body,
        };

        // Initialize ship navigation with elements
        shipNavigation = {
          navigateToSection: (id) => navigateShipToSection(id, elements),
        };
      }

      // Immediately update active nav link for visual feedback
      updateActiveNavLink(sectionId);

      // Start ship navigation to the target island
      await shipNavigation.navigateToSection(sectionId);
    } catch (error) {
      console.error("Ship navigation failed:", error);
      // Fallback to scroll navigation if ship nav fails
      scrollToSection(sectionId);
    }
  } else {
    // Scroll view: Use standard scroll navigation
    scrollToSection(sectionId);
  }
}

/**
 * Initialize enhanced navigation system - handles both scroll and game views
 * @returns {Object} Navigation API with exported functions
 */
export function initNavigation() {
  // Cache DOM elements
  navLinks = document.querySelectorAll(".nav-link");
  sections = document.querySelectorAll("section");

  // Handle navigation link clicks with event delegation
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".nav-link");
    if (link) {
      const sectionId = link.getAttribute("data-target");
      if (sectionId) {
        handleNavigation(sectionId, e);
      }
    }
  });

  // Set up intersection observer to detect visible sections (scroll view only)
  const observer = new IntersectionObserver(
    (entries) => {
      // Only update nav links if we're in scroll view
      if (window.isGameView?.()) return;

      const visibleEntry = entries.find((entry) => entry.isIntersecting);
      if (visibleEntry) {
        const sectionId = visibleEntry.target.id;
        updateActiveNavLink(sectionId);
      }
    },
    { threshold: 0.5 }
  );

  // Observe all sections
  sections.forEach((section) => observer.observe(section));

  // Handle initial section based on URL hash (scroll view only)
  const handleInitialSection = () => {
    // Don't auto-scroll if we're in game view
    if (window.isGameView?.()) return;

    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  };

  // Initialize on load and for navigation events
  handleInitialSection();
  window.addEventListener("popstate", handleInitialSection);

  // Add keyboard shortcuts for navigation
  document.addEventListener("keydown", (e) => {
    // Only handle shortcuts in game view when not typing
    if (
      !window.isGameView?.() ||
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA"
    ) {
      return;
    }

    // Number keys 1-4 for quick island navigation
    const keyMap = {
      Digit1: "home",
      Digit2: "experience",
      Digit3: "projects",
      Digit4: "resume",
    };

    const sectionId = keyMap[e.code];
    if (sectionId) {
      e.preventDefault();
      handleNavigation(sectionId, e);
    }
  });

  return {
    scrollToSection,
    handleNavigation,
    updateActiveNavLink,
  };
}

/**
 * @fileoverview Handles site navigation with smooth scrolling to sections
 * No dependency on ship navigation - focused only on standard scroll view
 */

// Constants and cached DOM queries
const ACTIVE_CLASS = "active";
let navLinks;
let sections;

/**
 * Scroll to section and update active navigation state
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
  navLinks.forEach((link) => {
    link.classList.toggle(
      ACTIVE_CLASS,
      link.getAttribute("data-target") === sectionId
    );
  });

  // Call any available window handlers
  window.handleUserInteraction?.();
}

/**
 * Initialize standard navigation system - for scroll view only
 * @returns {Object} Navigation API with exported functions
 */
export function initNavigation() {
  // Cache DOM elements
  navLinks = document.querySelectorAll(".nav-link");
  sections = document.querySelectorAll("section");

  // Handle navigation link clicks with event delegation
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".nav-link");
    if (link && !window.isGameView?.()) {
      e.preventDefault();
      const sectionId = link.getAttribute("data-target");
      scrollToSection(sectionId);
    }
  });

  // Set up intersection observer to detect visible sections
  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries.find((entry) => entry.isIntersecting);
      if (visibleEntry) {
        const sectionId = visibleEntry.target.id;

        navLinks.forEach((link) => {
          link.classList.toggle(
            ACTIVE_CLASS,
            link.getAttribute("data-target") === sectionId
          );
        });
      }
    },
    { threshold: 0.5 }
  );

  // Observe all sections
  sections.forEach((section) => observer.observe(section));

  // Handle initial section based on URL hash
  const handleInitialSection = () => {
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  };

  // Initialize on load and for navigation events
  handleInitialSection();
  window.addEventListener("popstate", handleInitialSection);

  return { scrollToSection };
}

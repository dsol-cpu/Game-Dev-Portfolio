/**
 * @fileoverview Handles site navigation with smooth scrolling to sections
 */

// Constants at file scope for memory efficiency
const NAV_LINKS_SELECTOR = ".nav-link";
const SECTIONS_SELECTOR = "section";
const DATA_TARGET = "data-target";
const ACTIVE_CLASS = "active";

// Cache DOM queries at file scope to avoid repeated lookups
const navLinks = document.querySelectorAll(NAV_LINKS_SELECTOR);
const sections = document.querySelectorAll(SECTIONS_SELECTOR);
const navLinksLength = navLinks.length; // Store navLinks length for faster iteration

/**
 * Scroll to section - closes over cached navLinks for better performance
 * @param {string} sectionId - ID of the section to scroll to
 */
function scrollToSection(sectionId) {
  const targetSection = document.getElementById(sectionId);
  if (!targetSection) return;

  // Use native scroll behavior for smooth scrolling
  targetSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  // Update navigation active state efficiently
  navLinks.forEach((link) => {
    const isActive = link.getAttribute(DATA_TARGET) === sectionId;
    link.classList.toggle(ACTIVE_CLASS, isActive);
  });

  // Direct function calls instead of window checks
  // window.setActiveCamerasBySection?.(sectionId);
  window.handleUserInteraction?.();
}

/**
 * Initialize navigation with event delegation and IntersectionObserver
 */
function initNavigation() {
  // Single event listener for navigation links
  const handleNavClick = (e) => {
    const link = e.target.closest(NAV_LINKS_SELECTOR);
    if (link) {
      e.preventDefault();
      scrollToSection(link.getAttribute(DATA_TARGET));
    }
  };

  document.addEventListener("click", handleNavClick);

  // Configure IntersectionObserver to update active links when sections are visible
  const observer = new IntersectionObserver(
    (entries) => {
      // Loop through the intersecting entries and update active link
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id;

          // Find the corresponding navLink and toggle active state
          const activeLink = Array.from(navLinks).find(
            (link) => link.getAttribute(DATA_TARGET) === sectionId
          );
          if (activeLink) {
            navLinks.forEach((link) => link.classList.remove(ACTIVE_CLASS));
            activeLink.classList.add(ACTIVE_CLASS);
          }

          break; // Exit after first match for performance
        }
      }
    },
    {
      threshold: 0.5, // Trigger when 50% of the section is visible
    }
  );

  sections.forEach((section) => observer.observe(section));

  // Handle initial section based on hash on page load or popstate
  function handleInitialSection() {
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  }

  // Initialize on load and for popstate events
  handleInitialSection();
  window.addEventListener("popstate", handleInitialSection);

  return { scrollToSection };
}

export { initNavigation };

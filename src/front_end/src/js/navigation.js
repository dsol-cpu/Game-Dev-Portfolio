/**
 * @fileoverview Handles site navigation with smooth scrolling to sections
 */

/**
 * Initialize navigation with smooth scrolling
 */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  // Function to handle scrolling to a section
  function scrollToSection(sectionId) {
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      // Scroll to the section with smooth behavior
      targetSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      // Update navigation active state
      navLinks.forEach((link) => {
        link.classList.toggle(
          "active",
          link.getAttribute("data-target") === sectionId
        );
      });

      // Update URL hash without causing a page jump
      //   history.pushState(null, null, `#${sectionId}`);

      // Handle cameras and other section-specific initializations
      if (window.setActiveCamerasBySection) {
        window.setActiveCamerasBySection(sectionId);
      }

      // Handle user interaction if available
      if (window.handleUserInteraction) {
        window.handleUserInteraction();
      }
    }
  }

  // Add click handlers for navigation
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      scrollToSection(this.getAttribute("data-target"));
    });
  });

  // Set up intersection observer to update active nav link on scroll
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.5, // When 50% of the section is visible
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Update the active nav link when a section comes into view
        const sectionId = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle(
            "active",
            link.getAttribute("data-target") === sectionId
          );
        });

        // Update URL without scrolling
        // history.replaceState(null, null, `#${sectionId}`);
      }
    });
  }, observerOptions);

  // Observe all sections
  sections.forEach((section) => {
    observer.observe(section);
  });

  // Handle initial section based on URL hash or default to first section
  function handleInitialSection() {
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
      // Small timeout to ensure the DOM is fully loaded
      setTimeout(() => {
        scrollToSection(hash);
      }, 100);
    }
  }

  // Initialize on load
  handleInitialSection();

  // Handle browser back/forward navigation
  window.addEventListener("popstate", handleInitialSection);

  return {
    scrollToSection,
  };
}

export { initNavigation };

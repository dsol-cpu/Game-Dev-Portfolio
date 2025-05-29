/**
 * @fileoverview Enhanced navigation system with extensive debugging
 * Debug version to identify why ship navigation isn't being called
 */

import {
  navigateShipToSection,
  initShipNavigation,
} from "./three/ship-navigation.js";

import { isGameView } from "./three/game.js";

// Constants and cached DOM queries
const ACTIVE_CLASS = "active";
let navLinks;
let sections;
let shipNavigationAPI;

/**
 * Scroll to section and update active navigation state (scroll view only)
 * @param {string} sectionId - ID of the section to scroll to
 */
export function scrollToSection(sectionId) {
  console.log("📜 scrollToSection called for:", sectionId);

  // Make sure we have our DOM elements
  if (!navLinks) {
    navLinks = document.querySelectorAll(".nav-link");
    console.log("🔍 Re-cached nav links, found:", navLinks.length);
  }

  const targetSection = document.getElementById(sectionId);
  if (!targetSection) {
    console.warn("⚠️ Target section not found:", sectionId);
    return;
  }

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
  console.log("🎯 updateActiveNavLink called for:", sectionId);

  if (!navLinks) {
    navLinks = document.querySelectorAll(".nav-link");
    console.log(
      "🔍 Re-cached nav links in updateActiveNavLink, found:",
      navLinks.length
    );
  }

  navLinks.forEach((link) => {
    const target = link.getAttribute("data-target");
    const shouldBeActive = target === sectionId;
    link.classList.toggle(ACTIVE_CLASS, shouldBeActive);

    if (shouldBeActive) {
      console.log("✅ Activated nav link for:", target);
    }
  });
}

/**
 * Handle navigation based on current view mode
 * @param {string} sectionId - Target section ID
 * @param {Event} event - Click event (for prevention)
 */
async function handleNavigation(sectionId, event) {
  console.log("🧭 === NAVIGATION DEBUG START ===");
  console.log("🧭 handleNavigation called with:", {
    sectionId,
    eventType: event?.type,
  });

  event?.preventDefault();

  // Check current view mode using imported variable
  const gameViewActive = () => isGameView();
  console.log("🎮 isGameView:", gameViewActive);

  if (gameViewActive) {
    console.log("🚢 === SHIP NAVIGATION PATH ===");

    try {
      // Debug: Check if ship navigation functions are available
      console.log("🔍 Checking ship navigation availability:");
      console.log(
        "  - navigateShipToSection type:",
        typeof navigateShipToSection
      );
      console.log("  - shipNavigationAPI:", shipNavigationAPI);

      // Get required DOM elements for ship navigation
      const elements = {
        viewToggleBtn: document.getElementById("view-toggle-btn"),
        mainGameCanvas: document.getElementById("main-game-canvas"),
        gameViewContainer: document.getElementById("game-view-container"),
        sidebar: document.querySelector(".sidebar"),
        body: document.body,
      };

      // Debug: Log element availability
      console.log("🔍 Required elements check:");
      Object.entries(elements).forEach(([key, element]) => {
        console.log(`  - ${key}:`, element ? "✅ Found" : "❌ Missing");
      });

      console.log("🚢 Calling navigateShipToSection with:", sectionId);

      // Immediately update active nav link for visual feedback
      updateActiveNavLink(sectionId);

      // Start ship navigation to the target island
      const result = await navigateShipToSection(sectionId, elements);

      console.log("✅ Ship navigation completed successfully, result:", result);
    } catch (error) {
      console.error("❌ Ship navigation failed with error:", error);
      console.error("❌ Error stack:", error.stack);

      // Fallback to scroll navigation if ship nav fails
      console.log("🔄 Falling back to scroll navigation");
      scrollToSection(sectionId);
    }
  } else {
    console.log("📜 === SCROLL NAVIGATION PATH ===");
    console.log("📜 Using scroll navigation for:", sectionId);
    scrollToSection(sectionId);
  }

  console.log("🧭 === NAVIGATION DEBUG END ===");
}

/**
 * Initialize enhanced navigation system - handles both scroll and game views
 * @returns {Object} Navigation API with exported functions
 */
export function initNavigation() {
  console.log("🚀 === NAVIGATION INIT DEBUG START ===");

  // Initialize ship navigation first
  try {
    shipNavigationAPI = initShipNavigation();
    console.log("⚓ Ship navigation API initialized:", shipNavigationAPI);
  } catch (error) {
    console.error("❌ Failed to initialize ship navigation:", error);
  }

  // Cache DOM elements
  navLinks = document.querySelectorAll(".nav-link");
  sections = document.querySelectorAll("section");

  console.log(
    `📍 Found ${navLinks.length} navigation links and ${sections.length} sections`
  );

  // Debug: Log all nav links and their data-target attributes
  navLinks.forEach((link, index) => {
    const target = link.getAttribute("data-target");
    const text = link.textContent.trim();
    console.log(`  Nav link ${index}: "${text}" -> target: "${target}"`);
  });

  // Handle navigation link clicks with event delegation
  document.addEventListener("click", (e) => {
    console.log("🖱️ Click event detected on:", e.target);

    const link = e.target.closest(".nav-link");
    if (link) {
      const sectionId = link.getAttribute("data-target");
      console.log("🖱️ Navigation link clicked:", {
        element: link,
        sectionId: sectionId,
        text: link.textContent.trim(),
      });

      if (sectionId) {
        handleNavigation(sectionId, e);
      } else {
        console.warn("⚠️ Navigation link missing data-target attribute");
      }
    } else {
      // Debug: Check if click was on a potential nav element
      const potentialNavElement =
        e.target.closest("[data-target]") ||
        e.target.closest(".sidebar a") ||
        e.target.closest("nav a");
      if (potentialNavElement) {
        console.log(
          "🔍 Click detected on potential nav element:",
          potentialNavElement
        );
        console.log("  - Classes:", potentialNavElement.className);
        console.log(
          "  - Data attributes:",
          Array.from(potentialNavElement.attributes).filter((attr) =>
            attr.name.startsWith("data-")
          )
        );
      }
    }
  });

  // Set up intersection observer to detect visible sections (scroll view only)
  const observer = new IntersectionObserver(
    (entries) => {
      // Only update nav links if we're in scroll view
      if (isGameView()) {
        console.log(
          "👁️ Intersection observer: skipping update (game view active)"
        );
        return;
      }

      const visibleEntry = entries.find((entry) => entry.isIntersecting);
      if (visibleEntry) {
        const sectionId = visibleEntry.target.id;
        console.log("👁️ Section became visible:", sectionId);
        updateActiveNavLink(sectionId);
      }
    },
    { threshold: 0.5 }
  );

  // Observe all sections
  sections.forEach((section) => {
    observer.observe(section);
    console.log("👁️ Observing section:", section.id);
  });

  // Handle initial section based on URL hash (scroll view only)
  const handleInitialSection = () => {
    console.log("🏠 handleInitialSection called");

    // Don't auto-scroll if we're in game view
    if (isGameView()) {
      console.log("🏠 Skipping initial section (game view active)");
      return;
    }

    const hash = window.location.hash.substring(1);
    console.log("🏠 URL hash:", hash);

    if (hash && document.getElementById(hash)) {
      console.log("🏠 Scrolling to initial section:", hash);
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
      !isGameView() ||
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
      console.log("⌨️ Keyboard shortcut triggered for:", sectionId);
      handleNavigation(sectionId, e);
    }
  });

  console.log("✅ Navigation system fully initialized");
  console.log("🚀 === NAVIGATION INIT DEBUG END ===");

  return {
    scrollToSection,
    handleNavigation,
    updateActiveNavLink,
    shipNavigationAPI,
  };
}

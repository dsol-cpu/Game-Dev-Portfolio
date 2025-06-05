/**
 * @fileoverview Ship arrival popup system
 * Handles displaying arrival notifications when ships reach destinations
 * Updated to center popup within game canvas area only
 */

import { ISLAND_DATA } from "../data/islands.js";

// Popup state management
const popupState = {
  currentPopup: null,
  isShowing: false,
  queue: [],
};

/**
 * Create and display arrival popup for a specific island
 * @param {string} sectionId - The section ID of the arrived destination
 * @param {Object} options - Additional options for the popup
 */
export function showArrivalPopup(sectionId, options = {}) {
  console.log("🎉 Showing arrival popup for section:", sectionId);

  // Find the island data
  const island = ISLAND_DATA.find((island) => island.section === sectionId);
  if (!island) {
    console.error("❌ No island data found for section:", sectionId);
    return;
  }

  // If there's already a popup showing, queue this one
  if (popupState.isShowing) {
    console.log("⏳ Queueing popup for:", island.name);
    popupState.queue.push({ sectionId, island, options });
    return;
  }

  // Create and show the popup
  createArrivalPopup(island, options);
}

/**
 * Get the game view container for proper popup positioning
 * @returns {HTMLElement|null} Game view container element
 */
function getGameViewContainer() {
  return document.getElementById("game-view-container");
}

/**
 * Create the arrival popup DOM element
 * @param {Object} island - Island data object
 * @param {Object} options - Popup options
 */
function createArrivalPopup(island, options = {}) {
  console.log("📋 Creating arrival popup for:", island.name);

  // Get game view container
  const gameContainer = getGameViewContainer();
  if (!gameContainer) {
    console.error("❌ Game view container not found, cannot show popup");
    return;
  }

  // Remove any existing popup
  removeCurrentPopup();

  // Create popup container
  const popup = document.createElement("div");
  popup.className = "ship-arrival-popup";
  popup.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    border: 3px solid #4CAF50;
    border-radius: 16px;
    padding: 30px;
    max-width: 500px;
    min-width: 350px;
    z-index: 20000;
    box-shadow: 0 20px 40px rgba(0,0,0,0.8);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: white;
    text-align: center;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    backdrop-filter: blur(10px);
    pointer-events: auto;
  `;

  // Create backdrop overlay within the game container
  const backdrop = document.createElement("div");
  backdrop.className = "ship-arrival-backdrop";
  backdrop.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 19999;
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: auto;
  `;

  // Create popup content
  const content = document.createElement("div");
  content.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 48px; margin-bottom: 10px;">⚓</div>
      <h2 style="margin: 0 0 10px 0; color: #4CAF50; font-size: 28px; font-weight: bold;">
        Destination Reached!
      </h2>
    </div>

    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 15px 0; font-size: 24px; color: #ffffff;">
        Welcome to ${island.name}
      </h3>
      <p style="margin: 0; font-size: 16px; color: #cccccc; line-height: 1.5;">
        ${getIslandDescription(island)}
      </p>
    </div>

    <div style="margin-bottom: 25px; padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 4px solid #4CAF50;">
      <div style="font-size: 14px; color: #4CAF50; margin-bottom: 5px;">
        <strong>Navigation Complete</strong>
      </div>
      <div style="font-size: 12px; color: #cccccc;">
        Section: ${island.section} | Position: ${formatPosition(
    island.position
  )}
      </div>
    </div>

    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
      <button class="popup-btn-primary" style="
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(76, 175, 80, 0.4)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(76, 175, 80, 0.3)'">
        Explore Island
      </button>

      <button class="popup-btn-secondary" style="
        background: transparent;
        color: #4CAF50;
        border: 2px solid #4CAF50;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='#4CAF50'; this.style.color='white'"
         onmouseout="this.style.background='transparent'; this.style.color='#4CAF50'">
        Continue Later
      </button>
    </div>

    <div style="margin-top: 20px; font-size: 12px; color: #888;">
      Press ESC or click outside to close
    </div>
  `;

  popup.appendChild(content);

  // Add backdrop first, then popup to game container
  gameContainer.appendChild(backdrop);
  gameContainer.appendChild(popup);

  // Store references and set state
  popupState.currentPopup = popup;
  popupState.backdrop = backdrop;
  popupState.isShowing = true;

  // Animate in
  requestAnimationFrame(() => {
    backdrop.style.opacity = "1";
    popup.style.opacity = "1";
    popup.style.transform = "translate(-50%, -50%) scale(1)";
  });

  // Add event listeners
  setupPopupEventListeners(popup, backdrop, island, options);

  // Auto-close after 10 seconds if no interaction
  setTimeout(() => {
    if (popupState.currentPopup === popup) {
      console.log("⏰ Auto-closing popup after timeout");
      closeCurrentPopup();
    }
  }, 10000);
}

/**
 * Setup event listeners for the popup
 * @param {HTMLElement} popup - The popup element
 * @param {HTMLElement} backdrop - The backdrop element
 * @param {Object} island - Island data
 * @param {Object} options - Popup options
 */
function setupPopupEventListeners(popup, backdrop, island, options) {
  // Primary button (Explore Island)
  const primaryBtn = popup.querySelector(".popup-btn-primary");
  primaryBtn.addEventListener("click", () => {
    console.log("🏝️ Player chose to explore:", island.name);
    closeCurrentPopup();

    // Trigger custom event for exploration
    document.dispatchEvent(
      new CustomEvent("shipArrivalExplore", {
        detail: { island, section: island.section },
      })
    );

    // Call custom callback if provided
    if (options.onExplore) {
      options.onExplore(island);
    }
  });

  // Secondary button (Continue Later)
  const secondaryBtn = popup.querySelector(".popup-btn-secondary");
  secondaryBtn.addEventListener("click", () => {
    console.log("⏭️ Player chose to continue later");
    closeCurrentPopup();

    // Trigger custom event
    document.dispatchEvent(
      new CustomEvent("shipArrivalContinue", {
        detail: { island, section: island.section },
      })
    );

    // Call custom callback if provided
    if (options.onContinue) {
      options.onContinue(island);
    }
  });

  // ESC key to close
  const escapeHandler = (e) => {
    if (e.key === "Escape" && popupState.currentPopup === popup) {
      e.preventDefault();
      e.stopPropagation();
      closeCurrentPopup();
    }
  };
  document.addEventListener("keydown", escapeHandler);

  // Click on backdrop to close
  const backdropClickHandler = (e) => {
    e.stopPropagation();
    closeCurrentPopup();
  };
  backdrop.addEventListener("click", backdropClickHandler);

  // Prevent popup clicks from bubbling to backdrop
  const popupClickHandler = (e) => {
    e.stopPropagation();
  };
  popup.addEventListener("click", popupClickHandler);

  // Store cleanup functions
  popup._cleanup = () => {
    document.removeEventListener("keydown", escapeHandler);
    backdrop.removeEventListener("click", backdropClickHandler);
    popup.removeEventListener("click", popupClickHandler);
  };
}

/**
 * Close the current popup
 */
function closeCurrentPopup() {
  if (!popupState.currentPopup) return;

  console.log("❌ Closing arrival popup");

  const popup = popupState.currentPopup;
  const backdrop = popupState.backdrop;

  // Animate out
  popup.style.opacity = "0";
  popup.style.transform = "translate(-50%, -50%) scale(0.8)";
  if (backdrop) {
    backdrop.style.opacity = "0";
  }

  // Cleanup after animation
  setTimeout(() => {
    removeCurrentPopup();
    processPopupQueue();
  }, 400);
}

/**
 * Remove the current popup from DOM
 */
function removeCurrentPopup() {
  if (popupState.currentPopup) {
    // Run cleanup if it exists
    if (popupState.currentPopup._cleanup) {
      popupState.currentPopup._cleanup();
    }

    // Remove popup from DOM
    if (popupState.currentPopup.parentNode) {
      popupState.currentPopup.parentNode.removeChild(popupState.currentPopup);
    }

    // Remove backdrop from DOM
    if (popupState.backdrop?.parentNode) {
      popupState.backdrop.parentNode.removeChild(popupState.backdrop);
    }

    popupState.currentPopup = null;
    popupState.backdrop = null;
    popupState.isShowing = false;
  }
}

/**
 * Process the next popup in queue
 */
function processPopupQueue() {
  if (popupState.queue.length > 0) {
    const next = popupState.queue.shift();
    console.log("📋 Processing queued popup for:", next.island.name);
    setTimeout(() => {
      createArrivalPopup(next.island, next.options);
    }, 500); // Small delay between popups
  }
}

/**
 * Get a description for the island
 * @param {Object} island - Island data
 * @returns {string} Description text
 */
function getIslandDescription(island) {
  // You can customize these descriptions based on your island data
  const descriptions = {
    port_royal:
      "A bustling port town filled with merchants, sailors, and adventure. The perfect place to resupply and gather information.",
    treasure_island:
      "A mysterious island shrouded in legends of buried treasure and ancient secrets waiting to be discovered.",
    coral_reef:
      "A vibrant underwater paradise teeming with marine life and hidden underwater caves to explore.",
    volcanic_island:
      "An active volcanic island with dramatic landscapes, hot springs, and rare mineral deposits.",
    desert_island:
      "A remote tropical paradise with pristine beaches and untouched natural beauty.",
    storm_island:
      "A weather-beaten island known for its fierce storms and the hardy souls who call it home.",
    ice_island:
      "A frozen wonderland with crystalline formations and unique cold-weather wildlife.",
    jungle_island:
      "A dense tropical jungle filled with exotic wildlife, ancient ruins, and hidden pathways.",
  };

  return (
    descriptions[island.section] ||
    `You have arrived at ${island.name}, a unique destination with its own character and opportunities for exploration.`
  );
}

/**
 * Format position coordinates for display
 * @param {Object} position - Position object with x, y, z
 * @returns {string} Formatted position string
 */
function formatPosition(position) {
  return `${position.x.toFixed(1)}, ${position.y.toFixed(
    1
  )}, ${position.z.toFixed(1)}`;
}

/**
 * Clear all popups and queue
 */
export function clearAllArrivalPopups() {
  console.log("🧹 Clearing all arrival popups");
  removeCurrentPopup();
  popupState.queue = [];
}

/**
 * Check if a popup is currently showing
 * @returns {boolean} True if popup is showing
 */
export function isArrivalPopupShowing() {
  return popupState.isShowing;
}

/**
 * Initialize the arrival popup system
 */
export function initArrivalPopup() {
  console.log("✅ Ship arrival popup system initialized");

  // Listen for page unload to cleanup
  window.addEventListener("beforeunload", clearAllArrivalPopups);

  return {
    showArrivalPopup,
    clearAllArrivalPopups,
    isArrivalPopupShowing,
  };
}

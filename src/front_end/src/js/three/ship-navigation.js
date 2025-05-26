/**
 * @fileoverview Ship navigation and autopilot controls
 * Handles automated ship travel to destinations
 */

import { ISLAND_DATA } from "../data/islands.js";
import { isGameView, toggleGameView } from "./game.js";
import { Vector3, Quaternion } from "../extern/three/three.module.min.js";
import { scrollToSection } from "../navigation.js";
import {
  getPlayerModel,
  setPlayerAutoPilot,
  clearPlayerAutoPilot,
} from "./player.js";
import { random } from "../utils/random.js";

// Constants
const SHIP_TRAVEL_SPEED = 15; // Speed for automated ship travel
const ARRIVAL_DISTANCE = 4; // Distance to consider "arrived" at destination
const AUTO_PILOT_TURN_RATE = 0.03; // Turn rate for auto navigation
const AUTO_PILOT_VERTICAL_SPEED = 8; // Vertical speed during auto navigation

// Ship navigation state
const shipNavState = {
  isAutoPiloting: false,
  destination: null,
  targetSection: null,
  initialPosition: null,
  travelStartTime: 0,
  animationProgress: 0,
  onArrivalCallback: null,
  elements: null,
  updateInterval: null,
};

// Create a mapping between section IDs and island data
const sectionToIslandMap = {};
ISLAND_DATA.forEach((island) => {
  sectionToIslandMap[island.section] = island;
});

/**
 * Check if ship is currently auto-piloting
 * @returns {boolean} True if ship is auto-piloting
 */
export function isShipAutoPiloting() {
  return shipNavState.isAutoPiloting;
}

/**
 * Get current navigation progress
 * @returns {number} Progress from 0 to 1
 */
export function getNavigationProgress() {
  return shipNavState.animationProgress;
}

/**
 * Navigates the ship to the specified island and triggers section scroll
 * @param {string} sectionId - Target section ID
 * @param {Object} elements - Required DOM elements
 * @returns {Promise} Resolves when ship arrives at destination
 */
export function navigateShipToSection(sectionId, elements) {
  console.log("🚢 Ship navigation called for section:", sectionId);

  // Save elements for later use
  shipNavState.elements = elements;

  // Check if target section exists as an island
  const targetIsland = sectionToIslandMap[sectionId];
  if (!targetIsland) {
    console.warn(`❌ No island found for section: ${sectionId}`);
    return Promise.resolve();
  }

  console.log("🏝️ Target island found:", targetIsland);

  // If not in game view, switch to it first
  let viewSwitchPromise = Promise.resolve();
  if (!isGameView()) {
    console.log("🔄 Switching to game view first");
    viewSwitchPromise = new Promise((resolve) => {
      toggleGameView(elements);
      setTimeout(resolve, 700); // Give more time for view transition
    });
  }

  // Start ship navigation after view switch
  return viewSwitchPromise.then(() => {
    console.log("⚓ Starting autopilot to:", targetIsland.name);
    return startShipAutoPilot(targetIsland, sectionId);
  });
}

/**
 * Start auto-pilot journey to target island
 * @param {Object} targetIsland - Island data object
 * @param {string} sectionId - Section ID for scrolling after arrival
 * @returns {Promise} Resolves when ship arrives
 */
async function startShipAutoPilot(targetIsland, sectionId) {
  // Get current player position and state
  const playerShip = getPlayerModel();
  if (!playerShip) {
    console.error("❌ Player ship not found");
    return Promise.reject(new Error("Player ship not found"));
  }

  console.log("✅ Player ship found at position:", playerShip.position);

  // Cancel any existing navigation
  if (shipNavState.isAutoPiloting) {
    cancelShipNavigation();
  }

  // Set navigation state
  shipNavState.isAutoPiloting = true;
  shipNavState.destination = new Vector3().copy(targetIsland.position);
  shipNavState.destination.y += 2.5; // Hover above the island
  shipNavState.targetSection = sectionId;
  shipNavState.initialPosition = new Vector3().copy(playerShip.position);
  shipNavState.travelStartTime = performance.now();
  shipNavState.animationProgress = 0;

  console.log("🎯 Autopilot configured:");
  console.log("  From:", shipNavState.initialPosition);
  console.log("  To:", shipNavState.destination);
  console.log(
    "  Distance:",
    shipNavState.initialPosition.distanceTo(shipNavState.destination)
  );

  // Notify player system that we're taking control
  if (typeof setPlayerAutoPilot === "function") {
    setPlayerAutoPilot(true);
  }

  // Start the update loop
  startAutoPilotLoop();

  // Create a promise that resolves when we arrive
  return new Promise((resolve) => {
    shipNavState.onArrivalCallback = resolve;
  });
}

/**
 * Start the autopilot update loop using requestAnimationFrame
 */
function startAutoPilotLoop() {
  let lastTime = performance.now();

  const autopilotLoop = (currentTime) => {
    if (!shipNavState.isAutoPiloting) {
      return; // Stop the loop if autopilot is disabled
    }

    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    updateShipAutoPilot(deltaTime);

    // Continue the loop
    shipNavState.updateInterval = requestAnimationFrame(autopilotLoop);
  };

  // Start the loop
  shipNavState.updateInterval = requestAnimationFrame(autopilotLoop);
}

/**
 * Update ship during auto-pilot
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateShipAutoPilot(deltaTime) {
  const playerShip = getPlayerModel();
  if (!playerShip) {
    console.error("❌ Lost player ship during autopilot");
    completeShipNavigation();
    return;
  }

  // Calculate distance to target
  const distanceToTarget = playerShip.position.distanceTo(
    shipNavState.destination
  );

  // Check if we've arrived
  if (distanceToTarget <= ARRIVAL_DISTANCE) {
    console.log("🎉 Arrived at destination! Distance:", distanceToTarget);
    completeShipNavigation();
    return;
  }

  // Calculate direction to target
  const directionToTarget = new Vector3()
    .subVectors(shipNavState.destination, playerShip.position)
    .normalize();

  // Rotate ship to face target (only horizontal rotation)
  const targetDirection = directionToTarget.clone();
  targetDirection.y = 0; // Keep rotation level
  targetDirection.normalize();

  if (targetDirection.length() > 0.1) {
    const shipForward = new Vector3(0, 0, -1);
    const targetQuaternion = new Quaternion().setFromUnitVectors(
      shipForward,
      targetDirection
    );

    // Smooth rotation
    playerShip.quaternion.slerp(
      targetQuaternion,
      AUTO_PILOT_TURN_RATE * deltaTime * 60
    );
  }

  // Move ship towards target
  const moveSpeed = SHIP_TRAVEL_SPEED * deltaTime;
  const movement = directionToTarget.multiplyScalar(moveSpeed);

  // Apply movement
  playerShip.position.add(movement);

  // Update animation progress
  const initialDistance = shipNavState.initialPosition.distanceTo(
    shipNavState.destination
  );
  shipNavState.animationProgress = Math.max(
    0,
    Math.min(1, 1 - distanceToTarget / initialDistance)
  );

  // Update UI
  updateNavigationUI(shipNavState.animationProgress);

  // Debug logging (less frequent)
  if (random() < 0.01) {
    // Only log ~1% of frames
    console.log(
      `🚢 Autopilot progress: ${Math.round(
        shipNavState.animationProgress * 100
      )}% (${distanceToTarget.toFixed(1)} units remaining)`
    );
  }
}

/**
 * Complete the navigation and scroll to the target section
 */
function completeShipNavigation() {
  console.log("🏁 Completing ship navigation");

  // Stop the update loop
  if (shipNavState.updateInterval) {
    cancelAnimationFrame(shipNavState.updateInterval);
    shipNavState.updateInterval = null;
  }

  // Notify player system that we're releasing control
  if (typeof clearPlayerAutoPilot === "function") {
    clearPlayerAutoPilot();
  }

  // Reset state
  shipNavState.isAutoPiloting = false;
  shipNavState.animationProgress = 1.0;

  // Update UI one final time
  updateNavigationUI(1.0);

  // Wait a short moment then scroll to the associated section
  setTimeout(() => {
    console.log("🔄 Switching back to scroll view");
    // Switch back to scroll view
    if (isGameView() && shipNavState.elements) {
      toggleGameView(shipNavState.elements);

      // After view transition, scroll to section
      setTimeout(() => {
        console.log("📜 Scrolling to section:", shipNavState.targetSection);
        scrollToSection(shipNavState.targetSection);

        // Resolve the navigation promise
        if (shipNavState.onArrivalCallback) {
          shipNavState.onArrivalCallback();
          shipNavState.onArrivalCallback = null;
        }

        // Reset progress after completion
        setTimeout(() => {
          shipNavState.animationProgress = 0;
          updateNavigationUI(0);
        }, 1000);
      }, 600);
    }
  }, 1000); // Longer pause to enjoy arrival
}

/**
 * Update UI during navigation
 * @param {number} progress - Navigation progress (0-1)
 */
function updateNavigationUI(progress) {
  // Update any existing navigation progress indicators
  const progressIndicators = document.querySelectorAll(".ship-nav-progress");
  progressIndicators.forEach((indicator) => {
    if (indicator.style !== undefined) {
      indicator.style.width = `${progress * 100}%`;
    }
    if (indicator.setAttribute) {
      indicator.setAttribute("data-progress", progress.toFixed(2));
    }
  });

  // Update navigation status text
  const statusElements = document.querySelectorAll(".ship-nav-status");
  statusElements.forEach((element) => {
    if (progress === 0 && !shipNavState.isAutoPiloting) {
      element.textContent = "Ready to sail";
    } else if (progress < 1 && shipNavState.isAutoPiloting) {
      element.textContent = `Sailing to ${
        shipNavState.targetSection
      }... ${Math.round(progress * 100)}%`;
    } else if (progress >= 1) {
      element.textContent = "Arrived at destination";
    }
  });

  // Dispatch custom event for other systems to listen to
  document.dispatchEvent(
    new CustomEvent("shipNavigationProgress", {
      detail: {
        progress,
        isAutoPiloting: shipNavState.isAutoPiloting,
        targetSection: shipNavState.targetSection,
      },
    })
  );
}

/**
 * Cancel current ship navigation if in progress
 */
export function cancelShipNavigation() {
  if (shipNavState.isAutoPiloting) {
    console.log("🛑 Cancelling ship navigation");

    // Stop the update loop
    if (shipNavState.updateInterval) {
      cancelAnimationFrame(shipNavState.updateInterval);
      shipNavState.updateInterval = null;
    }

    // Notify player system that we're releasing control
    if (typeof clearPlayerAutoPilot === "function") {
      clearPlayerAutoPilot();
    }

    shipNavState.isAutoPiloting = false;
    shipNavState.animationProgress = 0;

    if (shipNavState.onArrivalCallback) {
      shipNavState.onArrivalCallback();
      shipNavState.onArrivalCallback = null;
    }

    updateNavigationUI(0);
  }
}

/**
 * Initialize ship navigation system
 * @returns {Object} Ship navigation API
 */
export function initShipNavigation() {
  console.log("⚓ Initializing ship navigation system");

  // Add keyboard shortcut to cancel navigation
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && shipNavState.isAutoPiloting) {
      e.preventDefault();
      cancelShipNavigation();
    }
  });

  // Listen for ship navigation progress events to update any UI
  document.addEventListener("shipNavigationProgress", (e) => {
    const { progress, isAutoPiloting, targetSection } = e.detail;

    // Update any game UI elements that show navigation status
    const gameUI =
      document.getElementById("game-ui-container") || document.body;

    if (isAutoPiloting) {
      // Add or update navigation status display
      let statusElement = gameUI.querySelector(".current-navigation-status");
      if (!statusElement) {
        statusElement = document.createElement("div");
        statusElement.className = "current-navigation-status";
        statusElement.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 15px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 12px;
          z-index: 10000;
          border: 2px solid #4CAF50;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        gameUI.appendChild(statusElement);
      }

      statusElement.innerHTML = `
        <div style="margin-bottom: 5px;">⚓ Sailing to: <strong>${targetSection}</strong></div>
        <div style="margin-bottom: 8px;">Progress: ${Math.round(
          progress * 100
        )}%</div>
        <div style="background: #333; height: 6px; margin-bottom: 8px; border-radius: 3px; overflow: hidden;">
          <div style="background: linear-gradient(90deg, #4CAF50, #81C784); height: 100%; width: ${
            progress * 100
          }%; transition: width 0.3s ease;"></div>
        </div>
        <small style="opacity: 0.8;">Press ESC to cancel</small>
      `;
    } else {
      // Remove status when not navigating
      const statusElement = gameUI.querySelector(".current-navigation-status");
      if (statusElement) {
        statusElement.remove();
      }
    }
  });

  return {
    navigateShipToSection,
    isShipAutoPiloting,
    getNavigationProgress,
    cancelShipNavigation,
  };
}

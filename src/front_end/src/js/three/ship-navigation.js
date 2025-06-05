/**
 * @fileoverview Ship navigation and autopilot controls
 * Handles automated ship travel to destinations with arrival popup integration
 */

import { ISLAND_DATA } from "../data/islands.js";
import { Vector3, Quaternion } from "../extern/three/three.module.min.js";
import {
  getPlayerModel,
  setPlayerAutoPilot,
  clearPlayerAutoPilot,
} from "./player.js";
import { random } from "../utils/random.js";
import { showArrivalPopup, clearAllArrivalPopups } from "./island-popup.js";

// Constants
const SHIP_TRAVEL_SPEED = 15; // Speed for automated ship travel
const ARRIVAL_DISTANCE = 4; // Distance to consider "arrived" at destination
const AUTO_PILOT_TURN_RATE = 2.0; // Turn rate for auto navigation (increased)

// Ship navigation state
const shipNavState = {
  isAutoPiloting: false,
  destination: null,
  targetSection: null,
  targetIsland: null, // Store the full island data
  initialPosition: null,
  travelStartTime: 0,
  animationProgress: 0,
  onArrivalCallback: null,
  updateInterval: null,
  isLeavingIsland: false, // Track if we're departing from an island
  departureSection: null, // Track which island we're leaving
};

// Create a mapping between section IDs and island data
const sectionToIslandMap = {};
console.log("🗺️ Building section to island mapping...");
ISLAND_DATA.forEach((island) => {
  sectionToIslandMap[island.section] = island;
  console.log(`  📍 ${island.section} -> ${island.name} at`, island.position);
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
 * Get current destination section
 * @returns {string|null} Target section ID or null
 */
export function getCurrentDestination() {
  return shipNavState.targetSection;
}

/**
 * Check if we're currently leaving an island
 * @returns {boolean} True if departing from an island
 */
export function isLeavingIsland() {
  return shipNavState.isLeavingIsland;
}

/**
 * Navigates the ship to the specified island
 * @param {string} sectionId - Target section ID
 * @param {Object} options - Navigation options
 * @param {string} options.fromSection - Section we're departing from (optional)
 * @param {boolean} options.showDepartureMessage - Show departure message (default: true)
 * @returns {Promise} Resolves when ship arrives at destination
 */
export function navigateShipToSection(sectionId, options = {}) {
  console.log("🚢 Ship navigation called for section:", sectionId);

  // Check if target section exists as an island
  const targetIsland = sectionToIslandMap[sectionId];
  if (!targetIsland) {
    console.error(`❌ No island found for section: ${sectionId}`);
    console.log("Available sections:", Object.keys(sectionToIslandMap));
    return Promise.reject(
      new Error(`No island found for section: ${sectionId}`)
    );
  }

  console.log(
    "🏝️ Target island found:",
    targetIsland.name,
    "at position:",
    targetIsland.position
  );

  // Handle departure from current island if specified
  if (options.fromSection && options.showDepartureMessage !== false) {
    handleIslandDeparture(options.fromSection);
  }

  // Start ship navigation directly
  console.log("⚓ Starting autopilot to:", targetIsland.name);
  return startShipAutoPilot(targetIsland, sectionId, options);
}

/**
 * Handle departure from an island
 * @param {string} departureSection - Section ID we're leaving
 */
function handleIslandDeparture(departureSection) {
  const departureIsland = sectionToIslandMap[departureSection];
  if (!departureIsland) return;

  console.log("🏃‍♂️ Departing from:", departureIsland.name);

  // Set departure state
  shipNavState.isLeavingIsland = true;
  shipNavState.departureSection = departureSection;

  // Clear any existing arrival popups since we're leaving
  clearAllArrivalPopups();

  // Dispatch departure event for other systems to listen to
  document.dispatchEvent(
    new CustomEvent("shipDeparture", {
      detail: {
        island: departureIsland,
        section: departureSection,
        destination: shipNavState.targetSection,
      },
    })
  );

  // You could add a departure popup here if desired
  // showDeparturePopup(departureIsland);
}

/**
 * Start auto-pilot journey to target island
 * @param {Object} targetIsland - Island data object
 * @param {string} sectionId - Section ID for reference
 * @param {Object} options - Navigation options
 * @returns {Promise} Resolves when ship arrives
 */
async function startShipAutoPilot(targetIsland, sectionId, options = {}) {
  console.log("🎯 Starting autopilot sequence...");

  // Get current player position and state
  const playerShip = getPlayerModel();
  if (!playerShip) {
    console.error("❌ Player ship not found - cannot start autopilot");
    return Promise.reject(new Error("Player ship not found"));
  }

  console.log("✅ Player ship found at position:", {
    x: playerShip.position.x.toFixed(2),
    y: playerShip.position.y.toFixed(2),
    z: playerShip.position.z.toFixed(2),
  });

  // Cancel any existing navigation
  if (shipNavState.isAutoPiloting) {
    console.log("🛑 Cancelling existing navigation");
    cancelShipNavigation();
  }

  // Set navigation state
  shipNavState.isAutoPiloting = true;
  shipNavState.destination = new Vector3().copy(targetIsland.position);
  shipNavState.destination.y += 2.5; // Hover above the island
  shipNavState.targetSection = sectionId;
  shipNavState.targetIsland = targetIsland; // Store full island data
  shipNavState.initialPosition = new Vector3().copy(playerShip.position);
  shipNavState.travelStartTime = performance.now();
  shipNavState.animationProgress = 0;

  const distance = shipNavState.initialPosition.distanceTo(
    shipNavState.destination
  );

  console.log("🎯 Autopilot configured:");
  console.log("  From:", {
    x: shipNavState.initialPosition.x.toFixed(2),
    y: shipNavState.initialPosition.y.toFixed(2),
    z: shipNavState.initialPosition.z.toFixed(2),
  });
  console.log("  To:", {
    x: shipNavState.destination.x.toFixed(2),
    y: shipNavState.destination.y.toFixed(2),
    z: shipNavState.destination.z.toFixed(2),
  });
  console.log("  Distance:", distance.toFixed(2), "units");
  console.log(
    "  Estimated time:",
    (distance / SHIP_TRAVEL_SPEED).toFixed(1),
    "seconds"
  );

  // Notify player system that we're taking control
  try {
    if (typeof setPlayerAutoPilot === "function") {
      setPlayerAutoPilot(true);
      console.log("✅ Player autopilot enabled");
    } else {
      console.warn("⚠️ setPlayerAutoPilot function not available");
    }
  } catch (error) {
    console.error("❌ Failed to set player autopilot:", error);
  }

  // Start the update loop
  startAutoPilotLoop();

  // Create a promise that resolves when we arrive
  return new Promise((resolve, reject) => {
    shipNavState.onArrivalCallback = resolve;

    // Add a timeout as safety net
    setTimeout(() => {
      if (shipNavState.isAutoPiloting) {
        console.warn("⏰ Autopilot timeout - forcing completion");
        completeShipNavigation();
      }
    }, 30000); // 30 second timeout
  });
}

/**
 * Start the autopilot update loop using requestAnimationFrame
 */
function startAutoPilotLoop() {
  console.log("🔄 Starting autopilot update loop");
  let lastTime = performance.now();
  let frameCount = 0;

  const autopilotLoop = (currentTime) => {
    if (!shipNavState.isAutoPiloting) {
      console.log("🛑 Autopilot loop stopped - not piloting");
      return; // Stop the loop if autopilot is disabled
    }

    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;
    frameCount++;

    // Log every 60 frames (roughly once per second at 60fps)
    if (frameCount % 60 === 0) {
      console.log(
        `🔄 Autopilot frame ${frameCount}, deltaTime: ${deltaTime.toFixed(3)}s`
      );
    }

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
    console.log(
      "🎉 Arrived at destination! Distance:",
      distanceToTarget.toFixed(2)
    );
    completeShipNavigation();
    return;
  }

  // Calculate direction to target
  const directionToTarget = new Vector3()
    .subVectors(shipNavState.destination, playerShip.position)
    .normalize();

  // Move the ship position during autopilot
  const moveSpeed = SHIP_TRAVEL_SPEED * deltaTime;
  const movement = directionToTarget.clone().multiplyScalar(moveSpeed);

  // Apply movement directly to ship position
  playerShip.position.add(movement);

  // Rotate ship to face target direction
  const targetDirection = directionToTarget.clone();
  targetDirection.y = 0; // Keep rotation level for smoother movement
  targetDirection.normalize();

  if (targetDirection.length() > 0.1) {
    // Calculate the angle from the current forward direction to target
    const angle = Math.atan2(targetDirection.x, -targetDirection.z);

    // Create target quaternion
    const targetQuaternion = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      angle
    );

    // Smoothly rotate towards target
    playerShip.quaternion.slerp(
      targetQuaternion,
      AUTO_PILOT_TURN_RATE * deltaTime
    );
  }

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
    console.log(
      `🚢 Autopilot progress: ${Math.round(
        shipNavState.animationProgress * 100
      )}% (${distanceToTarget.toFixed(1)} units remaining)`
    );
    console.log("Ship position:", {
      x: playerShip.position.x.toFixed(2),
      y: playerShip.position.y.toFixed(2),
      z: playerShip.position.z.toFixed(2),
    });
  }
}

/**
 * Complete the navigation and show arrival popup
 */
function completeShipNavigation() {
  console.log("🏁 Completing ship navigation");

  // Stop the update loop
  if (shipNavState.updateInterval) {
    cancelAnimationFrame(shipNavState.updateInterval);
    shipNavState.updateInterval = null;
    console.log("✅ Update loop stopped");
  }

  // Notify player system that we're releasing control
  try {
    if (typeof clearPlayerAutoPilot === "function") {
      clearPlayerAutoPilot();
      console.log("✅ Player autopilot disabled");
    }
  } catch (error) {
    console.error("❌ Failed to clear player autopilot:", error);
  }

  // Reset navigation state
  const arrivedSection = shipNavState.targetSection;
  const arrivedIsland = shipNavState.targetIsland;
  shipNavState.isAutoPiloting = false;
  shipNavState.animationProgress = 1.0;
  shipNavState.isLeavingIsland = false; // No longer leaving
  shipNavState.departureSection = null;

  // Update UI one final time
  updateNavigationUI(1.0);

  // Show arrival popup after a brief pause for the ship to settle
  setTimeout(() => {
    if (arrivedSection && arrivedIsland) {
      console.log("🎉 Showing arrival popup for:", arrivedIsland.name);

      // Show the arrival popup with custom callbacks
      showArrivalPopup(arrivedSection, {
        onExplore: (island) => {
          console.log("🏝️ Player chose to explore:", island.name);
          // Dispatch event for other systems to handle exploration
          document.dispatchEvent(
            new CustomEvent("startIslandExploration", {
              detail: { island, section: island.section },
            })
          );
        },
        onContinue: (island) => {
          console.log("⏭️ Player chose to continue later at:", island.name);
          // Player stays at the island but doesn't explore immediately
          document.dispatchEvent(
            new CustomEvent("arrivalAcknowledged", {
              detail: { island, section: island.section },
            })
          );
        },
      });
    }

    // Resolve the navigation promise
    if (shipNavState.onArrivalCallback) {
      shipNavState.onArrivalCallback({
        success: true,
        section: arrivedSection,
        island: arrivedIsland,
      });
      shipNavState.onArrivalCallback = null;
      console.log("✅ Navigation promise resolved");
    }

    // Reset progress after completion
    setTimeout(() => {
      shipNavState.animationProgress = 0;
      updateNavigationUI(0);
    }, 1000);
  }, 1000);
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
      const targetName = shipNavState.targetIsland
        ? shipNavState.targetIsland.name
        : shipNavState.targetSection;
      element.textContent = `Sailing to ${targetName}... ${Math.round(
        progress * 100
      )}%`;
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
        targetIsland: shipNavState.targetIsland,
        isLeavingIsland: shipNavState.isLeavingIsland,
        departureSection: shipNavState.departureSection,
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
    try {
      if (typeof clearPlayerAutoPilot === "function") {
        clearPlayerAutoPilot();
      }
    } catch (error) {
      console.error("❌ Failed to clear autopilot:", error);
    }

    // Clear any popups that might be showing
    clearAllArrivalPopups();

    shipNavState.isAutoPiloting = false;
    shipNavState.animationProgress = 0;
    shipNavState.isLeavingIsland = false;
    shipNavState.departureSection = null;

    if (shipNavState.onArrivalCallback) {
      shipNavState.onArrivalCallback({
        success: false,
        cancelled: true,
      });
      shipNavState.onArrivalCallback = null;
    }

    updateNavigationUI(0);

    // Dispatch cancellation event
    document.dispatchEvent(
      new CustomEvent("shipNavigationCancelled", {
        detail: {
          targetSection: shipNavState.targetSection,
          progress: shipNavState.animationProgress,
        },
      })
    );
  }
}

/**
 * Initialize ship navigation system
 * @returns {Object} Ship navigation API
 */
export function initShipNavigation() {
  console.log("⚓ Initializing ship navigation system");
  console.log("🗺️ Available islands:", Object.keys(sectionToIslandMap));

  // Add keyboard shortcut to cancel navigation
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && shipNavState.isAutoPiloting) {
      e.preventDefault();
      console.log("⌨️ ESC pressed - cancelling navigation");
      cancelShipNavigation();
    }
  });

  // Listen for ship navigation progress events to update any UI
  document.addEventListener("shipNavigationProgress", (e) => {
    const {
      progress,
      isAutoPiloting,
      targetSection,
      targetIsland,
      isLeavingIsland,
    } = e.detail;

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

      const targetName = targetIsland ? targetIsland.name : targetSection;
      const statusIcon = isLeavingIsland ? "🏃‍♂️" : "⚓";
      const statusText = isLeavingIsland ? "Departing..." : "Sailing to";

      statusElement.innerHTML = `
        <div style="margin-bottom: 5px;">${statusIcon} ${statusText}: <strong>${targetName}</strong></div>
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

  console.log("✅ Ship navigation system initialized");

  return {
    navigateShipToSection,
    isShipAutoPiloting,
    getNavigationProgress,
    getCurrentDestination,
    isLeavingIsland,
    cancelShipNavigation,
  };
}

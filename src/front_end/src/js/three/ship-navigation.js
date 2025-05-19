/**
 * @fileoverview Ship navigation and autopilot controls
 * Handles automated ship travel to destinations
 */

import { ISLAND_DATA } from "../three/game.js";
import { isGameView, toggleGameView } from "./three/game.js";
import { Vector3, Quaternion } from "./extern/three/three.module.min.js";
import { scrollToSection } from "./navigation.js";
import { getPlayerModel } from "./player.js";

// Constants
const SHIP_TRAVEL_SPEED = 20; // Speed for automated ship travel
const ARRIVAL_DISTANCE = 3; // Distance to consider "arrived" at destination
const AUTO_PILOT_TURN_RATE = 0.02; // Turn rate for auto navigation
const AUTO_PILOT_VERTICAL_SPEED = 0.5; // Vertical speed during auto navigation

// Ship navigation state
const shipNavState = {
  isAutoPiloting: false,
  destination: null,
  targetSection: null,
  initialPosition: null,
  travelStartTime: 0,
  animationProgress: 0,
  onArrivalCallback: null,
  elements: null, // Will store required DOM elements
};

// Create a mapping between section IDs and island data
const sectionToIslandMap = {};
ISLAND_DATA.forEach((island) => {
  sectionToIslandMap[island.section] = island;
});

/**
 * Navigates the ship to the specified island and triggers section scroll
 * @param {string} sectionId - Target section ID
 * @param {Object} elements - Required DOM elements
 * @returns {Promise} Resolves when ship arrives at destination
 */
export function navigateShipToSection(sectionId, elements) {
  // Save elements for later use
  shipNavState.elements = elements;

  // Check if target section exists as an island
  const targetIsland = sectionToIslandMap[sectionId];
  if (!targetIsland) {
    console.warn(`No island found for section: ${sectionId}`);
    return Promise.resolve();
  }

  // If not in game view, switch to it first
  let viewSwitchPromise = Promise.resolve();
  if (!isGameView()) {
    viewSwitchPromise = new Promise((resolve) => {
      // Switch to game view first
      toggleGameView(elements);
      // Allow time for view transition
      setTimeout(resolve, 600);
    });
  }

  // Start ship navigation after view switch
  return viewSwitchPromise.then(() => {
    return startShipAutoPilot(targetIsland, sectionId);
  });
}

/**
 * Start auto-pilot journey to target island
 * @param {Object} targetIsland - Island data object
 * @param {string} sectionId - Section ID for scrolling after arrival
 * @returns {Promise} Resolves when ship arrives
 */
function startShipAutoPilot(targetIsland, sectionId) {
  // Import player module dynamically to avoid circular dependencies
  return import("./game/player.js").then((playerModule) => {
    // Get current player position and state
    const playerShip = playerModule.getPlayerModel();
    if (!playerShip) {
      console.error("Player ship not found");
      return Promise.reject("Player ship not found");
    }

    // Set navigation state
    shipNavState.isAutoPiloting = true;
    shipNavState.destination = new Vector3().copy(targetIsland.position);
    shipNavState.targetSection = sectionId;
    shipNavState.initialPosition = new Vector3().copy(playerShip.position);
    shipNavState.travelStartTime = performance.now();
    shipNavState.animationProgress = 0;

    // Register auto-pilot update with the game loop
    const existingUpdate = playerModule.updatePlayer;

    // Create a promise that resolves when we arrive
    return new Promise((resolve) => {
      shipNavState.onArrivalCallback = resolve;

      // Override player update function to use auto-pilot
      playerModule.updatePlayer = function (deltaTime) {
        if (shipNavState.isAutoPiloting) {
          updateShipAutoPilot(playerShip, deltaTime, playerModule);
        } else {
          // Call original update function when not auto-piloting
          existingUpdate(deltaTime);
        }
      };
    });
  });
}

/**
 * Update ship during auto-pilot
 * @param {Object} ship - Player ship object
 * @param {number} deltaTime - Time since last frame
 * @param {Object} playerModule - Player module with control functions
 */
function updateShipAutoPilot(ship, deltaTime, playerModule) {
  // Calculate direction to target
  const directionToTarget = new Vector3()
    .subVectors(shipNavState.destination, ship.position)
    .normalize();

  // Calculate distance to target
  const distanceToTarget = ship.position.distanceTo(shipNavState.destination);

  // Check if we've arrived
  if (distanceToTarget <= ARRIVAL_DISTANCE) {
    completeShipNavigation(playerModule);
    return;
  }

  // Calculate desired orientation to face target
  const targetQuaternion = new Quaternion();
  const upVector = new Vector3(0, 1, 0);

  // Create temporary vectors for the ship to face the destination
  const shipForward = new Vector3(0, 0, -1); // Ship faces -Z by default
  const targetDirection = directionToTarget.clone();
  targetDirection.y = 0; // Keep level on y-axis
  targetDirection.normalize();

  // Smoothly rotate the ship toward the target
  ship.quaternion.slerp(
    targetQuaternion.setFromUnitVectors(shipForward, targetDirection),
    AUTO_PILOT_TURN_RATE * deltaTime * 60
  );

  // Move ship forward along current orientation
  const forwardMovement = new Vector3(0, 0, -1)
    .applyQuaternion(ship.quaternion)
    .normalize()
    .multiplyScalar(SHIP_TRAVEL_SPEED * deltaTime);

  ship.position.add(forwardMovement);

  // Adjust height to smoothly approach target height
  const heightDiff = shipNavState.destination.y - ship.position.y;
  if (Math.abs(heightDiff) > 0.1) {
    ship.position.y +=
      Math.sign(heightDiff) *
      Math.min(
        AUTO_PILOT_VERTICAL_SPEED * deltaTime * 60,
        Math.abs(heightDiff)
      );
  }

  // Update animation progress for UI feedback
  const elapsed = performance.now() - shipNavState.travelStartTime;
  shipNavState.animationProgress = Math.min(
    1.0,
    distanceToTarget / ship.position.distanceTo(shipNavState.initialPosition)
  );

  // Update any UI elements showing navigation progress
  updateNavigationUI(shipNavState.animationProgress);
}

/**
 * Complete the navigation and scroll to the target section
 * @param {Object} playerModule - Player module with control functions
 */
function completeShipNavigation(playerModule) {
  // Restore original update function
  playerModule.updatePlayer =
    playerModule._originalUpdatePlayer || playerModule.updatePlayer;

  // Reset state
  shipNavState.isAutoPiloting = false;

  // Wait a short moment then scroll to the associated section
  setTimeout(() => {
    // Switch back to scroll view
    if (isGameView() && shipNavState.elements) {
      toggleGameView(shipNavState.elements);

      // After view transition, scroll to section
      setTimeout(() => {
        // Use the imported scrollToSection function
        scrollToSection(shipNavState.targetSection);

        // Resolve the navigation promise
        if (shipNavState.onArrivalCallback) {
          shipNavState.onArrivalCallback();
          shipNavState.onArrivalCallback = null;
        }
      }, 600);
    }
  }, 500);
}

/**
 * Update UI during navigation (can be expanded with progress bars, etc.)
 * @param {number} progress - Navigation progress (0-1)
 */
function updateNavigationUI(progress) {
  // Optional: Update UI elements showing navigation progress
  // For example, update a loading bar or journey status indicator
}

/**
 * Initialize ship navigation system
 * @returns {Object} Ship navigation API
 */
export function initShipNavigation() {
  // Get required DOM elements
  const elements = {
    viewToggleBtn: document.getElementById("view-toggle-btn"),
    mainGameCanvas: document.getElementById("main-game-canvas"),
    gameViewContainer: document.getElementById("game-view-container"),
    sidebar: document.querySelector(".sidebar"),
    body: document.body,
  };

  // Handle navigation link clicks in game view only
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".nav-link");
    if (link && isGameView()) {
      e.preventDefault();
      const sectionId = link.getAttribute("data-target");
      navigateShipToSection(sectionId, elements);
    }
  });

  return {
    navigateShipToSection: (sectionId) =>
      navigateShipToSection(sectionId, elements),
  };
}

import {
  addCallback,
  removeCallback,
  getInputState,
  getMovementVector,
  isMovementActive,
  isHorizontalMovementActive,
  isVerticalMovementActive,
  isAscending,
  isDescending,
} from "./input-manager.js";

// Store cleanup functions
let gameControlsCallbacks = [];
let isInitialized = false;
let statusUpdateInterval = null;

// Initialize Game Controls UI - toggles visibility and sets up interactions
export const initGameControlsUI = () => {
  if (isInitialized) return;

  const controlsBox = document.querySelector(".game-controls-info");
  if (!controlsBox) {
    console.warn("Game controls UI not found in DOM");
    return;
  }

  setupControlsInteraction(controlsBox);
  isInitialized = true;
};

// Show the game controls UI
export const showGameControls = () => {
  const controlsBox = document.querySelector(".game-controls-info");
  if (controlsBox) {
    controlsBox.style.display = "block";
    setTimeout(() => controlsBox.classList.add("visible"), 10);

    if (!isInitialized) {
      initGameControlsUI();
    }
  }
};

// Hide the game controls UI
export const hideGameControls = () => {
  const controlsBox = document.querySelector(".game-controls-info");
  if (controlsBox) {
    controlsBox.classList.remove("visible");
    setTimeout(() => (controlsBox.style.display = "none"), 300); // Allow transition
  }
};

// Toggle the game controls UI visibility
export const toggleGameControls = () => {
  const controlsBox = document.querySelector(".game-controls-info");
  if (controlsBox) {
    const isVisible =
      controlsBox.style.display !== "none" &&
      controlsBox.classList.contains("visible");

    if (isVisible) {
      hideGameControls();
    } else {
      showGameControls();
    }
  }
};

// Setup event handlers and input monitoring for airship controls
const setupControlsInteraction = (controlsBox) => {
  const closeBtn = controlsBox.querySelector(".close-btn");
  const toggleBtn = controlsBox.querySelector(".toggle-btn");
  const allKeys = controlsBox.querySelectorAll(".key[data-key]");

  if (!closeBtn || !toggleBtn) {
    console.warn("Control buttons not found");
    return;
  }

  // Setup keyboard highlighting with Map for O(1) lookups
  const keyMap = new Map();
  allKeys.forEach((el) => keyMap.set(el.dataset.key, el));

  // Event handlers
  const handleClose = () => hideGameControls();

  const handleToggle = () => {
    const content = controlsBox.querySelector(".controls-content");
    const collapsed = controlsBox.classList.toggle("collapsed");
    toggleBtn.textContent = collapsed ? "+" : "-";

    if (content) {
      content.style.display = collapsed ? "none" : "block";
    }
  };

  closeBtn.addEventListener("click", handleClose);
  toggleBtn.addEventListener("click", handleToggle);

  // Enhanced key highlighting with input state monitoring
  const updateKeyHighlight = (keyCode, isPressed) => {
    let normalizedKey = keyCode;
    // Handle right shift same as left for consistency
    if (normalizedKey === "ShiftRight" && keyMap.has("ShiftLeft")) {
      normalizedKey = "ShiftLeft";
    }

    const keyEl = keyMap.get(normalizedKey);
    if (keyEl) {
      keyEl.classList.toggle("active", isPressed);
    }
  };

  // Real-time status updates for airship movement
  const updateStatus = () => {
    // Only update if controls are visible
    if (controlsBox.style.display === "none") return;

    const movementStatusEl = controlsBox.querySelector("#movement-status");
    const activeKeysEl = controlsBox.querySelector("#active-keys");
    const altitudeStatusEl = controlsBox.querySelector("#altitude-status");

    if (movementStatusEl) {
      const isMoving = isMovementActive();
      const isHorizontalMoving = isHorizontalMovementActive();
      const isVerticalMoving = isVerticalMovementActive();

      let status = "Hovering";
      let statusAttr = "idle";

      if (isHorizontalMoving && isVerticalMoving) {
        status = "3D Maneuvering";
        statusAttr = "maneuvering";
      } else if (isHorizontalMoving) {
        status = "Cruising";
        statusAttr = "cruising";
      } else if (isVerticalMoving) {
        status = "Altitude Change";
        statusAttr = "altitude";
      }

      movementStatusEl.textContent = status;
      movementStatusEl.setAttribute("data-status", statusAttr);
    }

    if (altitudeStatusEl) {
      const ascending = isAscending();
      const descending = isDescending();

      let altitudeStatus = "Stable";
      let altitudeAttr = "stable";

      if (ascending && descending) {
        altitudeStatus = "Conflicted"; // Both keys pressed
        altitudeAttr = "conflicted";
      } else if (ascending) {
        altitudeStatus = "Ascending";
        altitudeAttr = "ascending";
      } else if (descending) {
        altitudeStatus = "Descending";
        altitudeAttr = "descending";
      }

      altitudeStatusEl.textContent = altitudeStatus;
      altitudeStatusEl.setAttribute("data-altitude", altitudeAttr);
    }

    if (activeKeysEl) {
      const inputState = getInputState();
      const activeKeyNames = inputState.pressedKeys.map((key) => {
        // Convert key codes to display names for airship controls
        const keyDisplayMap = {
          KeyW: "W",
          KeyA: "A",
          KeyS: "S",
          KeyD: "D",
          ArrowUp: "↑",
          ArrowDown: "↓",
          ArrowLeft: "←",
          ArrowRight: "→",
          ShiftLeft: "Ascend",
          ShiftRight: "Ascend",
          Space: "Descend",
          Escape: "Esc",
          KeyR: "R",
        };
        return keyDisplayMap[key] || key;
      });

      activeKeysEl.textContent =
        activeKeyNames.length > 0 ? activeKeyNames.join(", ") : "None";
    }

    // Update movement vector display if element exists
    const vectorDisplayEl = controlsBox.querySelector("#movement-vector");
    if (vectorDisplayEl) {
      const vector = getMovementVector();
      const vectorText = `X: ${vector.x.toFixed(2)}, Y: ${vector.y.toFixed(
        2
      )}, Z: ${vector.z.toFixed(2)}`;
      vectorDisplayEl.textContent = vectorText;
    }
  };

  // Add callbacks to InputManager for key highlighting
  const keydownCallback = (keyCode) => {
    updateKeyHighlight(keyCode, true);
    updateStatus();
  };

  const keyupCallback = (keyCode) => {
    updateKeyHighlight(keyCode, false);
    updateStatus();
  };

  addCallback("keydown", keydownCallback);
  addCallback("keyup", keyupCallback);

  // Start status update loop (only when visible)
  statusUpdateInterval = setInterval(updateStatus, 100);

  // Store callbacks for cleanup
  gameControlsCallbacks.push(
    () => removeCallback("keydown", keydownCallback),
    () => removeCallback("keyup", keyupCallback),
    () => closeBtn.removeEventListener("click", handleClose),
    () => toggleBtn.removeEventListener("click", handleToggle),
    () => clearInterval(statusUpdateInterval)
  );

  // Initialize status
  updateStatus();
};

// Enhanced debug function that shows real-time airship input state
export const logDebugInfo = (airshipEntity) => {
  const inputState = getInputState();
  const movement = getMovementVector();

  console.log("=== Airship Debug Info ===");
  console.log("Input State:", inputState);
  console.log("Airship Position:", airshipEntity?.position);
  console.log("Movement Vector (3D):", movement);
  console.log("Is Moving:", isMovementActive());
  console.log("Is Horizontal Moving:", isHorizontalMovementActive());
  console.log("Is Vertical Moving:", isVerticalMovementActive());
  console.log("Is Ascending:", isAscending());
  console.log("Is Descending:", isDescending());
  console.log("Pressed Keys:", inputState.pressedKeys);
  console.log("Key State Binary:", inputState.keyState);
  console.log("========================");
};

// Function to manually update all key states (useful for initialization)
export const updateAllKeyStates = () => {
  const inputState = getInputState();
  const allKeys = document.querySelectorAll(".key[data-key]");

  allKeys.forEach((keyEl) => {
    const keyCode = keyEl.dataset.key;
    let normalizedKey = keyCode;

    // Handle right shift normalization
    if (normalizedKey === "ShiftRight") {
      normalizedKey = "ShiftLeft";
    }

    const isPressed = inputState.pressedKeys.includes(normalizedKey);
    keyEl.classList.toggle("active", isPressed);
  });
};

// New function to get airship-specific movement status
export const getAirshipMovementStatus = () => {
  const vector = getMovementVector();
  const isMoving = isMovementActive();
  const isHorizontalMoving = isHorizontalMovementActive();
  const isVerticalMoving = isVerticalMovementActive();
  const ascending = isAscending();
  const descending = isDescending();

  return {
    vector,
    isMoving,
    isHorizontalMoving,
    isVerticalMoving,
    ascending,
    descending,
    status: isMoving
      ? isHorizontalMoving && isVerticalMoving
        ? "3D Maneuvering"
        : isHorizontalMoving
        ? "Cruising"
        : "Altitude Change"
      : "Hovering",
  };
};

// Cleanup function to remove all event listeners and intervals
export const cleanupGameControlsUI = () => {
  gameControlsCallbacks.forEach((cleanup) => cleanup());
  gameControlsCallbacks = [];
  isInitialized = false;

  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
};

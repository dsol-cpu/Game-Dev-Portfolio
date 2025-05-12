/**
 * Model-based orbit controls implementation
 * Simulates camera orbit controls but directly manipulates the model instead
 */
class ModelOrbitControls {
  constructor(model, domElement) {
    this.model = model;
    this.domElement = domElement;

    // Create a pivot object to help with rotation
    this.pivot = {
      rotation: { x: 0, y: 0, z: 0 },
    };

    // Store original model properties
    this.originalScale = model.scale.clone();
    this.currentScale = model.scale.clone();

    // Rotation speed factors
    this.rotateSpeed = 1.0;

    // Damping/inertia
    this.enableDamping = true;
    this.dampingFactor = 0.1;

    // Zoom
    this.enableZoom = true;
    this.zoomSpeed = 1.0;
    this.minScale = 0.1; // Minimum scale factor
    this.maxScale = 5.0; // Maximum scale factor

    // Rotation limits
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // Current state
    this.spherical = {
      phi: 0, // polar angle (vertical rotation)
      theta: 0, // azimuthal angle (horizontal rotation)
    };

    // For damping
    this.sphericalDelta = {
      phi: 0,
      theta: 0,
    };

    // For drag handling
    this.rotateStart = { x: 0, y: 0 };
    this.rotateEnd = { x: 0, y: 0 };
    this.rotateDelta = { x: 0, y: 0 };

    // Zoom state
    this.scaleTarget = 1;
    this.scaleFactor = 1;

    // Flags
    this.isRotating = false;

    // Bind event handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);

    // Add event listeners
    this.domElement.addEventListener("mousedown", this.onMouseDown);
    this.domElement.addEventListener("wheel", this.onMouseWheel);

    // Initialize
    this.update();
  }

  // Save initial state and start rotation
  onMouseDown(event) {
    if (event.button !== 0) return; // Left click only

    this.isRotating = true;

    this.rotateStart.x = event.clientX;
    this.rotateStart.y = event.clientY;

    // Change cursor
    this.domElement.style.cursor = "grabbing";

    // Disable any automatic rotation
    if (this.model.userData) {
      this.model.userData.animate = false;
    }

    // Add global event listeners
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);

    // Prevent default to avoid text selection
    event.preventDefault();
  }

  // Handle rotation
  onMouseMove(event) {
    if (!this.isRotating) return;

    this.rotateEnd.x = event.clientX;
    this.rotateEnd.y = event.clientY;

    // Calculate how much we moved
    this.rotateDelta.x = this.rotateEnd.x - this.rotateStart.x;
    this.rotateDelta.y = this.rotateEnd.y - this.rotateStart.y;

    // Update for next move event
    this.rotateStart.x = this.rotateEnd.x;
    this.rotateStart.y = this.rotateEnd.y;

    // Adjust rotation delta based on speed
    this.sphericalDelta.theta -=
      ((2 * Math.PI * this.rotateDelta.x) / this.domElement.clientWidth) *
      this.rotateSpeed;
    this.sphericalDelta.phi -=
      ((2 * Math.PI * this.rotateDelta.y) / this.domElement.clientHeight) *
      this.rotateSpeed;

    this.update();
  }

  // End rotation
  onMouseUp() {
    this.isRotating = false;

    // Reset cursor
    this.domElement.style.cursor = "pointer";

    // Re-enable automatic rotation if needed
    if (this.model.userData && this.model.userData.autoRotate !== false) {
      this.model.userData.animate = true;
    }

    // Remove global event listeners
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
  }

  // Handle zoom
  onMouseWheel(event) {
    if (!this.enableZoom) return;

    event.preventDefault();

    // Calculate zoom direction
    const delta = event.deltaY > 0 ? 0.95 : 1.05;

    // Apply zoom
    this.scaleFactor *= delta;

    // Limit zoom
    this.scaleFactor = Math.max(
      this.minScale,
      Math.min(this.maxScale, this.scaleFactor)
    );

    this.update();
  }

  // Perform the orbital calculations and update model rotation/scale
  update() {
    // Apply rotation changes
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;

    // Apply constraints
    this.spherical.phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, this.spherical.phi)
    );

    // Apply damping
    if (this.enableDamping) {
      this.sphericalDelta.theta *= 1 - this.dampingFactor;
      this.sphericalDelta.phi *= 1 - this.dampingFactor;
    } else {
      this.sphericalDelta.theta = 0;
      this.sphericalDelta.phi = 0;
    }

    // Update pivot (virtual object to help with rotation)
    this.pivot.rotation.y = this.spherical.theta;
    this.pivot.rotation.x = this.spherical.phi;

    // Apply pivot rotation to model
    // Using quaternions for smooth rotation that doesn't cause gimbal lock
    const quaternionX = new THREE.Quaternion();
    quaternionX.setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.pivot.rotation.x
    );

    const quaternionY = new THREE.Quaternion();
    quaternionY.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.pivot.rotation.y
    );

    // Combine rotations (Y first, then X)
    const finalQuaternion = new THREE.Quaternion();
    finalQuaternion.multiplyQuaternions(quaternionY, quaternionX);

    // Apply quaternion to model
    this.model.quaternion.copy(finalQuaternion);

    // Apply scale
    if (this.scaleFactor !== 1) {
      // Calculate new scale based on original scale
      this.currentScale
        .copy(this.originalScale)
        .multiplyScalar(this.scaleFactor);
      this.model.scale.copy(this.currentScale);
    }

    // Update matrices
    this.model.updateMatrix();
    this.model.updateMatrixWorld(true);

    return true;
  }

  // Reset to initial state
  reset() {
    // Reset rotation
    this.spherical.theta = 0;
    this.spherical.phi = 0;
    this.sphericalDelta.theta = 0;
    this.sphericalDelta.phi = 0;

    // Reset scale
    this.scaleFactor = 1;
    this.model.scale.copy(this.originalScale);
    this.currentScale.copy(this.originalScale);

    this.update();
  }

  // Set model scale
  setScale(scale) {
    this.scaleFactor = scale;
    this.currentScale.copy(this.originalScale).multiplyScalar(this.scaleFactor);
    this.model.scale.copy(this.currentScale);
    this.model.updateMatrix();
    this.model.updateMatrixWorld(true);
  }

  // Remove event listeners when no longer needed
  dispose() {
    this.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.domElement.removeEventListener("wheel", this.onMouseWheel);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
  }
}

/**
 * Implementation for model interactions
 */
function setupModelInteraction(state) {
  // Create a map to store orbit controls for each model
  const modelControlsMap = new Map();

  // Setup orbit controls for each model
  projectModels.forEach((model, modelName) => {
    const viewWindow = document.querySelector(
      `.model-view-window[data-model-name="${modelName}"]`
    );
    if (!viewWindow) return;

    // Create model orbit controls
    const controls = new ModelOrbitControls(model, viewWindow);

    // Store original properties
    if (!model.userData) model.userData = {};
    model.userData.originalScale = model.scale.clone();
    model.userData.currentScale = model.scale.clone();

    // Set constraints for better user experience
    controls.minPolarAngle = Math.PI / 6; // Limit top view
    controls.maxPolarAngle = (Math.PI * 5) / 6; // Limit bottom view
    controls.rotateSpeed = 0.75; // Slightly slower rotation for more control
    controls.dampingFactor = 0.15; // Smooth deceleration

    // Store the controls reference
    modelControlsMap.set(modelName, controls);

    // Add to model's userData for later reference
    model.userData.orbitControls = controls;
  });

  // Handle window resize to update models
  window.addEventListener("resize", () => {
    if (canvas) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      // Update positions
      cacheViewWindowPositions();
      updateModelPositions();

      renderFrame();
    }
  });

  // Return the controls map for reference elsewhere
  return modelControlsMap;
}

/**
 * Setup card-based interactions
 */
function setupCardInteraction() {
  // Add interaction to each model view window
  document.querySelectorAll(".model-view-window").forEach((viewWindow) => {
    const modelName = viewWindow.dataset.modelName;
    if (!modelName) return;

    const model = projectModels.get(modelName);
    if (!model?.userData.orbitControls) return;

    // Add visual feedback for interaction
    viewWindow.addEventListener("mouseenter", () => {
      viewWindow.querySelector(".model-interaction-hint").style.opacity = "0.7";
      viewWindow.style.cursor = "pointer";
    });

    viewWindow.addEventListener("mouseleave", () => {
      viewWindow.querySelector(".model-interaction-hint").style.opacity = "0";
      viewWindow.style.cursor = "";
    });
  });
}

/**
 * Reset a model to its default position
 */
function resetModelPosition(model) {
  if (!model?.userData.orbitControls) return;

  const controls = model.userData.orbitControls;

  // Reset controls
  controls.reset();

  // Make sure any auto rotation is re-enabled
  if (model.userData && model.userData.autoRotate !== false) {
    model.userData.animate = true;
  }

  // Update matrices
  model.updateMatrix();
  model.updateMatrixWorld(true);
}

/**
 * Reset view for all models
 */
function resetView() {
  currentFocusedProject = null;

  // Cancel any ongoing animations
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Reset all models' positions and scales
  projectModels.forEach((model) => {
    resetModelPosition(model);
  });

  // Reposition models to their view windows
  cacheViewWindowPositions();
  updateModelPositions();
  setupModelRotationAnimations();

  // Remove highlighting
  document.querySelectorAll(".portfolio-item").forEach((el) => {
    el.classList.remove("focused");
  });

  handleUserInteraction();
}

/**
 * Update model positions based on view windows
 */
function updateModelPositions() {
  projectModels.forEach((model, modelName) => {
    const viewPosition = viewWindowPositions.get(modelName);
    if (!viewPosition) return;

    // Position the model in its view window
    model.position.set(viewPosition.x, viewPosition.y, viewPosition.z);

    // Update matrices
    model.updateMatrix();
    model.updateMatrixWorld(true);
  });

  renderFrame();
}

/**
 * Setup automatic rotation animations for models
 */
function setupModelRotationAnimations() {
  projectModels.forEach((model) => {
    // Enable auto rotation by default
    if (!model.userData) model.userData = {};
    model.userData.animate = true;
    model.userData.autoRotate = true;
    model.userData.rotationSpeed = 0.005;
  });

  // Animation loop
  function animateModels() {
    let needsRender = false;

    projectModels.forEach((model) => {
      if (model.userData?.animate) {
        // Apply gentle rotation around Y axis
        model.rotation.y += model.userData.rotationSpeed || 0.005;
        needsRender = true;
      }
    });

    if (needsRender) {
      renderFrame();
    }

    animationFrameId = requestAnimationFrame(animateModels);
  }

  // Start animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = requestAnimationFrame(animateModels);
}

import * as THREE from "three";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { navigationStore } from "../stores/navigation";

// Component to create a 3D UI popup when the ship arrives at an island
export function useIslandArrivalPopup(scene) {
  const [popupMesh, setPopupMesh] = createSignal(null);
  const [isShowing, setIsShowing] = createSignal(false);
  const [currentIslandData, setCurrentIslandData] = createSignal(null);

  // Get navigation information from the store
  const { isArrived, destinationSection, isNavigating } = navigationStore;

  // Initialize popup mesh
  const initPopup = () => {
    if (!scene) return;

    // Create a group to hold popup elements
    const group = new THREE.Group();

    // Create cube for the popup body
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 0.2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.8,
      flatShading: true,
    });

    const cube = new THREE.Mesh(geometry, material);

    // Add highlight border
    const borderGeometry = new THREE.BoxGeometry(1.6, 1.6, 0.19);
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.9,
      wireframe: true,
    });

    const border = new THREE.Mesh(borderGeometry, borderMaterial);

    // Create text for the popup
    // We'll use a canvas texture for text
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");

    const textTexture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
    });

    const textPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      textMaterial
    );
    textPlane.position.z = 0.11;

    // Add all elements to the group
    group.add(cube);
    group.add(border);
    group.add(textPlane);

    // Start with the popup hidden
    group.visible = false;

    // Add to scene
    scene.add(group);

    // Store the group and text-related objects for updates
    setPopupMesh({
      group,
      textCanvas: canvas,
      textContext: context,
      textTexture: textTexture,
      textPlane: textPlane,
    });

    return group;
  };

  // Update text on the popup
  const updatePopupText = (text, subtitle = "") => {
    const popup = popupMesh();
    if (!popup) return;

    const { textContext, textTexture } = popup;

    // Clear the canvas
    textContext.clearRect(0, 0, 256, 256);

    // Set background
    textContext.fillStyle = "rgba(52, 73, 94, 0.7)";
    textContext.fillRect(10, 10, 236, 236);

    // Draw border
    textContext.strokeStyle = "#f1c40f";
    textContext.lineWidth = 4;
    textContext.strokeRect(10, 10, 236, 236);

    // Draw title
    textContext.fillStyle = "#ffffff";
    textContext.font = "bold 24px Arial";
    textContext.textAlign = "center";
    textContext.fillText("ARRIVED AT", 128, 70);

    // Draw island name
    textContext.fillStyle = "#f1c40f";
    textContext.font = "bold 32px Arial";
    textContext.fillText(text, 128, 130);

    // Draw subtitle if provided
    if (subtitle) {
      textContext.fillStyle = "#ecf0f1";
      textContext.font = "18px Arial";
      textContext.fillText(subtitle, 128, 180);
    }

    // Update the texture
    textTexture.needsUpdate = true;
  };

  // Show popup with animation
  const showPopup = (islandData) => {
    const popup = popupMesh();
    if (!popup) return;

    setCurrentIslandData(islandData);
    setIsShowing(true);

    const { group } = popup;

    // Position popup above the island
    group.position.copy(islandData.position);
    group.position.y += 5; // Position above island

    // Make visible
    group.visible = true;

    // Animate popup appearing
    group.scale.set(0.01, 0.01, 0.01);

    // Setup animation
    const animateIn = () => {
      if (!isShowing()) return;

      const targetScale = 1;
      const currentScale = group.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.1;

      group.scale.set(newScale, newScale, newScale);

      if (Math.abs(targetScale - newScale) > 0.01) {
        requestAnimationFrame(animateIn);
      }
    };

    // Update text
    updatePopupText(islandData.name, islandData.section);

    // Start animation
    animateIn();

    // Auto-hide after delay
    setTimeout(() => {
      hidePopup();
    }, 5000);
  };

  // Hide popup with animation
  const hidePopup = () => {
    const popup = popupMesh();
    if (!popup || !isShowing()) return;

    setIsShowing(false);

    const { group } = popup;

    // Setup animation
    const animateOut = () => {
      if (isShowing()) return;

      const targetScale = 0.01;
      const currentScale = group.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.2;

      group.scale.set(newScale, newScale, newScale);

      if (currentScale > 0.05) {
        requestAnimationFrame(animateOut);
      } else {
        group.visible = false;
      }
    };

    // Start animation
    animateOut();
  };

  // Hook into the navigation system
  const setupNavigationListener = (islands) => {
    // Create an effect to monitor arrival state
    createEffect(() => {
      if (isArrived() && !isNavigating() && destinationSection()) {
        // Find the island data that matches the destination section
        const islandData = islands.find(
          (island) => island.userData.type === destinationSection()
        );

        if (islandData) {
          showPopup({
            position: islandData.position.clone(),
            name: islandData.userData.name || "Island",
            section: islandData.userData.type || "Unknown",
          });
        }
      }
    });
  };

  // Update position/rotation in animation loop
  const update = (camera) => {
    const popup = popupMesh();
    if (!popup || !isShowing() || !popup.group.visible) return;

    // Make popup face the camera
    if (camera) {
      popup.group.lookAt(camera.position);
    }

    // Add some floating animation
    const time = Date.now() * 0.001;
    popup.group.position.y += Math.sin(time * 2) * 0.005;
  };

  // Cleanup
  onCleanup(() => {
    const popup = popupMesh();
    if (popup && popup.group && scene) {
      scene.remove(popup.group);
    }
  });

  return {
    initPopup,
    showPopup,
    hidePopup,
    setupNavigationListener,
    update,
  };
}

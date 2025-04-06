import { createSignal, onMount, onCleanup } from "solid-js";
import * as THREE from "three";
import { setupScene } from "../utils/setupScene";
import { createElements } from "../utils/createElements";
import { animateScene } from "../utils/animateScene";
import { ISLAND_DATA } from "../constants/world";

/**
 * Core hook for managing the Three.js scene
 */
export function useThreeScene(containerRef) {
  const [scene, setScene] = createSignal(null);
  const [camera, setCamera] = createSignal(null);
  const [renderer, setRenderer] = createSignal(null);
  const [clouds, setClouds] = createSignal([]);
  const [islands, setIslands] = createSignal([]);
  const [ship, setShip] = createSignal(null);
  const [animationId, setAnimationId] = createSignal(null);
  const [shipHeight, setShipHeight] = createSignal(0);

  // Initialize scene
  const initScene = () => {
    // Get container DOM element properly
    const container = containerRef();
    if (!container) return;

    const sceneData = setupScene(container);
    setScene(sceneData.scene);
    setCamera(sceneData.camera);
    setRenderer(sceneData.renderer);

    const elements = createElements(sceneData.scene);
    setClouds(elements.clouds);
    setIslands(elements.islands);
    setShip(elements.ship);

    // Position and label islands
    if (elements.islands.length >= ISLAND_DATA.length) {
      elements.islands.forEach((island, i) => {
        if (i < ISLAND_DATA.length) {
          island.position.copy(ISLAND_DATA[i].position);

          // Add visual marker for island
          const markerGeometry = new THREE.ConeGeometry(0.5, 2, 8);
          const markerMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0x444400,
          });
          const marker = new THREE.Mesh(markerGeometry, markerMaterial);
          marker.position.y = 3;
          island.add(marker);
        }
      });
    }

    // Set initial height
    if (elements.ship) {
      setShipHeight(elements.ship.position.y);
    }

    // Handle window resize
    const handleResize = () => {
      if (!container || !sceneData.camera || !sceneData.renderer) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      sceneData.camera.aspect = width / height;
      sceneData.camera.updateProjectionMatrix();
      sceneData.renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // Animation cleanup function
    const cleanup = () => {
      window.removeEventListener("resize", handleResize);

      if (animationId()) {
        cancelAnimationFrame(animationId());
        setAnimationId(null);
      }

      if (sceneData.renderer) {
        sceneData.renderer.dispose();
        if (container.contains(sceneData.renderer.domElement)) {
          container.removeChild(sceneData.renderer.domElement);
        }
      }
    };

    return cleanup;
  };

  // Animation frame function (customizable with passed functions)
  const startAnimation = (updateCallbacks = []) => {
    const animate = () => {
      const currentId = requestAnimationFrame(animate);
      setAnimationId(currentId);

      // Execute all update callbacks
      if (Array.isArray(updateCallbacks)) {
        updateCallbacks.forEach((update) => {
          if (typeof update === "function") {
            update();
          }
        });
      }

      // Update scene animations and render
      const currentScene = scene();
      const currentCamera = camera();
      const currentRenderer = renderer();

      if (currentScene && currentCamera && currentRenderer) {
        animateScene(clouds(), islands(), ship());
        currentRenderer.render(currentScene, currentCamera);
      }
    };

    animate();
  };

  return {
    scene: () => scene(),
    camera: () => camera(),
    renderer: () => renderer(),
    clouds: () => clouds(),
    islands: () => islands(),
    ship: () => ship(),
    shipHeight: () => shipHeight(),
    setShipHeight,
    initScene,
    startAnimation,
  };
}

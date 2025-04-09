import { createSignal } from "solid-js";
import * as THREE from "three";
import { setupScene } from "../utils/setupScene";
import { createElements } from "../utils/createElements";
import { animateScene } from "../utils/animateScene";
import { ISLAND_DATA } from "../constants/world";

/**
 * Core hook for managing the Three.js scene
 */
export function useThreeScene(containerRefFn) {
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
    // Cancel any existing animation before reinitializing
    cancelAnimation();

    // Get container DOM element
    const container = containerRefFn();
    if (!container) {
      console.warn("Container reference is not available for Three.js scene");
      return () => {};
    }

    try {
      const sceneData = setupScene(container);

      // Store scene components
      setScene(sceneData.scene);
      setCamera(sceneData.camera);
      setRenderer(sceneData.renderer);

      // Create scene elements
      const elements = createElements(sceneData.scene);
      setClouds(elements.clouds || []);
      setIslands(elements.islands || []);
      setShip(elements.ship || null);

      // Set initial height
      if (elements.ship) {
        setShipHeight(elements.ship.position.y);
      }

      return cleanup;
    } catch (error) {
      console.error("Error initializing Three.js scene:", error);
      return cleanup;
    }
  };

  // Cleanup function for scene resources
  const cleanup = () => {
    cancelAnimation();

    // Dispose renderer and remove from DOM if exists
    const currentRenderer = renderer();
    const container = containerRefFn();

    if (currentRenderer) {
      currentRenderer.dispose();

      if (container && container.contains(currentRenderer.domElement)) {
        container.removeChild(currentRenderer.domElement);
      }
    }

    // Clear all signals
    setScene(null);
    setCamera(null);
    setRenderer(null);
    setClouds([]);
    setIslands([]);
    setShip(null);
  };

  // Cancel any ongoing animation
  const cancelAnimation = () => {
    const currentAnimationId = animationId();
    if (currentAnimationId !== null) {
      cancelAnimationFrame(currentAnimationId);
      setAnimationId(null);
    }
  };

  // Animation frame function (customizable with passed functions)
  const startAnimation = (updateCallbacks = []) => {
    // Cancel any existing animation before starting a new one
    cancelAnimation();

    const animate = () => {
      const currentId = requestAnimationFrame(animate);
      setAnimationId(currentId);

      // Execute all update callbacks
      if (Array.isArray(updateCallbacks)) {
        updateCallbacks.forEach((update) => {
          if (typeof update === "function") {
            try {
              update();
            } catch (error) {
              console.error("Error in animation update callback:", error);
            }
          }
        });
      }

      // Update scene animations and render
      const currentScene = scene();
      const currentCamera = camera();
      const currentRenderer = renderer();

      if (currentScene && currentCamera && currentRenderer) {
        try {
          animateScene(clouds(), islands(), ship());
          currentRenderer.render(currentScene, currentCamera);
        } catch (error) {
          console.error("Error in scene animation/rendering:", error);
        }
      }
    };

    animate();
  };

  return {
    scene,
    camera,
    renderer,
    clouds,
    islands,
    ship,
    shipHeight,
    setShipHeight,
    initScene,
    startAnimation,
    cancelAnimation,
    cleanup,
  };
}

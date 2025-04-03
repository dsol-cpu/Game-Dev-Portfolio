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
    if (!containerRef) return;

    const sceneData = setupScene(containerRef);
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
      if (!containerRef || !sceneData.camera || !sceneData.renderer) return;
      sceneData.camera.aspect =
        containerRef.clientWidth / containerRef.clientHeight;
      sceneData.camera.updateProjectionMatrix();
      sceneData.renderer.setSize(
        containerRef.clientWidth,
        containerRef.clientHeight
      );
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationId()) {
        cancelAnimationFrame(animationId());
      }
      if (sceneData.renderer) {
        sceneData.renderer.dispose();
        if (containerRef.contains(sceneData.renderer.domElement)) {
          containerRef.removeChild(sceneData.renderer.domElement);
        }
      }
    };
  };

  // Animation frame function (customizable with passed functions)
  const startAnimation = (updateCallbacks) => {
    const animate = () => {
      const currentId = requestAnimationFrame(animate);
      setAnimationId(currentId);

      // Execute all update callbacks
      if (updateCallbacks && Array.isArray(updateCallbacks)) {
        for (const update of updateCallbacks) {
          if (typeof update === "function") {
            update();
          }
        }
      }

      // Update scene animations and render
      if (scene() && camera() && renderer()) {
        animateScene(clouds(), islands(), ship());
        renderer().render(scene(), camera());
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
  };
}

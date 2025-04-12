import { createEffect, onMount, onCleanup } from "solid-js";
import {
  createModelManager,
  createScene,
  loadModelForScene,
} from "./modelManager";

const Model = (props) => {
  let containerRef;
  let sceneInfo;

  // Initialize the model manager
  const modelStore = createModelManager();

  // Configure default props with sensible defaults
  const getConfig = () => ({
    name: props.name || "cube",
    backgroundColor: props.backgroundColor || 0x000000,
    size: props.size || "100%",
    allowZoom: props.allowZoom !== undefined ? props.allowZoom : true,
    allowPan: props.allowPan !== undefined ? props.allowPan : true,
    rotate: props.rotate !== undefined ? props.rotate : true,
    rotationSpeed: props.rotationSpeed || 1,
    pulse: props.pulse !== undefined ? props.pulse : false,
    pixelRatio: props.pixelRatio || Math.min(window.devicePixelRatio, 2),
    variant: props.variant || "primary",
    shape: props.shape || "cube",
    forcePrimitive: props.forcePrimitive || false,
    lowPolyMode: props.lowPolyMode || false,
    throttleFPS: props.throttleFPS || 60,
    onError: props.onError,
    onLoaded: props.onLoaded,
  });

  // Setup on mount
  onMount(() => {
    if (containerRef) {
      // Make sure container has an ID
      if (!containerRef.id) {
        containerRef.id = `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Create the scene through modelManager
      sceneInfo = createScene(containerRef, getConfig());

      // Load model
      loadModelForScene(containerRef.id, getConfig().name, getConfig());
    }
  });

  // Effect to reload model when name or shape changes
  createEffect(() => {
    const { name, shape, forcePrimitive } = getConfig();

    if (containerRef && containerRef.id && modelStore.scenes[containerRef.id]) {
      loadModelForScene(containerRef.id, name, getConfig());
    }
  });

  // Effect to update background color when changed
  createEffect(() => {
    const { backgroundColor } = getConfig();

    if (containerRef && containerRef.id && modelStore.scenes[containerRef.id]) {
      modelStore.scenes[containerRef.id].background = new THREE.Color(
        backgroundColor
      );
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (sceneInfo) {
      sceneInfo.cleanup();
    }
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: getConfig().size,
        height: getConfig().size,
        position: "relative",
      }}
    />
  );
};

export default Model;

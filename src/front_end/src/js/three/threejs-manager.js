import { initRenderer, startAnimation } from "./renderer-core";
import { initAboutCanvas } from "./about";
import { initGame } from "./game";
import {
  getVisibleProjectModels,
  initPortfolioCanvases,
  initProjectCardScene,
} from "./project-cards";
import { preloadProjectModels } from "./model-manager";
import { activateAllCameras, getCamerasByCategory } from "./camera-registry";
import { CAMERA_SECTIONS } from "../data/sections";

export function initThreeJS() {
  initRenderer();
  // Get visible projects and initialize
  const visibleProjects = getVisibleProjectModels();

  const initSequence = async () => {
    try {
      await preloadProjectModels(visibleProjects.slice(0, 3), visibleProjects);
      await initAboutCanvas();
      console.info(
        "initialized about canvas and registered its camera! ",
        getCamerasByCategory(CAMERA_SECTIONS.ABOUT)
      );
      initPortfolioCanvases();
      activateAllCameras();

      startAnimation();

      // Load remaining models
      return preloadProjectModels(visibleProjects.slice(3), visibleProjects);
    } catch (error) {
      console.error("Init error:", error);
    }
  };

  initGame();
  initProjectCardScene();
  initSequence();
}

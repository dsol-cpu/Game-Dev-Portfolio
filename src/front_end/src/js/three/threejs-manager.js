import { initRenderer, startAnimation } from "./renderer-core";
import { initAboutCanvas } from "./about";
import { initGame } from "./game";
import {
  getVisibleProjectModels,
  initPortfolioCanvases,
} from "./project-cards";
import { preloadProjectModels } from "./model-manager";
import { activateAllCameras } from "./camera-registry";

export function initThreeJS() {
  initRenderer();
  // Get visible projects and initialize
  const visibleProjects = getVisibleProjectModels();

  const initSequence = async () => {
    try {
      await preloadProjectModels(visibleProjects.slice(0, 3), visibleProjects);
      initAboutCanvas();
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
  initSequence();
}

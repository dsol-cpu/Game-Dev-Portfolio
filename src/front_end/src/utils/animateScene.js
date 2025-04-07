import { ISLAND_DATA } from "../constants/world";

export const animateScene = (() => {
  // Precalculated values for performance
  const cloudSpeeds = [0.005, 0.01, 0.015];
  const boundaryX = 30;
  const bobScale = 0.2;

  return (clouds, islands) => {
    // Single calculation of time per frame
    const currentTime = Date.now() * 0.0005;

    // Animate clouds
    for (let i = 0, len = clouds.length; i < len; i++) {
      const cloud = clouds[i];
      cloud.position.x += cloudSpeeds[i % 3];

      // Reset cloud position when it moves out of view
      if (cloud.position.x > boundaryX) {
        cloud.position.x = -boundaryX;
      }
    }

    // Animate islands with bobbing effect
    for (let i = 0, len = islands.length; i < len; i++) {
      if (i < ISLAND_DATA.length) {
        islands[i].position.y =
          ISLAND_DATA[i].position.y + Math.sin(currentTime + i) * bobScale;
      }
    }
  };
})();

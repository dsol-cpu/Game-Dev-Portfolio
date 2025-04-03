import * as THREE from "three";

export const animateScene = (clouds, islands, ship) => {
  // Animate clouds
  clouds.forEach((cloud, i) => {
    cloud.position.x += 0.005 * ((i % 3) + 1);
    if (cloud.position.x > 30) cloud.position.x = -30;
  });

  // Gently bob islands up and down
  islands.forEach((island, i) => {
    island.position.y = -1 + Math.sin(Date.now() * 0.0005 + i) * 0.2;
  });

  // Note: Ship movement is handled in shipControls.js
};

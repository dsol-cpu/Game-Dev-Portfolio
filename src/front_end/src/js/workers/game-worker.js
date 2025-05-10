self.onmessage = (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "calculateIslandAnimations":
      const results = calculateIslandBobbing(data);
      self.postMessage({
        type: "islandAnimationsComplete",
        results,
      });
      break;

    case "pathfinding":
      const path = findPath(data);
      self.postMessage({
        type: "pathfindingComplete",
        path,
      });
      break;

    case "precalculateCameraPaths":
      const cameraPaths = precalculateCameraPaths(data);
      self.postMessage({
        type: "cameraPathsComplete",
        cameraPaths,
      });
      break;
  }
};

// Calculation functions
function calculateIslandBobbing({ islands, totalTime, deltaTime }) {
  const results = [];

  for (let i = 0; i < islands.length; i++) {
    const island = islands[i];
    const data = island.animationData;

    if (data) {
      const newY =
        data.initialY +
        Math.sin(totalTime * data.frequency + data.offset) * data.amplitude;

      const smoothingFactor = 0.05 * Math.min(1, deltaTime * 60);
      const updatedY =
        island.currentY + (newY - island.currentY) * smoothingFactor;

      results.push({
        index: i,
        newY: updatedY,
      });
    }
  }

  return results;
}

function findPath({ start, end, obstacles }) {
  // A* pathfinding algorithm implementation
  // This would be more complex in a real implementation

  // Simulate processing time
  let points = [];
  let current = { ...start };
  const totalSteps = 10;

  for (let i = 0; i <= totalSteps; i++) {
    points.push({ ...current });
    current.x += (end.x - start.x) / totalSteps;
    current.y += (end.y - start.y) / totalSteps;
    current.z += (end.z - start.z) / totalSteps;
  }

  return points;
}

function precalculateCameraPaths({
  playerPosition,
  targetPosition,
  obstacles,
}) {
  // Calculate optimal camera paths for different scenarios
  // This could be computationally expensive with complex environments

  // Simplified implementation
  const paths = [];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  for (const angle of angles) {
    const radians = (angle * Math.PI) / 180;
    const distance = 5; // Camera distance

    const cameraX = playerPosition.x + Math.sin(radians) * distance;
    const cameraZ = playerPosition.z + Math.cos(radians) * distance;
    const cameraY = playerPosition.y + 2; // Slightly above player

    paths.push({
      angle,
      position: { x: cameraX, y: cameraY, z: cameraZ },
      // Additional data like collision info could be included
    });
  }

  return paths;
}

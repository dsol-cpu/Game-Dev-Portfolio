import {
  Vector3,
  MathUtils,
  Raycaster,
} from "../extern/three/three.module.min.js";

// Configuration
const CONFIG = {
  DIST_MIN: 3,
  DIST_MAX: 15,
  DIST_DEFAULT: 8,
  HEIGHT_TARGET: 0.8,
  HEIGHT_CAMERA: 1.5,
  COLL_BUFFER: 0.15,
  ZOOM_FACTOR: 0.5,
};

// Reusable objects
const tempVectors = {
  target: new Vector3(),
  camera: new Vector3(),
  rayDir: new Vector3(),
  lookAt: new Vector3(),
};

const raycaster = new Raycaster();
raycaster.layers.mask = 1;
const intersects = [];

// State
let distance = CONFIG.DIST_DEFAULT;
let useCollision = true;
let camera, target, scene;

// Optimized wheel handler
const onWheel = (e) => {
  const delta = Math.sign(e.deltaY) * CONFIG.ZOOM_FACTOR;
  if (delta) {
    distance = MathUtils.clamp(
      distance + delta,
      CONFIG.DIST_MIN,
      CONFIG.DIST_MAX
    );
  }
};

// Streamlined collision detection
function checkCollision(targetPos, cameraPos) {
  if (!useCollision || !scene) return;

  const rayDir = tempVectors.rayDir
    .subVectors(cameraPos, targetPos)
    .normalize();
  raycaster.set(targetPos, rayDir);
  raycaster.far = distance;

  intersects.length = 0;
  raycaster.intersectObjects(scene.children, true, intersects);

  if (intersects[0]) {
    const safeDistance = intersects[0].distance * (1 - CONFIG.COLL_BUFFER);
    cameraPos.copy(targetPos).addScaledVector(rayDir, safeDistance);
  }
}

// Fast yaw extraction
const getYaw = (q) =>
  Math.atan2(2 * (q.y * q.w + q.x * q.z), 1 - 2 * (q.z * q.z + q.y * q.y));

export function initCamController(cam, tgt, options = {}) {
  camera = cam;
  target = tgt;
  scene = options.scene;

  if (options.distance !== undefined) {
    distance = MathUtils.clamp(
      options.distance,
      CONFIG.DIST_MIN,
      CONFIG.DIST_MAX
    );
  }
  if (options.collisionDetection !== undefined) {
    useCollision = options.collisionDetection;
  }

  document.addEventListener("wheel", onWheel, { passive: true });

  return {
    reset: () => (distance = CONFIG.DIST_DEFAULT),
    setDistance: (d) =>
      (distance = MathUtils.clamp(d, CONFIG.DIST_MIN, CONFIG.DIST_MAX)),
    setCollisionDetection: (enabled) => (useCollision = enabled),
    getState: () => ({ distance, collisionDetection: useCollision }),
  };
}

export function updateCamera() {
  if (!camera || !target) return;

  const targetPos = tempVectors.target.copy(target.position);
  const cameraPos = tempVectors.camera;

  // Calculate camera position from target rotation
  const yaw = getYaw(target.quaternion);
  cameraPos.set(
    targetPos.x + Math.sin(yaw) * distance,
    targetPos.y + CONFIG.HEIGHT_CAMERA,
    targetPos.z + Math.cos(yaw) * distance
  );

  checkCollision(targetPos, cameraPos);

  camera.position.copy(cameraPos);
  camera.lookAt(
    tempVectors.lookAt.set(
      targetPos.x,
      targetPos.y + CONFIG.HEIGHT_TARGET,
      targetPos.z
    )
  );
}

export function disposeCameraController() {
  document.removeEventListener("wheel", onWheel);
  camera = target = scene = null;
  intersects.length = 0;
}

export function getCameraState() {
  return {
    distance,
    collisionDetection: useCollision,
    targetPosition: target?.position.clone(),
    cameraPosition: camera?.position.clone(),
  };
}

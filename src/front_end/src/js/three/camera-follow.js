import {
  Vector3,
  MathUtils,
  Raycaster,
} from "../extern/three/three.module.min.js";

// Constants
const CONFIG = {
  DIST_MIN: 3,
  DIST_MAX: 15,
  DIST_DEFAULT: 8,
  HEIGHT_TARGET: 0.8,
  HEIGHT_CAMERA: 1.5,
  COLLISION: true,
  COLL_LAYERS: 1,
  COLL_BUFFER: 0.15,
  ZOOM_FACTOR: 0.5,
};

// Object pool (reused vectors to avoid GC)
const _vectors = {
  targetPos: new Vector3(),
  camPos: new Vector3(),
  rayDir: new Vector3(),
  lookAt: new Vector3(),
};

// Raycaster
const _raycaster = new Raycaster();
_raycaster.layers.mask = CONFIG.COLL_LAYERS;

// Scalar values (avoid object property lookups)
let _distance = CONFIG.DIST_DEFAULT;
let _useCollision = CONFIG.COLLISION;

// Object references
let _camera = null;
let _target = null;
let _scene = null;
let _targetPosition = null; // Cache references to frequently accessed properties
let _cameraPosition = null;

// Pre-allocated array for intersections
const _intersects = [];

// Cache Math functions for faster access
const _sin = Math.sin;
const _cos = Math.cos;
const _atan2 = Math.atan2;
const _clamp = MathUtils.clamp;

// Wheel zoom handler
function _onWheel(e) {
  const dir = e.deltaY < 0 ? -1 : e.deltaY > 0 ? 1 : 0;
  if (dir !== 0) {
    _distance = _clamp(
      _distance + dir * CONFIG.ZOOM_FACTOR,
      CONFIG.DIST_MIN,
      CONFIG.DIST_MAX
    );
  }
}

function _checkCollision() {
  if (!_useCollision || !_scene) return false;

  const targetPos = _vectors.targetPos;
  const camPos = _vectors.camPos;
  const rayDir = _vectors.rayDir;

  rayDir.subVectors(camPos, targetPos).normalize();
  _raycaster.set(targetPos, rayDir);
  _raycaster.far = _distance;

  _intersects.length = 0; // Clear reused array - faster than creating new array
  _raycaster.intersectObjects(_scene.children, true, _intersects);

  if (_intersects.length > 0) {
    const d = _intersects[0].distance * (1 - CONFIG.COLL_BUFFER);
    camPos.copy(targetPos).addScaledVector(rayDir, d);
    return true;
  }

  return false;
}

// Fast quaternion to angle conversion
function _getYawAngle(q) {
  return _atan2(2 * (q.y * q.w + q.x * q.z), 1 - 2 * (q.z * q.z + q.y * q.y));
}

// Controller API
export function initCamController(cam, tgt, opt = {}) {
  _camera = cam;
  _target = tgt;
  _scene = opt.scene || null;

  // Cache frequently accessed properties
  _targetPosition = tgt.position;
  _cameraPosition = cam.position;

  if (opt.distance !== undefined) {
    _distance = _clamp(opt.distance, CONFIG.DIST_MIN, CONFIG.DIST_MAX);
  }
  if (opt.collisionDetection !== undefined) {
    _useCollision = !!opt.collisionDetection;
  }

  document.addEventListener("wheel", _onWheel, { passive: true });

  return {
    reset: () => (_distance = CONFIG.DIST_DEFAULT),
    setDistance: (d) =>
      (_distance = _clamp(d, CONFIG.DIST_MIN, CONFIG.DIST_MAX)),
    setCollisionDetection: (v) => (_useCollision = !!v),
    getState: () => ({
      distance: _distance,
      collisionDetection: _useCollision,
    }),
  };
}

export function updateCamera() {
  if (!_camera || !_target) return;

  const targetPos = _vectors.targetPos;
  const camPos = _vectors.camPos;
  const lookAt = _vectors.lookAt;

  // Direct property access
  targetPos.set(_targetPosition.x, _targetPosition.y, _targetPosition.z);

  // Fast quaternion to yaw angle conversion
  const angle = _getYawAngle(_target.quaternion);
  const sin = _sin(angle);
  const cos = _cos(angle);

  // Direct calculation without intermediate variables
  camPos.set(
    targetPos.x + sin * _distance,
    targetPos.y + CONFIG.HEIGHT_CAMERA,
    targetPos.z + cos * _distance
  );

  // Check collision only when necessary
  if (_useCollision && _scene) {
    _checkCollision();
  }

  // Direct property assignment instead of copy
  _cameraPosition.x = camPos.x;
  _cameraPosition.y = camPos.y;
  _cameraPosition.z = camPos.z;

  lookAt.set(targetPos.x, targetPos.y + CONFIG.HEIGHT_TARGET, targetPos.z);

  _camera.lookAt(lookAt);
}

export function snapCameraToTarget() {
  updateCamera();
}

export function disposeCameraController() {
  document.removeEventListener("wheel", _onWheel);
  _camera = _target = _scene = null;
  _targetPosition = _cameraPosition = null;
  _intersects.length = 0;
}

export function getCameraState() {
  return {
    distance: _distance,
    collisionDetection: _useCollision,
    targetPosition: _target ? new Vector3().copy(_targetPosition) : null,
    cameraPosition: _camera ? new Vector3().copy(_cameraPosition) : null,
  };
}

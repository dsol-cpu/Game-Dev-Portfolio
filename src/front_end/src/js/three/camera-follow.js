import {
  Vector3,
  MathUtils,
  Raycaster,
} from "../extern/three/three.module.min.js";

// Constants
const DISTANCE_MIN = 3;
const DISTANCE_MAX = 15;
const DISTANCE_DEFAULT = 8;
const HEIGHT_TARGET_OFFSET = 0.8;
const HEIGHT_CAMERA_OFFSET = 1.5;
const COLLISION_ENABLED = true;
const COLLISION_LAYERS = 1;
const COLLISION_BUFFER = 0.15;

// Reusable vectors
const _targetPos = new Vector3();
const _camPos = new Vector3();
const _rayDir = new Vector3();
const _lookAt = new Vector3();

// Raycaster
const _raycaster = new Raycaster();
_raycaster.layers.mask = COLLISION_LAYERS;

// Scalar temp values
let _distance = DISTANCE_DEFAULT;
let _useCollision = COLLISION_ENABLED;

// Object references
let _camera = null;
let _target = null;
let _scene = null;

// Reusable array to avoid reallocation
let _intersects = [];

// Wheel zoom handler
function _onWheel(e) {
  const dir = Math.sign(e.deltaY);
  if (dir !== 0) {
    _distance = MathUtils.clamp(
      _distance + dir * 0.5,
      DISTANCE_MIN,
      DISTANCE_MAX
    );
  }
}

// Collision check
function _checkCollision() {
  if (!_useCollision || !_scene) return false;

  _rayDir.subVectors(_camPos, _targetPos).normalize();
  _raycaster.set(_targetPos, _rayDir);
  _raycaster.far = _distance;

  _intersects.length = 0; // Clear reused array
  _intersects = _raycaster.intersectObjects(_scene.children, true);

  if (_intersects.length > 0) {
    const d = _intersects[0].distance * (1 - COLLISION_BUFFER);
    _camPos.copy(_targetPos).addScaledVector(_rayDir, d);
    return true;
  }

  return false;
}

// Controller API
export function initCamController(cam, tgt, opt = {}) {
  _camera = cam;
  _target = tgt;
  _scene = opt.scene || null;

  if (opt.distance !== undefined) {
    _distance = MathUtils.clamp(opt.distance, DISTANCE_MIN, DISTANCE_MAX);
  }
  if (opt.collisionDetection !== undefined) {
    _useCollision = !!opt.collisionDetection;
  }

  document.addEventListener("wheel", _onWheel, { passive: true });

  return {
    reset: () => (_distance = DISTANCE_DEFAULT),
    setDistance: (d) =>
      (_distance = MathUtils.clamp(d, DISTANCE_MIN, DISTANCE_MAX)),
    setCollisionDetection: (v) => (_useCollision = !!v),
    getState: () => ({
      distance: _distance,
      collisionDetection: _useCollision,
    }),
  };
}

// Update camera position & orientation
export function updateCamera() {
  if (!_camera || !_target) return;

  const pos = _target.position;
  _targetPos.set(pos.x, pos.y, pos.z);

  const q = _target.quaternion;
  const y = q.y,
    w = q.w,
    x = q.x,
    z = q.z;
  const angle = Math.atan2(2 * (y * w + x * z), 1 - 2 * (z * z + y * y));
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  _camPos.set(
    _targetPos.x + sin * _distance,
    _targetPos.y + HEIGHT_CAMERA_OFFSET,
    _targetPos.z + cos * _distance
  );

  _camera.position.copy(_camPos);

  _lookAt.set(_targetPos.x, _targetPos.y + HEIGHT_TARGET_OFFSET, _targetPos.z);

  _camera.lookAt(_lookAt);
}

export function snapCameraToTarget() {
  updateCamera();
}

export function disposeCameraController() {
  document.removeEventListener("wheel", _onWheel);
  _camera = _target = _scene = null;
  _intersects.length = 0;
}

export function getCameraState() {
  return {
    distance: _distance,
    collisionDetection: _useCollision,
    targetPosition: _target ? _target.position.clone() : null,
    cameraPosition: _camera ? _camera.position.clone() : null,
  };
}

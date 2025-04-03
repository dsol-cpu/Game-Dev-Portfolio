import * as THREE from "three";

/**
 * Creates a navigation path with bezier curve
 * @param {THREE.Vector3} start - Start position
 * @param {THREE.Vector3} end - End position
 * @param {number} midHeight - Height of the midpoint
 * @returns {THREE.QuadraticBezierCurve3} The curve for navigation
 */
export const createNavigationPath = (start, end, midHeight) => {
  const midPoint = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5);
  midPoint.y = midHeight;
  return new THREE.QuadraticBezierCurve3(start, midPoint, end);
};

/**
 * Gets quaternion for level orientation that preserves yaw
 * @param {THREE.Quaternion} quaternion - Current quaternion
 * @returns {THREE.Quaternion} Level quaternion with preserved yaw
 */
export const getLevelOrientation = (quaternion) => {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, euler.y, 0, "YXZ")
  );
};

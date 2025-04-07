import * as THREE from "three";

// Reusable objects to prevent garbage collection
const _midPoint = new THREE.Vector3();
const _euler = new THREE.Euler();
const _levelQuaternion = new THREE.Quaternion();

/**
 * Creates a navigation path with bezier curve
 * @param {THREE.Vector3} start - Start position
 * @param {THREE.Vector3} end - End position
 * @param {number} midHeight - Height of the midpoint
 * @returns {THREE.QuadraticBezierCurve3} The curve for navigation
 */
export const createNavigationPath = (() => {
  return (start, end, midHeight) => {
    // Reuse midPoint vector to avoid new allocations
    _midPoint.addVectors(start, end).multiplyScalar(0.5);
    _midPoint.y = midHeight;

    // Create curve - we can't avoid this allocation as it's the return value
    return new THREE.QuadraticBezierCurve3(
      start.clone(), // Clone start to avoid reference issues
      _midPoint.clone(), // Clone midPoint to avoid reference issues
      end.clone() // Clone end to avoid reference issues
    );
  };
})();

/**
 * Gets quaternion for level orientation that preserves yaw
 * @param {THREE.Quaternion} quaternion - Current quaternion
 * @returns {THREE.Quaternion} Level quaternion with preserved yaw
 */
export const getLevelOrientation = (() => {
  return (quaternion) => {
    // Reuse euler to avoid new allocation
    _euler.setFromQuaternion(quaternion, "YXZ");

    // Set only the y rotation (yaw) and reuse quaternion
    _euler.x = 0;
    _euler.z = 0;

    // Return the level quaternion (reusing the object)
    return _levelQuaternion.setFromEuler(_euler);
  };
})();

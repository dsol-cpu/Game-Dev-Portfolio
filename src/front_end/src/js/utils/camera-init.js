import { isBitSet } from "../utils/bit-array.js";
import {
  getCamerasBySection,
  setActiveCameras,
  getCameraRegistry,
  CAMERA_TYPES,
} from "../three/camera-registry.js";
export async function initializeProjectCameras() {
  const reg = getCameraRegistry();
  const projCams = reg?.activeCamBitmask
    ? getCamerasBySection(CAMERA_TYPES.PROJECT)
    : null;

  if (!projCams?.length) return;

  const active = [];
  for (let i = 0; i < reg.count; i++) {
    const cam = reg.cameraData[i];
    if (!cam) continue;
    if (
      (cam.type !== CAMERA_TYPES.PROJECT &&
        isBitSet(reg.activeCamBitmask, i)) ||
      cam.type === CAMERA_TYPES.PROJECT
    ) {
      active.push(i);
    }
  }

  setActiveCameras(active);
}

/**
 * @returns {boolean} success
 */
export async function updateCameras(state) {
  const pfs = window.portfolioFilterState;
  if (!pfs?.needsCameraUpdate) return false;

  const reg = getCameraRegistry();
  if (!reg?.cameraData || !reg.activeCamBitmask) {
    pfs.needsCameraUpdate = false;
    return false;
  }

  const projCams = getCamerasBySection(CAMERA_TYPES.PROJECT);
  if (!projCams.length) {
    pfs.needsCameraUpdate = false;
    return false;
  }

  const active = [];
  const { visibleItemIds } = pfs;
  const mask = reg.activeCamBitmask;

  const isProjVisible = (id) =>
    visibleItemIds?.size > 0 ? visibleItemIds.has(id) : state.filter === "all";

  for (let i = 0; i < reg.count; i++) {
    const cam = reg.cameraData[i];
    if (!cam) continue;

    if (
      (cam.type !== CAMERA_TYPES.PROJECT && isBitSet(mask, i)) ||
      (cam.type === CAMERA_TYPES.PROJECT &&
        cam.elementId &&
        isProjVisible(cam.elementId))
    ) {
      active.push(i);
    }
  }

  setActiveCameras(active);
  pfs.needsCameraUpdate = false;
  return true;
}

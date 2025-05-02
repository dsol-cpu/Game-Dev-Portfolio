import { isBitSet } from "../utils/bit-array.js";
import {
  getCamerasBySection,
  setActiveCameras,
  getCameraRegistry,
} from "../three/camera-registry.js";
import { CAMERA_SECTIONS } from "../data/sections.js";
export async function initProjectCameras() {
  const reg = getCameraRegistry();
  const projCams = reg?.activeCamBitmask
    ? getCamerasBySection(CAMERA_SECTIONS.PROJECT)
    : null;

  if (!projCams?.length) return;

  const active = [];
  for (let i = 0; i < reg.count; i++) {
    const cam = reg.cameraData[i];
    if (!cam) continue;
    if (
      (cam.type !== CAMERA_SECTIONS.PROJECT &&
        isBitSet(reg.activeCamBitmask, i)) ||
      cam.type === CAMERA_SECTIONS.PROJECT
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

  const projCams = getCamerasBySection(CAMERA_SECTIONS.PROJECT);
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
      (cam.type !== CAMERA_SECTIONS.PROJECT && isBitSet(mask, i)) ||
      (cam.type === CAMERA_SECTIONS.PROJECT &&
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

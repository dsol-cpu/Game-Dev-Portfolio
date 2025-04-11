import { createSignal, createEffect, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import {
  isMobileDevice,
  isTabletDevice,
  getDeviceType,
  getOrientation,
} from "../utils/deviceUtils";

// Create the store with signals and state
const createDeviceStore = () => {
  // Create reactive signals
  const [isMobile, setIsMobile] = createSignal(isMobileDevice());
  const [isTablet, setIsTablet] = createSignal(isTabletDevice());
  const [deviceType, setDeviceType] = createSignal(getDeviceType());
  const [orientation, setOrientation] = createSignal(getOrientation());
  const [screenWidth, setScreenWidth] = createSignal(window.innerWidth);
  const [screenHeight, setScreenHeight] = createSignal(window.innerHeight);

  // Create a store for non-signal state values (useful for debugging)
  const [state, setState] = createStore({
    userAgent: navigator.userAgent,
    hasTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    pixelRatio: window.devicePixelRatio,
  });

  // Update function for when window resizes
  const updateDeviceInfo = () => {
    setIsMobile(isMobileDevice());
    setIsTablet(isTabletDevice());
    setDeviceType(getDeviceType());
    setOrientation(getOrientation());
    setScreenWidth(window.innerWidth);
    setScreenHeight(window.innerHeight);
  };

  // Set up the resize event listener
  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateDeviceInfo);
    window.addEventListener("orientationchange", updateDeviceInfo);

    // Make sure values are current
    updateDeviceInfo();
  }

  // Return public API
  return {
    // Signals
    isMobile,
    isTablet,
    deviceType,
    orientation,
    screenWidth,
    screenHeight,

    // Computed properties
    isDesktop: () => deviceType() === "desktop",
    isPortrait: () => orientation() === "portrait",
    isLandscape: () => orientation() === "landscape",

    // Static state
    state,

    // Actions
    updateDeviceInfo,

    // Helper function for cleanup (use in components)
    registerCleanup: () => {
      onCleanup(() => {
        window.removeEventListener("resize", updateDeviceInfo);
        window.removeEventListener("orientationchange", updateDeviceInfo);
      });
    },
  };
};

// Create a singleton store instance
export const deviceStore = createDeviceStore();

// Additional hook for component usage with automatic cleanup
export function useDeviceDetection() {
  const store = deviceStore;

  // Register cleanup automatically when used in a component
  if (typeof window !== "undefined") {
    onCleanup(() => {
      window.removeEventListener("resize", store.updateDeviceInfo);
      window.removeEventListener("orientationchange", store.updateDeviceInfo);
    });
  }

  return store;
}

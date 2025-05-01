/**
 * Check if the device is likely to be low-powered
 * @returns {boolean} - Whether the device is likely low-powered
 */
export function isLowPoweredDevice() {
  // Check for mobile devices first
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Check for hardware concurrency
  const cpuCores = navigator.hardwareConcurrency || 1;

  // Use deviceMemory if available (Chrome)
  const lowMemory =
    navigator.deviceMemory !== undefined && navigator.deviceMemory < 4;

  // Use battery API if available
  if ("getBattery" in navigator) {
    navigator
      .getBattery()
      .then((battery) => {
        // Device is charging with low battery might indicate low power mode
        if (!battery.charging && battery.level < 0.2) {
          return true;
        }
      })
      .catch(() => {});
  }

  // Consider a device low powered if it's mobile AND has either low memory or few CPU cores
  return isMobile && (lowMemory || cpuCores <= 4);
}

/**
 * Detects if the current device is a low-end device
 * @returns {boolean} True if the device is low-end
 */
export function detectLowEndDevice() {
  // Check for explicit mobile device markers
  const isMobileDevice =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Check for low-end mobile GPUs
  const hasLowEndMobileGPU = /Adreno [3-4]\d{2}|Mali-[4-5]|PowerVR/i.test(
    navigator.userAgent
  );

  const hasVeryLowCPUs =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

  const hasVeryLowMemory =
    navigator.deviceMemory && navigator.deviceMemory <= 2;

  if (!isMobileDevice) {
    return hasVeryLowMemory && hasVeryLowCPUs;
  }

  return (
    isMobileDevice && (hasLowEndMobileGPU || hasVeryLowCPUs || hasVeryLowMemory)
  );
}

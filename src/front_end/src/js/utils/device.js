export function detectLowEndDevice() {
  const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const hasLowCPUs =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const hasLowEndGPU = /Adreno [3-4]\d{2}|Mali-[4-5]/i.test(
    navigator.userAgent
  );

  return hasLowMemory || hasLowCPUs || isMobile || hasLowEndGPU;
}

// Hook for asset caching functionality
export const useAssetCache = () => {
  const CACHE_KEY = "three-scene-assets-cache";
  const CACHE_VERSION = "v1"; // Increment this when assets change

  const checkCachedAssets = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) return null;

      const data = JSON.parse(cachedData);
      if (data.version !== CACHE_VERSION) {
        // Clear outdated cache
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.warn("Error reading asset cache:", error);
      return null;
    }
  };

  const updateAssetCache = (assets) => {
    try {
      const cacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        assets,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Error saving asset cache:", error);
    }
  };

  return {
    checkCachedAssets,
    updateAssetCache,
  };
};

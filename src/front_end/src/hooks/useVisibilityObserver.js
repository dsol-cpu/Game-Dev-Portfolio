export const useVisibilityObserver = (elementRef, onVisibilityChange) => {
  const checkVisibility = () => {
    const el = typeof elementRef === "function" ? elementRef() : elementRef;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const isInViewport =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.width > 0 &&
      rect.height > 0;

    return isInViewport;
  };

  const setupVisibilityObserver = () => {
    const el = typeof elementRef === "function" ? elementRef() : elementRef;
    if (!el) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting;
        onVisibilityChange(isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  };

  return {
    checkVisibility,
    setupVisibilityObserver,
  };
};

import { createSignal, createEffect, createRoot } from "solid-js";

let themeManager;

export function createThemeManager() {
  if (themeManager) return themeManager;

  themeManager = createRoot((dispose) => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const getSystemTheme = () => (mediaQuery.matches ? "dark" : "light");

    const storedTheme = localStorage.getItem("theme");
    const [theme, setTheme] = createSignal(storedTheme || "system");

    // Memoized effective theme (resolves 'system' to actual theme)
    const getEffectiveTheme = () =>
      theme() === "system" ? getSystemTheme() : theme();

    // Apply theme to DOM
    const applyTheme = () => {
      const effectiveTheme = getEffectiveTheme();
      const isDark = effectiveTheme === "dark";

      document.documentElement.setAttribute("data-theme", effectiveTheme);
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("theme", theme());
    };

    // Handle system theme changes
    const handleSystemThemeChange = () => {
      if (theme() === "system") applyTheme();
    };

    // Set up event listener
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    // Apply theme when it changes
    const unwatchTheme = createEffect(applyTheme);

    // Apply initial theme
    applyTheme();

    return {
      theme,
      getEffectiveTheme,
      setTheme,
      toggleTheme: () =>
        setTheme(getEffectiveTheme() === "dark" ? "light" : "dark"),
      isDark: () => getEffectiveTheme() === "dark",
      dispose: () => {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
        unwatchTheme();
        dispose();
      },
    };
  });

  return themeManager;
}

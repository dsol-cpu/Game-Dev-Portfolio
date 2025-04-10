import { createSignal, createEffect, createRoot, createMemo } from "solid-js";

let themeManager;

export function createThemeManager() {
  if (themeManager) return themeManager;

  themeManager = createRoot((dispose) => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const getSystemTheme = () => (mediaQuery.matches ? "dark" : "light");

    const storedTheme = localStorage.getItem("theme");
    const [theme, setTheme] = createSignal(storedTheme || "system");

    // Create a reactive signal for the effective theme
    const [effectiveTheme, setEffectiveTheme] = createSignal(
      theme() === "system" ? getSystemTheme() : theme()
    );

    // Create a reactive signal for isDark
    const [isDarkMode, setIsDarkMode] = createSignal(
      effectiveTheme() === "dark"
    );

    // Update effective theme when base theme changes
    createEffect(() => {
      const newEffectiveTheme =
        theme() === "system" ? getSystemTheme() : theme();
      setEffectiveTheme(newEffectiveTheme);
      setIsDarkMode(newEffectiveTheme === "dark");
      // console.log(
      //   `Theme updated: ${theme()} -> Effective: ${newEffectiveTheme}, isDark: ${newEffectiveTheme === "dark"}`
      // );
    });

    // Apply theme to DOM
    const applyTheme = () => {
      const currentEffectiveTheme = effectiveTheme();
      const isDark = currentEffectiveTheme === "dark";

      document.documentElement.setAttribute(
        "data-theme",
        currentEffectiveTheme
      );
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("theme", theme());

      // Dispatch a custom event for theme changes
      document.dispatchEvent(
        new CustomEvent("themeChange", {
          detail: {
            theme: currentEffectiveTheme,
            isDark,
          },
        })
      );
    };

    // Handle system theme changes
    const handleSystemThemeChange = () => {
      if (theme() === "system") {
        const newSystemTheme = getSystemTheme();
        setEffectiveTheme(newSystemTheme);
        setIsDarkMode(newSystemTheme === "dark");
        applyTheme();
        console.log(
          `System theme changed to: ${newSystemTheme}, isDark: ${newSystemTheme === "dark"}`
        );
      }
    };

    // Set up event listener
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    // Apply theme when it changes
    createEffect(() => {
      const currentTheme = effectiveTheme();
      // console.log(`Applying theme effect: ${currentTheme}`);
      applyTheme();
    });

    // Apply initial theme
    applyTheme();

    return {
      theme,
      effectiveTheme,
      isDark: isDarkMode,
      setTheme: (newTheme) => {
        // console.log(`Setting theme to: ${newTheme}`);
        setTheme(newTheme);
      },
      toggleTheme: () => {
        const newTheme = effectiveTheme() === "dark" ? "light" : "dark";
        // console.log(`Toggling theme to: ${newTheme}`);
        setTheme(newTheme);
      },
      dispose: () => {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
        dispose();
      },
    };
  });

  return themeManager;
}

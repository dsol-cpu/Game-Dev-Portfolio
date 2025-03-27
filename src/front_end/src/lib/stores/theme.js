import { createSignal, createEffect } from "solid-js";

export function createThemeManager() {
  const [theme, setTheme] = createSignal(
    localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
  );
  console.log("Current theme:", theme()); // Check the theme in the console

  createEffect(() => {
    localStorage.setItem("theme", theme());
    document.documentElement.classList.toggle("dark", theme() === "dark");
  });

  return {
    theme,
    toggleTheme: () => {
      setTheme(theme() === "dark" ? "light" : "dark");
      console.log("Theme toggled:", theme()); // Debug theme change
    },
    isDark: () => theme() === "dark",
  };
}

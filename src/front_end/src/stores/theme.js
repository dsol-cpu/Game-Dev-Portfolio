import { createSignal, createEffect, createRoot } from "solid-js";

// Create a singleton instance of the theme manager
let themeManager;

export function createThemeManager() {
  // Return the existing instance if it already exists
  if (themeManager) return themeManager;

  // Create a root for our reactive system
  themeManager = createRoot((dispose) => {
    // Function to detect system theme preference
    const getSystemTheme = () => {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    };

    // Initialize theme signal from localStorage or system preference
    const [theme, setTheme] = createSignal(
      localStorage.getItem("theme") || "system"
    );

    // Function to get the effective theme (resolves 'system' to actual theme)
    const getEffectiveTheme = () => {
      return theme() === "system" ? getSystemTheme() : theme();
    };

    // Function to apply the theme immediately to the DOM
    const applyTheme = () => {
      const effectiveTheme = getEffectiveTheme();
      document.documentElement.setAttribute("data-theme", effectiveTheme);
      document.documentElement.classList.toggle(
        "dark",
        effectiveTheme === "dark"
      );
      localStorage.setItem("theme", theme()); // Store the actual setting (system/dark/light)
      console.log("Applying theme:", effectiveTheme, "(setting:", theme(), ")");
    };

    // Apply theme immediately
    applyTheme();

    // Set up theme change listener
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme() === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    // Set up theme signal watcher
    const unwatchTheme = createEffect(() => {
      applyTheme();
    });

    // Return the manager object with access to the dispose function
    return {
      theme, // Expose the theme signal
      getEffectiveTheme, // Get the resolved theme
      setTheme, // Set theme directly
      toggleTheme: () => {
        // Simple toggle between light and dark only (no system)
        const currentTheme = theme();
        if (currentTheme === "dark") {
          setTheme("light");
        } else {
          setTheme("dark");
        }
      },
      isDark: () => getEffectiveTheme() === "dark", // Check if dark mode is active
      dispose: () => {
        // Clean up resources
        mediaQuery.removeEventListener("change", handleChange);
        unwatchTheme();
        dispose();
      },
    };
  });

  return themeManager;
}

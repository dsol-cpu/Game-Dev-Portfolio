// Theme Management - Script to be placed in the <head> before any content loads
(() => {
  // Function to get the theme preference
  const getThemePreference = () => {
    // First check local storage
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme;
    }

    // If no saved preference, check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  // Apply theme immediately to prevent flash
  document.documentElement.setAttribute("data-theme", getThemePreference());
})();

// Rest of theme management code (for after DOM is loaded)
document.addEventListener("DOMContentLoaded", () => {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");

  // Function to set theme
  const setTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  // Function to toggle theme
  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  // Add event listener for theme toggle button
  themeToggleBtn.addEventListener("click", toggleTheme);

  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        // Only auto-switch if user hasn't manually set a preference
        setTheme(e.matches ? "dark" : "light");
      }
    });
});

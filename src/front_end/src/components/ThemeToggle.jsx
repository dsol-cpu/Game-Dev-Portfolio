import { createMemo, onMount } from "solid-js";
import { createThemeManager } from "../stores/theme";
import { Icon } from "./icons/Icon";
const SunIcon = () => <Icon name="sun" />;
const MoonIcon = () => <Icon name="moon" />;

export default function ThemeToggle() {
  const themeManager = createThemeManager();
  const { theme, isDark, toggleTheme, effectiveTheme, setTheme } = themeManager;

  // Apply the user's theme choice or system default on initial load
  onMount(() => {
    if (theme() === "system") {
      console.log("Starting with system default:", effectiveTheme());
    }
  });

  return (
    <div class="flex items-center justify-center gap-2 py-3 border-b border-cyan-500/30">
      {/* Sun icon for light mode */}
      <button
        onClick={() => setTheme("light")}
        class="focus:outline-none"
        aria-label="Switch to light mode"
      >
        <SunIcon />
      </button>

      {/* The toggle switch */}
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isDark()}
          onChange={toggleTheme}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>

      {/* Moon icon for dark mode */}
      <button
        onClick={() => setTheme("dark")}
        class="focus:outline-none"
        aria-label="Switch to dark mode"
      >
        <MoonIcon />
      </button>
    </div>
  );
}

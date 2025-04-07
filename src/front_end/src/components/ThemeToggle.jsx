import { createMemo, onMount } from "solid-js";
import { createThemeManager } from "../stores/theme";

// SVG icons extracted as constants to avoid recreation on each render
const SunIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={props.class}
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

export default function ThemeToggle() {
  const themeManager = createThemeManager();
  const { theme, isDark, toggleTheme, getEffectiveTheme, setTheme } =
    themeManager;

  // Memoize icon classes to avoid recalculation on each render
  const iconClasses = createMemo(() => {
    const effectiveTheme = getEffectiveTheme();
    return {
      sun: effectiveTheme === "light" ? "text-amber-500" : "text-gray-400",
      moon: effectiveTheme === "dark" ? "text-indigo-300" : "text-gray-400",
    };
  });

  // Apply the user's theme choice or system default on initial load
  onMount(() => {
    if (theme() === "system") {
      console.log("Starting with system default:", getEffectiveTheme());
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
        <SunIcon class={iconClasses().sun} />
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
        <MoonIcon class={iconClasses().moon} />
      </button>
    </div>
  );
}

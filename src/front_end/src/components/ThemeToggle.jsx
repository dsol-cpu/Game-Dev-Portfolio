import { createMemo, onMount } from "solid-js";
import { createThemeManager } from "../stores/theme";
import { Icon } from "./icons/Icon";
const SunIcon = (props) => <Icon name="sun" {...props} />;
const MoonIcon = (props) => <Icon name="moon" {...props} />;

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

import { createSignal, createEffect, createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";

export default function ViewToggleSwitch({ isScrollView, onToggle }) {
  const themeManager = createThemeManager();
  const { getEffectiveTheme } = themeManager;

  // Flip the checked state meaning: checked now means "3D View" is active
  const [isChecked, setIsChecked] = createSignal(!isScrollView());

  // Update checkbox state when view mode changes
  createEffect(() => {
    setIsChecked(!isScrollView());
  });

  // Memoize theme-dependent values
  const isLightTheme = createMemo(() => getEffectiveTheme() === "light");

  // Memoize style classes
  const containerClass = createMemo(
    () =>
      `fixed bottom-4 right-4 z-50 flex items-center justify-center gap-3 rounded-lg p-3 shadow-lg backdrop-blur-sm transition-colors ${
        isLightTheme() ? "bg-white/90" : "bg-slate-800/90"
      }`
  );

  const toggleClass = createMemo(
    () =>
      `w-11 h-6 rounded-full peer after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full transition-colors ${
        isLightTheme()
          ? "bg-gray-200 after:bg-white after:border-gray-300 peer-checked:bg-blue-600 peer-checked:after:border-white peer-focus:ring-blue-300"
          : "bg-gray-700 after:bg-white after:border-gray-600 peer-checked:bg-cyan-600 peer-checked:after:border-white peer-focus:ring-blue-800"
      } peer-focus:ring-4`
  );

  // Function to get active/inactive text color
  const getTextColorClass = (active) => {
    if (active) {
      return isLightTheme() ? "text-blue-600" : "text-cyan-500";
    }
    return "text-gray-400";
  };

  // Extracted view option component for reusability
  const ViewOption = ({ label, icon, active, onClick }) => (
    <div class="flex flex-col items-center">
      <button
        onClick={onClick}
        class="flex flex-col items-center gap-1 focus:outline-none"
        aria-label={`Switch to ${label}`}
      >
        {icon}
        <span
          class={`text-xs font-medium transition-colors ${getTextColorClass(active)}`}
        >
          {label}
        </span>
      </button>
    </div>
  );

  const scrollIcon = (active) => (
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
      class={`transition-colors ${getTextColorClass(active)}`}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );

  const threeDIcon = (active) => (
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
      class={`transition-colors ${getTextColorClass(active)}`}
    >
      <path d="M12 3L2 12h5v8h10v-8h5L12 3z" />
    </svg>
  );

  return (
    <div class={containerClass()}>
      {/* Scroll View Option */}
      <ViewOption
        label="Scroll View"
        icon={scrollIcon(!isChecked())}
        active={!isChecked()}
        onClick={() => isChecked() && onToggle()}
      />

      {/* The toggle switch */}
      <label class="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={isChecked()}
          onChange={onToggle}
          class="peer sr-only"
        />
        <div class={toggleClass()}></div>
      </label>

      {/* 3D View Option */}
      <ViewOption
        label="3D View"
        icon={threeDIcon(isChecked())}
        active={isChecked()}
        onClick={() => !isChecked() && onToggle()}
      />
    </div>
  );
}

import { createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import { viewStore } from "../../stores/view";
import { Icon } from "../icons/Icon";

export default function ViewToggleSwitch() {
  const themeManager = createThemeManager();
  const { isDark } = themeManager;
  const { state: viewState, toggleView } = viewStore;

  const toggleClass = createMemo(
    () =>
      `w-11 h-6 rounded-full peer after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full transition-colors ${
        isDark()
          ? "bg-gray-700 after:bg-white after:border-gray-600 peer-checked:bg-cyan-600 peer-checked:after:border-white peer-focus:ring-blue-800"
          : "bg-gray-200 after:bg-white after:border-gray-300 peer-checked:bg-blue-600 peer-checked:after:border-white peer-focus:ring-blue-300"
      } peer-focus:ring-4`
  );

  // View option button with label
  const ViewOption = ({ label, icon, active, onClick }) => (
    <button
      onClick={onClick}
      class="flex flex-col items-center gap-1 focus:outline-none"
      aria-label={`Switch to ${label}`}
    >
      {icon}
      <span class="select-none text-xs font-medium">{label}</span>
    </button>
  );

  const scrollIcon = <Icon name="scroll" />;
  const threeDIcon = <Icon name="wheel" />;

  return (
    <div class="flex items-center justify-center gap-2 py-3 border-b border-cyan-500/30">
      {/* Scroll View Option */}
      <ViewOption
        label="Scroll View"
        icon={scrollIcon}
        active={viewState.isScrollView}
        onClick={() => !viewState.isScrollView && toggleView()}
      />

      {/* The toggle switch */}
      <label class="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={!viewState.isScrollView}
          onChange={toggleView}
          class="peer sr-only"
        />
        <div class={toggleClass()}></div>
      </label>

      {/* 3D View Option */}
      <ViewOption
        label="3D View"
        icon={threeDIcon}
        active={!viewState.isScrollView}
        onClick={() => viewState.isScrollView && toggleView()}
      />
    </div>
  );
}

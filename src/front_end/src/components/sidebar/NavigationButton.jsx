import { createThemeManager } from "../../stores/theme";
import { createMemo } from "solid-js";

export default function NavigationButton(props) {
  const { isDark } = createThemeManager();

  const styles = createMemo(() => ({
    item: isDark()
      ? "hover:bg-blue-800/40 hover:text-yellow-300"
      : "hover:bg-emerald-200/60 hover:text-blue-800",
    active: isDark()
      ? "bg-blue-900/60 text-green-400 border-l-4 border-green-500"
      : "bg-teal-200/70 text-blue-900 border-l-4 border-blue-600",
  }));

  return (
    <button
      class={`flex w-full items-center rounded-lg px-4 py-3 font-medium transition-all duration-200
        ${props.isActive() || props.isNavigatingTo() ? styles().active : styles().item}
        ${props.isDisabled() ? "opacity-50 pointer-events-none" : ""}`}
      onClick={props.onClick}
      disabled={props.isDisabled()}
    >
      <span class="mr-3">{props.icon}</span>
      <span class="capitalize">
        {props.sectionName}
        {props.status()}
      </span>
    </button>
  );
}

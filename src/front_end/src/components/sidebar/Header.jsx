import { createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";

export default function Header() {
  const { isDark } = createThemeManager();

  const nameGradient = createMemo(
    () =>
      `bg-gradient-to-r ${isDark() ? "from-green-400 to-cyan-400" : "from-blue-700 to-teal-600"} bg-clip-text text-transparent`
  );

  return (
    <div class="border-b border-cyan-500/30 px-6 py-6">
      <h2 class="text-2xl font-bold">
        <span class={nameGradient()}>David Solinsky</span>
      </h2>
      <p class="mt-1 text-sm opacity-80">Game Developer & Designer</p>
    </div>
  );
}

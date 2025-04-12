import { createThemeManager } from "../stores/theme";

export default function Footer() {
  const themeManager = createThemeManager();
  const isDark = themeManager.isDark;

  return (
    <footer
      class={`
      select-none
      border-t
      border-cyan-500/30
      p-4
      text-center
      text-xs
      ${isDark() ? "bg-blue-950/80" : "bg-white/80"}
      backdrop-blur-md
      shadow-md
      sticky
      bottom-0

      w-full
    `}
    >
      <div class="container mx-auto flex justify-center items-center">
        <span class={`${isDark() ? "text-blue-300" : "text-blue-900"}`}>
          © {new Date().getFullYear()} David Solinsky
        </span>
      </div>
    </footer>
  );
}

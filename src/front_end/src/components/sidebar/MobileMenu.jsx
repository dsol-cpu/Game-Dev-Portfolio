import ThemeToggle from "../ThemeToggle";
import ViewToggleSwitch from "../ViewToggleSwitch";
import NavigationMenu from "./NavigationMenu";

export default function MobileMenu(props) {
  const {
    isOpen,
    isDark,
    portfolioSections,
    portfolioSectionTitles,
    activeSection,
    navigation,
    viewState,
    toggleView,
    navigateToSection,
  } = props;

  return (
    <div
      class={`mobile-sidebar fixed top-0 left-0 z-40 w-full ${
        isOpen()
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      style={{ transition: "opacity 0.3s ease" }}
    >
      <div
        class={`w-full h-screen p-4 pt-16 ${
          isDark()
            ? "bg-slate-900/95 text-green-300"
            : "bg-slate-100/95 text-slate-800"
        }`}
      >
        <div class="flex flex-col items-center space-y-6">
          <h2 class="text-2xl font-bold mb-6">
            {isDark() ? (
              <span class="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                David Solinsky
              </span>
            ) : (
              <span class="bg-gradient-to-r from-blue-700 to-teal-600 bg-clip-text text-transparent">
                David Solinsky
              </span>
            )}
          </h2>

          <div class="w-full max-w-xs">
            <NavigationMenu
              sections={portfolioSections}
              sectionTitles={portfolioSectionTitles}
              activeSection={activeSection}
              isNavigating={navigation.isNavigating}
              isArrived={navigation.isArrived}
              navigatingSection={navigation.navigatingSection}
              destinationSection={navigation.destinationSection}
              navigationProgress={navigation.navigationProgress}
              onNavigate={navigateToSection}
            />
          </div>

          <div class="mt-6 flex flex-col items-center space-y-6">
            <ThemeToggle />
            <ViewToggleSwitch
              isScrollView={() => viewState.isScrollView}
              onToggle={toggleView}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { createSignal, createEffect } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import { navigationStore } from "../../stores/navigationStore";

export default function MobileNav(props) {
  const { isDark } = createThemeManager();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [activeSection, setActiveSection] = createSignal("home");

  const {
    setTargetIsland,
    setIsNavigating,
    setDestinationSection,
    isNavigating,
    navigationProgress,
    setNavigationProgress,
    navigatingSection,
    setNavigatingSection,
  } = navigationStore;

  // Map sections to island indices
  const sectionToIslandMap = {
    home: 0,
    experience: 1,
    projects: 2,
    resume: 3,
  };

  // Navigate to island and section
  const navigateToIsland = (sectionId, islandIndex, event) => {
    event.preventDefault();
    setNavigatingSection(sectionId);
    setDestinationSection(sectionId);

    // Set the target island index for the ship to navigate to
    setTargetIsland(islandIndex);
    setIsNavigating(true);
    setNavigationProgress(0);

    // Close menu
    setIsMenuOpen(false);
  };

  // Handle resume book
  const openBook = (event) => {
    event.preventDefault();
    setNavigatingSection("resume");
    setTargetIsland(3);
    setIsNavigating(true);
    setNavigationProgress(0);
    setDestinationSection("resume");
    setIsMenuOpen(false);
  };

  // Get navigation status text
  const getNavigationStatus = (section) => {
    if (isNavigating() && navigatingSection() === section) {
      return ` (Flying ${Math.round(navigationProgress())}%)`;
    }
    return "";
  };

  // Close menu when clicking outside
  createEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen() &&
        !event.target.closest(".mobile-menu") &&
        !event.target.closest(".mobile-menu-toggle")
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });

  // Reset active section when navigation completes
  createEffect(() => {
    if (!isNavigating() && navigatingSection()) {
      setActiveSection(navigatingSection());
    }
  });

  // Only render if on mobile
  if (!props.show) return null;

  return (
    <>
      {/* Hamburger Button */}
      <button
        class="mobile-menu-toggle fixed top-4 left-4 z-50 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 p-2 text-white shadow-lg hover:from-blue-500 hover:to-teal-400"
        onClick={() => setIsMenuOpen(!isMenuOpen())}
        aria-label="Toggle menu"
      >
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isMenuOpen() ? (
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile Menu Overlay */}
      <div
        class={`mobile-menu fixed top-0 left-0 z-40 w-full ${
          isMenuOpen()
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

            <nav class="w-full max-w-xs">
              <ul class="flex flex-col space-y-4">
                {["home", "experience", "projects"].map((section) => (
                  <li class="w-full">
                    <button
                      class={`flex w-full items-center justify-center rounded-lg px-4 py-4 font-medium transition-all ${
                        activeSection() === section
                          ? isDark()
                            ? "bg-blue-900/60 text-green-400 border-green-500"
                            : "bg-teal-200/70 text-blue-900 border-blue-600"
                          : isDark()
                            ? "hover:bg-blue-800/40 hover:text-yellow-300"
                            : "hover:bg-emerald-200/60 hover:text-blue-800"
                      } ${isNavigating() ? "opacity-50 pointer-events-none" : ""}`}
                      onClick={(e) =>
                        navigateToIsland(
                          section,
                          sectionToIslandMap[section],
                          e
                        )
                      }
                      disabled={isNavigating()}
                    >
                      <span class="mr-3">
                        {section === "home" && (
                          <svg
                            class="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                          </svg>
                        )}
                        {section === "experience" && (
                          <svg
                            class="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                          </svg>
                        )}
                        {section === "projects" && (
                          <svg
                            class="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
                          </svg>
                        )}
                      </span>
                      <span class="capitalize text-lg">
                        {section}
                        {getNavigationStatus(section)}
                      </span>
                    </button>
                  </li>
                ))}
                <li class="w-full">
                  <button
                    class={`flex w-full items-center justify-center rounded-lg px-4 py-4 font-medium transition-all ${
                      activeSection() === "resume"
                        ? isDark()
                          ? "bg-blue-900/60 text-green-400 border-green-500"
                          : "bg-teal-200/70 text-blue-900 border-blue-600"
                        : isDark()
                          ? "hover:bg-blue-800/40 hover:text-yellow-300"
                          : "hover:bg-emerald-200/60 hover:text-blue-800"
                    } ${isNavigating() ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={openBook}
                    disabled={isNavigating()}
                  >
                    <span class="mr-3">
                      <svg
                        class="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>
                      </svg>
                    </span>
                    <span class="text-lg">
                      Resume
                      {getNavigationStatus("resume")}
                    </span>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}

import { createSignal, createEffect } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import ThemeToggle from "../ThemeToggle";
import { navigationStore } from "../../stores/navigationStore";

export default function Sidebar() {
  const { theme, toggleTheme, isDark } = createThemeManager();
  const [isOpen, setIsOpen] = createSignal(false);
  const [position] = createSignal("left");
  const [width] = createSignal("280px");
  const [toggleButton] = createSignal(true);
  const [activeSection, setActiveSection] = createSignal("home");
  const [isBookOpen, setIsBookOpen] = createSignal(false);

  // Import the navigation store
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

  // New state for book navigation
  const [bookNavigation, setBookNavigation] = createSignal(null);
  const [currentBookPage, setCurrentBookPage] = createSignal(0);

  // Game-inspired theme classes
  const sidebarClass = () =>
    isDark()
      ? "bg-slate-900 text-green-300 border-cyan-700 bg-gradient-to-b from-slate-900 to-blue-900/40"
      : "bg-slate-100 text-slate-800 border-emerald-400 bg-gradient-to-b from-slate-100 to-teal-200/50";

  const itemClass = () =>
    isDark()
      ? "hover:bg-blue-800/40 hover:text-yellow-300"
      : "hover:bg-emerald-200/60 hover:text-blue-800";

  const activeClass = () =>
    isDark()
      ? "bg-blue-900/60 text-green-400 border-l-4 border-green-500"
      : "bg-teal-200/70 text-blue-900 border-l-4 border-blue-600";

  // Reset active section when navigation completes
  createEffect(() => {
    if (!isNavigating() && navigatingSection()) {
      setActiveSection(navigatingSection());
      setNavigatingSection(null);
    }
  });

  // Handle outside clicks to close sidebar on mobile
  createEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        isOpen() &&
        !target.closest(".sidebar") &&
        !target.closest(".sidebar-toggle")
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsOpen(!isOpen());
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

    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  // Handle resume book
  const openBook = (event) => {
    event.preventDefault();
    setIsBookOpen(true);
    setNavigatingSection("resume");
    setCurrentBookPage(0);

    // Navigate to the resume island (using index 3 for resume)
    setTargetIsland(3);
    setIsNavigating(true);
    setNavigationProgress(0);
    setDestinationSection("resume");

    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  // Map sections to island indices
  const sectionToIslandMap = {
    home: 0,
    experience: 1,
    projects: 2,
    resume: 3,
  };

  // Get navigation status text
  const getNavigationStatus = (section) => {
    if (isNavigating() && navigatingSection() === section) {
      return ` (Flying ${Math.round(navigationProgress())}%)`;
    }
    return "";
  };

  return (
    <>
      {toggleButton() && (
        <button
          class={`sidebar-toggle fixed top-16 ${
            position() === "left" ? "left-4" : "right-4"
          } z-40 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 p-2 text-white shadow-lg hover:from-blue-500 hover:to-teal-400 md:hidden`}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isOpen() ? (
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
      )}

      <aside
        class={`sidebar fixed top-0 ${
          position() === "left" ? "left-0" : "right-0"
        } z-30 h-full border-r shadow-lg ${sidebarClass()}`}
        style={{
          width: width(),
          transform: `translateX(${
            isOpen() || window.innerWidth >= 768
              ? "0"
              : position() === "left"
                ? "-100%"
                : "100%"
          })`,
          transition: "transform 0.3s ease",
        }}
      >
        <div class="flex h-full flex-col pt-16">
          <div class="border-b border-cyan-500/30 px-6 py-6">
            <h2 class="text-2xl font-bold">
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
            <p class="mt-1 text-sm opacity-80">Game Developer & Designer</p>
          </div>
          <ThemeToggle />

          <nav class="flex-1 overflow-y-auto px-4">
            <ul class="space-y-2 py-4">
              {["home", "experience", "projects"].map((section) => (
                <li>
                  <button
                    class={`flex w-full items-center rounded-lg px-4 py-3 font-medium transition-all duration-200 ${
                      activeSection() === section ? activeClass() : itemClass()
                    } ${isNavigating() ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={(e) =>
                      navigateToIsland(section, sectionToIslandMap[section], e)
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
                    <span class="capitalize">
                      {section}
                      {getNavigationStatus(section)}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  class={`flex w-full items-center rounded-lg px-4 py-3 font-medium transition-all duration-200 ${
                    activeSection() === "resume" ? activeClass() : itemClass()
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
                  <span>
                    Resume
                    {getNavigationStatus("resume")}
                  </span>
                </button>
              </li>
            </ul>
          </nav>

          <div class="border-t border-cyan-500/30 p-4 text-center text-xs opacity-70">
            <span>©{new Date().getFullYear()} David Solinsky</span>
          </div>
        </div>
      </aside>
    </>
  );
}

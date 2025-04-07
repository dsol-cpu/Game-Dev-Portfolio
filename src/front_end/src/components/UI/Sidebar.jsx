import { createSignal, createEffect, createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import ThemeToggle from "../ThemeToggle";
import { navigationStore } from "../../stores/navigation";

export default function Sidebar(props) {
  const { isDark } = createThemeManager();
  const [isOpen, setIsOpen] = createSignal(!props.isMobile);
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
    destinationSection,
  } = navigationStore;

  // Memoize theme classes for better performance
  const sidebarClass = createMemo(() =>
    isDark()
      ? "bg-slate-900 text-green-300 border-cyan-700 bg-gradient-to-b from-slate-900 to-blue-900/40"
      : "bg-slate-100 text-slate-800 border-emerald-400 bg-gradient-to-b from-slate-100 to-teal-200/50"
  );

  const itemClass = createMemo(() =>
    isDark()
      ? "hover:bg-blue-800/40 hover:text-yellow-300"
      : "hover:bg-emerald-200/60 hover:text-blue-800"
  );

  const activeClass = createMemo(() =>
    isDark()
      ? "bg-blue-900/60 text-green-400 border-l-4 border-green-500"
      : "bg-teal-200/70 text-blue-900 border-l-4 border-blue-600"
  );

  const sectionMap = {
    home: 0,
    experience: 1,
    projects: 2,
    resume: 3,
  };

  const portfolioSections = ["home", "experience", "projects", "resume"];

  const sectionIcons = {
    home: (
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
      </svg>
    ),
    experience: (
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
      </svg>
    ),
    projects: (
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
      </svg>
    ),
    resume: (
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>
      </svg>
    ),
  };

  const getNavigationStatus = createMemo(() => {
    return (section) => {
      if (isNavigating() && navigatingSection() === section) {
        return ` (Flying ${Math.round(navigationProgress())}%)`;
      }
      return "";
    };
  });

  // Notify parent of sidebar state changes
  const notifySidebarChange = (open) => {
    if (props.onToggle) {
      props.onToggle(open);
    }

    window.dispatchEvent(
      new CustomEvent("sidebarToggle", {
        detail: { isOpen: open },
      })
    );
  };

  // Function to scroll to a section in scroll view mode
  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });

      window.dispatchEvent(
        new CustomEvent("portfolioSectionChange", {
          detail: { section: sectionId },
        })
      );
    }
  };

  // Function to directly call the ship's navigation function
  const triggerShipNavigation = (islandIndex) => {
    if (
      window.shipNavigationInstance?.startNavigation &&
      typeof window.shipNavigationInstance.startNavigation === "function"
    ) {
      window.shipNavigationInstance.startNavigation(islandIndex);
    }
  };

  const navigateToSection = (sectionId, islandIndex, event) => {
    event.preventDefault();

    // Handle scroll view navigation
    if (props.isScrollView) {
      scrollToSection(sectionId);
      setActiveSection(sectionId);
      // Close sidebar on mobile after navigation
      if (props.isMobile) {
        setIsOpen(false);
        notifySidebarChange(false);
      }
      return;
    }

    // 3D view navigation
    setActiveSection(sectionId);
    setDestinationSection(sectionId);
    setNavigatingSection(sectionId);
    setTargetIsland(islandIndex);
    setIsNavigating(true);
    setNavigationProgress(0);

    // Direct trigger of ship navigation
    triggerShipNavigation(islandIndex);

    // Close sidebar on mobile after starting navigation
    if (props.isMobile) {
      setIsOpen(false);
      notifySidebarChange(false);
    }
  };

  // Reset active section when navigation completes
  createEffect(() => {
    if (!isNavigating() && navigatingSection()) {
      setActiveSection(destinationSection() || activeSection());
      setNavigatingSection(null);
    }
  });

  // Update isOpen when isMobile prop changes
  createEffect(() => {
    const newState = !props.isMobile;
    setIsOpen(newState);
    notifySidebarChange(newState);
  });

  // Set up intersection observer for scroll view
  createEffect(() => {
    if (!props.isScrollView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll("section[id]").forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  });

  // Listen for portfolio section changes
  createEffect(() => {
    const handleSectionChange = (event) => {
      if (props.isScrollView) {
        setActiveSection(event.detail.section);
      }
    };

    window.addEventListener("portfolioSectionChange", handleSectionChange);

    return () => {
      window.removeEventListener("portfolioSectionChange", handleSectionChange);
    };
  });

  // Early return if mobile
  if (props.isMobile) return null;

  return (
    <aside
      class={`sidebar fixed top-0 left-0 z-30 h-full border-r shadow-lg ${sidebarClass()} hidden md:block`}
      style={{
        width: "280px",
        transform: isOpen() ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
      }}
    >
      <div class="flex h-full flex-col pt-16">
        <div class="border-b border-cyan-500/30 px-6 py-6">
          <h2 class="text-2xl font-bold">
            <span
              class={`bg-gradient-to-r ${isDark() ? "from-green-400 to-cyan-400" : "from-blue-700 to-teal-600"} bg-clip-text text-transparent`}
            >
              David Solinsky
            </span>
          </h2>
          <p class="mt-1 text-sm opacity-80">Game Developer & Designer</p>
        </div>
        <ThemeToggle />
        <nav class="flex-1 overflow-y-auto px-4">
          <ul class="space-y-2 py-4">
            {portfolioSections.map((section) => {
              const isActive = activeSection() === section;
              const isNavigatingTo =
                isNavigating() && navigatingSection() === section;
              const isDisabled =
                isNavigating() && navigatingSection() !== section;
              return (
                <li>
                  <button
                    class={`flex w-full items-center rounded-lg px-4 py-3 font-medium transition-all duration-200
                      ${isActive || isNavigatingTo ? activeClass() : itemClass()}
                      ${isDisabled ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={(e) =>
                      navigateToSection(section, sectionMap[section], e)
                    }
                    disabled={isDisabled}
                  >
                    <span class="mr-3">{sectionIcons[section]}</span>
                    <span class="capitalize">
                      {section}
                      {!props.isScrollView && getNavigationStatus()(section)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div class="border-t border-cyan-500/30 p-4 text-center text-xs opacity-70">
          <span>David Solinsky ©{new Date().getFullYear()}</span>
        </div>
      </div>
    </aside>
  );
}

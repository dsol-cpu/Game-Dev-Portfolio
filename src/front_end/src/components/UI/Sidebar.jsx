import { createSignal, createEffect, createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import ThemeToggle from "../ThemeToggle";
import { navigationStore } from "../../stores/navigation";
import { viewStore } from "../../stores/view"; // Import the view store
import ViewToggleSwitch from "../UI/ViewToggleSwitch"; // Import the separated component
import Icon from "../icons/Icon";
import { ISLANDS } from "../../constants/islands";
export default function Sidebar(props) {
  const { isDark } = createThemeManager();
  const [isOpen, setIsOpen] = createSignal(!props.isMobile);
  const [activeSection, setActiveSection] = createSignal("home");
  const { state: viewState, toggleView } = viewStore;

  const {
    setTargetIsland,
    setIsNavigating,
    setDestinationSection,
    isNavigating,
    isArrived,
    setIsArrived,
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

  const portfolioSections = ["home", "experience", "projects", "resume"];

  const sectionIcons = {
    home: <Icon name="home" />,
    experience: <Icon name="experience" />,
    projects: <Icon name="projects" />,
    resume: <Icon name="resume" />,
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
    if (viewState.isScrollView) {
      scrollToSection(sectionId);
      setActiveSection(sectionId);
      // Close sidebar on mobile after navigation
      if (props.isMobile) {
        setIsOpen(false);
        notifySidebarChange(false);
      }
      return;
    }

    // Check if we're already at the destination and not currently navigating
    if (
      isArrived() &&
      !isNavigating() &&
      destinationSection() === sectionId &&
      activeSection() === sectionId
    ) {
      console.log("Already at destination:", sectionId);

      // Close sidebar on mobile even if we're not navigating
      if (props.isMobile) {
        setIsOpen(false);
        notifySidebarChange(false);
      }
      return; // Skip navigation if already arrived at destination
    }

    // Set up navigation state
    setActiveSection(sectionId);
    setDestinationSection(sectionId);
    setNavigatingSection(sectionId);
    setTargetIsland(islandIndex);
    setIsArrived(false);
    setIsNavigating(true);
    setNavigationProgress(0);

    // Direct trigger of ship navigation
    if (window.shipNavigationInstance?.startNavigation) {
      console.log(
        "Starting navigation to island:",
        islandIndex,
        "section:",
        sectionId
      );
      window.shipNavigationInstance.startNavigation(islandIndex);
    } else {
      console.error("Ship navigation instance not found!");
    }

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
    if (!viewState.isScrollView) return;

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
      if (viewState.isScrollView) {
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

        {/* Theme Toggle */}
        <ThemeToggle />

        <nav class="flex-1 overflow-y-auto px-4">
          <ul class="space-y-2 py-4">
            {portfolioSections.map((section) => {
              const isActive = activeSection() === section;
              const isNavigatingTo =
                isNavigating() && navigatingSection() === section;
              const isDisabled =
                isNavigating() && navigatingSection() !== section;

              // Check if this section is the current destination and we've arrived
              const isArrivedAtCurrentSection =
                isArrived() &&
                destinationSection() === section &&
                !isNavigating();

              return (
                <li>
                  <button
                    class={`flex w-full items-center rounded-lg px-4 py-3 font-medium transition-all duration-200
                      ${isActive || isNavigatingTo ? activeClass() : itemClass()}
                      ${isDisabled ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={(e) => {
                      // Don't allow clicking if we're currently navigating to any section
                      if (isNavigating()) {
                        return;
                      }
                      navigateToSection(section, ISLANDS[section], e);
                    }}
                    disabled={isDisabled}
                  >
                    <span class="mr-3">{sectionIcons[section]}</span>
                    <span class="capitalize">
                      {section}
                      {!viewState.isScrollView &&
                        getNavigationStatus()(section)}
                      {!viewState.isScrollView &&
                        isArrivedAtCurrentSection &&
                        " (Arrived)"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <ViewToggleSwitch
          isScrollView={() => viewState.isScrollView}
          onToggle={toggleView}
        />

        <div class="border-t border-cyan-500/30 p-4 text-center text-xs opacity-70">
          <span>David Solinsky © {new Date().getFullYear()}</span>
        </div>
      </div>
    </aside>
  );
}

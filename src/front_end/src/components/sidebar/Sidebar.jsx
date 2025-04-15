import { createSignal, createEffect, createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import { navigationStore } from "../../stores/navigation";
import { viewStore } from "../../stores/view";
import { deviceStore } from "../../stores/device";
import NavigationMenu from "./NavigationMenu";
import ThemeToggle from "../ThemeToggle";
import ViewToggleSwitch from "../ViewToggleSwitch";
import MobileMenuButton from "./MobileMenuButton";
import MobileMenu from "./MobileMenu";

export default function Sidebar(props) {
  const { isDark } = createThemeManager();
  const { isMobile, registerCleanup } = deviceStore;
  const [isOpen, setIsOpen] = createSignal(!isMobile());
  const [activeSection, setActiveSection] = createSignal("home");
  const { state: viewState, toggleView } = viewStore;
  const navigation = navigationStore;

  // Register cleanup for device store
  registerCleanup();

  const portfolioSections = ["about", "portfolio"];
  const portfolioTitles = { about: "About", portfolio: "Portfolio" };

  const sidebarClass = createMemo(
    () =>
      `sidebar fixed top-0 left-0 z-30 h-full border-r shadow-lg ${
        isDark()
          ? "bg-slate-900 text-green-300 border-cyan-700 bg-gradient-to-b from-slate-900 to-blue-900/40"
          : "bg-slate-100 text-slate-800 border-emerald-400 bg-gradient-to-b from-slate-100 to-teal-200/50"
      } ${isMobile() ? "hidden" : "hidden md:block"}`
  );

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

  const navigateToSection = (sectionId, islandIndex, event) => {
    event.preventDefault();

    // Handle scroll view navigation
    if (viewState.isScrollView) {
      scrollToSection(sectionId);
      setActiveSection(sectionId);

      // Close sidebar on mobile after navigation
      if (isMobile()) {
        setIsOpen(false);
        notifySidebarChange(false);
      }
      return;
    }

    // Skip navigation if already at destination
    if (
      navigation.isArrived() &&
      !navigation.isNavigating() &&
      navigation.destinationSection() === sectionId &&
      activeSection() === sectionId
    ) {
      // Close sidebar on mobile
      if (isMobile()) {
        setIsOpen(false);
        notifySidebarChange(false);
      }
      return;
    }

    // Set up navigation state
    setActiveSection(sectionId);
    navigation.setDestinationSection(sectionId);
    navigation.setNavigatingSection(sectionId);
    navigation.setTargetIsland(islandIndex);
    navigation.setIsArrived(false);
    navigation.setIsNavigating(true);
    navigation.setNavigationProgress(0);

    // Direct trigger of ship navigation
    if (window.shipNavigationInstance?.startNavigation) {
      window.shipNavigationInstance.startNavigation(islandIndex);
    } else {
      console.error("Ship navigation instance not found!");
    }

    // Close sidebar on mobile after starting navigation
    if (isMobile()) {
      setIsOpen(false);
      notifySidebarChange(false);
    }
  };

  // Reset active section when navigation completes
  createEffect(() => {
    if (!navigation.isNavigating() && navigation.navigatingSection()) {
      setActiveSection(navigation.destinationSection() || activeSection());
      navigation.setNavigatingSection(null);
    }
  });

  // Update isOpen when isMobile changes (using deviceStore instead of props)
  createEffect(() => {
    const newState = !isMobile();
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

  // Handle click outside mobile menu to close it
  createEffect(() => {
    if (!isMobile()) return;

    const handleClickOutside = (event) => {
      if (
        isOpen() &&
        !event.target.closest(".mobile-sidebar") &&
        !event.target.closest(".mobile-menu-toggle")
      ) {
        setIsOpen(false);
        notifySidebarChange(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });

  const nameGradient = createMemo(
    () =>
      `bg-gradient-to-r ${isDark() ? "from-green-400 to-cyan-400" : "from-blue-700 to-teal-600"} bg-clip-text text-transparent`
  );

  // Render mobile or desktop sidebar based on deviceStore's isMobile
  return (
    <>
      {isMobile() ? (
        <>
          <MobileMenuButton
            isOpen={isOpen}
            setIsOpen={(newState) => {
              setIsOpen(newState);
              notifySidebarChange(newState);
            }}
          />
          <MobileMenu
            isOpen={isOpen}
            isDark={isDark}
            portfolioSections={portfolioSections}
            portfolioSectionTitles={portfolioTitles}
            activeSection={activeSection}
            navigation={navigation}
            viewState={viewState}
            toggleView={toggleView}
            navigateToSection={navigateToSection}
          />
        </>
      ) : (
        <aside
          class={sidebarClass()}
          style={{
            width: "280px",
            transform: isOpen() ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease",
          }}
        >
          <div class="flex h-full flex-col pt-16">
            <div class="border-b border-cyan-500/30 px-6 py-6">
              <h2 class="text-2xl font-bold">
                <span class={nameGradient()}>David Solinsky</span>
              </h2>
              <p class="mt-1 text-sm opacity-80">Gameplay/Systems Programmer</p>
            </div>
            <ThemeToggle />

            <NavigationMenu
              sections={portfolioSections}
              sectionTitles={portfolioTitles}
              activeSection={activeSection}
              isNavigating={navigation.isNavigating}
              isArrived={navigation.isArrived}
              navigatingSection={navigation.navigatingSection}
              destinationSection={navigation.destinationSection}
              navigationProgress={navigation.navigationProgress}
              onNavigate={navigateToSection}
            />

            <ViewToggleSwitch
              isScrollView={() => viewState.isScrollView}
              onToggle={toggleView}
            />

            <div class="select-none border-t border-cyan-500/30 p-4 text-center text-xs opacity-70">
              <span> © {new Date().getFullYear()} David Solinsky</span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

import { createSignal, createEffect, createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import ThemeToggle from "../ThemeToggle";
import { navigationStore } from "../../stores/navigation";
import { viewStore } from "../../stores/view";
import ViewToggleSwitch from "../UI/ViewToggleSwitch";
import SidebarHeader from "./Header";
import NavigationMenu from "./NavigationMenu";
import SidebarFooter from "./Footer";

export default function Sidebar(props) {
  const { isDark } = createThemeManager();
  const [isOpen, setIsOpen] = createSignal(!props.isMobile);
  const [activeSection, setActiveSection] = createSignal("home");
  const { state: viewState, toggleView } = viewStore;

  const navigation = navigationStore;

  const sidebarClass = createMemo(
    () =>
      `sidebar fixed top-0 left-0 z-30 h-full border-r shadow-lg ${
        isDark()
          ? "bg-slate-900 text-green-300 border-cyan-700 bg-gradient-to-b from-slate-900 to-blue-900/40"
          : "bg-slate-100 text-slate-800 border-emerald-400 bg-gradient-to-b from-slate-100 to-teal-200/50"
      } hidden md:block`
  );

  const portfolioSections = ["home", "experience", "projects", "resume"];

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
      if (props.isMobile) {
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
      if (props.isMobile) {
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
    if (props.isMobile) {
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
      class={sidebarClass()}
      style={{
        width: "280px",
        transform: isOpen() ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
      }}
    >
      <div class="flex h-full flex-col pt-16">
        <SidebarHeader />

        <ThemeToggle />

        <NavigationMenu
          sections={portfolioSections}
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

        <SidebarFooter />
      </div>
    </aside>
  );
}

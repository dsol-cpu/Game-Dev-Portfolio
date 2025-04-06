import { createSignal, createEffect } from "solid-js";
import Sidebar from "./components/UI/Sidebar";
import MobileNav from "./components/UI/MobileNav";
import ThreeScene from "./components/ThreeScene";
import PagePortfolio from "./components/PagePortfolio";
import { createThemeManager } from "./stores/theme";
import { navigationStore } from "./stores/navigation";
import { resumeStore } from "./stores/resume";
import ResumeModal from "./components/UI/ResumeModal";

const App = () => {
  createThemeManager();
  const { setTargetIsland, setIsNavigating, setDestinationSection } =
    navigationStore;

  const [isSidebarOpen, setIsSidebarOpen] = createSignal(
    window.innerWidth >= 768
  );
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);
  const [isScrollView, setIsScrollView] = createSignal(false);
  const [activeSection, setActiveSection] = createSignal("home");
  // Keep ThreeScene mounted always, just hide it when not active
  const [isThreeSceneInitialized, setIsThreeSceneInitialized] =
    createSignal(true);

  // Create an effect to listen for sidebar toggle events and window resizes
  createEffect(() => {
    const handleSidebarToggle = (event) => {
      if (event.detail) {
        setIsSidebarOpen(event.detail.isOpen);
      }
    };

    const handleSectionChange = (event) => {
      if (event.detail && event.detail.section) {
        setActiveSection(event.detail.section);
      }
    };

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // On desktop (>= 768px), sidebar is open by default
      // On mobile (< 768px), sidebar is closed by default
      if (!mobile) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("sidebarToggle", handleSidebarToggle);
    window.addEventListener("portfolioSectionChange", handleSectionChange);
    window.addEventListener("resize", handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("sidebarToggle", handleSidebarToggle);
      window.removeEventListener("portfolioSectionChange", handleSectionChange);
      window.removeEventListener("resize", handleResize);
    };
  });

  const toggleView = () => {
    const newViewState = !isScrollView();

    // When switching to 3D view, ensure ThreeScene is initialized first
    if (!newViewState && !isThreeSceneInitialized()) {
      setIsThreeSceneInitialized(true);

      // Small delay to ensure ThreeScene is rendered before showing it
      setTimeout(() => {
        setIsScrollView(newViewState);
      }, 50);
    } else {
      setIsScrollView(newViewState);
    }

    // Notify components about view change
    const event = new CustomEvent("viewModeChanged", {
      detail: { isScrollView: newViewState, activeSection: activeSection() },
    });
    window.dispatchEvent(event);

    // Reset navigation state when switching to scroll view
    if (newViewState) {
      setIsNavigating(false);
      setDestinationSection(activeSection());
    }
  };

  return (
    <div class="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Desktop Sidebar - hidden on mobile */}
      <Sidebar
        onToggle={(isOpen) => setIsSidebarOpen(isOpen)}
        isMobile={isMobile()}
        isScrollView={isScrollView()}
      />

      {/* Mobile Navigation */}
      <MobileNav isScrollView={isScrollView()} />

      {/* Main Content Area - Full width on mobile, adjusted on desktop */}
      <main
        class={`flex-1 transition-all duration-300 ${isSidebarOpen() && !isMobile() ? "ml-[280px]" : "ml-0"}`}
      >
        {/* Keep ThreeScene mounted but hidden when not active */}
        <div
          style={{ display: isScrollView() ? "none" : "block", height: "100%" }}
        >
          <ThreeScene
            activeSection={activeSection()}
            isScrollView={isScrollView()}
          />
        </div>

        {/* Scroll/3D View Toggle Button - Skies of Arcadia themed */}
        <button
          onClick={toggleView}
          class="fixed bottom-4 right-4 z-50 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg hover:bg-blue-700 dark:bg-cyan-600 dark:hover:bg-cyan-700"
        >
          {isScrollView() ? "Switch to 3D View" : "View Traditional Portfolio"}
        </button>

        {/* Traditional Portfolio Page - Only shown when scrollView is active */}
        {isScrollView() && <PagePortfolio activeSection={activeSection()} />}
      </main>

      <ResumeModal
        isOpen={resumeStore.state.isModalOpen}
        onClose={resumeStore.closeResumeModal}
      />
    </div>
  );
};

export default App;

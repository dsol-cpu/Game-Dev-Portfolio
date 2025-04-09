import { createSignal, createEffect } from "solid-js";
import Sidebar from "./components/UI/Sidebar";
import MobileNav from "./components/UI/MobileNav";
import ThreeScene from "./components/ThreeScene";
import PagePortfolio from "./components/PagePortfolio";
import { createThemeManager } from "./stores/theme";
import { navigationStore } from "./stores/navigation";
import { resumeStore } from "./stores/resume";
import { viewStore } from "./stores/view";
import ResumeModal from "./components/UI/ResumeModal";
import { SvgSprite } from "./components/icons/SvgSprite";

const App = () => {
  createThemeManager();
  <SvgSprite />;
  const { setTargetIsland, setIsNavigating, setDestinationSection } =
    navigationStore;

  const [isSidebarOpen, setIsSidebarOpen] = createSignal(
    window.innerWidth >= 768
  );
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);
  // Use the viewStore instead of local state
  const { state: viewState, toggleView } = viewStore;
  const [activeSection, setActiveSection] = createSignal("home");
  // Keep ThreeScene mounted always, just hide it when not active
  const [isThreeSceneInitialized, setIsThreeSceneInitialized] =
    createSignal(false);

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

  // Effect to initialize ThreeScene when switching to 3D view
  createEffect(() => {
    if (!viewState.isScrollView && !isThreeSceneInitialized()) {
      setIsThreeSceneInitialized(true);
    }
  });

  return (
    <div class="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Desktop Sidebar - hidden on mobile */}
      <Sidebar
        onToggle={(isOpen) => setIsSidebarOpen(isOpen)}
        isMobile={isMobile()}
      />

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Main Content Area - Full width on mobile, adjusted on desktop */}
      <main
        class={`flex-1 transition-all duration-300 ${isSidebarOpen() && !isMobile() ? "ml-[280px]" : "ml-0"}`}
      >
        {/* Keep ThreeScene mounted but hidden when not active */}
        <div
          style={{
            display: viewState.isScrollView ? "none" : "block",
            height: "100%",
          }}
        >
          <ThreeScene
            activeSection={activeSection()}
            isScrollView={viewState.isScrollView}
          />
        </div>

        {/* Traditional Portfolio Page - Only shown when scrollView is active */}
        {viewState.isScrollView && (
          <PagePortfolio activeSection={activeSection()} />
        )}
      </main>

      <ResumeModal
        isOpen={resumeStore.state.isModalOpen}
        onClose={resumeStore.closeResumeModal}
      />
    </div>
  );
};

export default App;

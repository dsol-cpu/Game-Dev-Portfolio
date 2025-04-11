import { createEffect, createSignal } from "solid-js";
import Sidebar from "./components/sidebar/Sidebar";
import ThreeScene from "./components/ThreeScene";
import PagePortfolio from "./components/PagePortfolio";
import { createThemeManager } from "./stores/theme";
import { navigationStore } from "./stores/navigation";
import { resumeStore } from "./stores/resume";
import { viewStore } from "./stores/view";
import { deviceStore } from "./stores/device";
import ResumeModal from "./components/UI/ResumeModal";
import { SvgSprite } from "./components/icons/SvgSpriteSheet";

const SvgSpriteSheet = () => <SvgSprite />;

const App = () => {
  SvgSpriteSheet();
  createThemeManager();

  const { setTargetIsland, setIsNavigating, setDestinationSection } =
    navigationStore;
  const { state: viewState } = viewStore;
  const { isMobile, updateDeviceInfo, registerCleanup } = deviceStore;

  // Register cleanup for device store events
  registerCleanup();

  // Create local state for sidebar and active section
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(
    !isMobile() // Now using the deviceStore
  );

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
      // Using deviceStore's isMobile signal - will update automatically

      // On desktop, sidebar is open by default
      // On mobile, sidebar is closed by default
      !isMobile() ? setIsSidebarOpen(true) : setIsSidebarOpen(false);
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
      {/* Sidebar component */}
      <Sidebar
        onToggle={(isOpen) => setIsSidebarOpen(isOpen)}
        isMobile={isMobile()}
      />

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

import { createSignal, createEffect } from "solid-js";
import Sidebar from "./components/UI/Sidebar";
import MobileNav from "./components/UI/MobileNav";
import ThreeScene from "./components/ThreeScene";
import PagePortfolio from "./components/PagePortfolio";
import { createThemeManager } from "./stores/theme";

createThemeManager();
const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(
    window.innerWidth >= 768
  );
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);
  const [isScrollView, setIsScrollView] = createSignal(false);

  // Create an effect to listen for sidebar toggle events and window resizes
  createEffect(() => {
    const handleSidebarToggle = (event) => {
      if (event.detail) {
        setIsSidebarOpen(event.detail.isOpen);
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
    window.addEventListener("resize", handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("sidebarToggle", handleSidebarToggle);
      window.removeEventListener("resize", handleResize);
    };
  });

  const toggleView = () => {
    setIsScrollView(!isScrollView());
  };

  return (
    <div
      class={`${isScrollView() ? "overflow-auto" : "overflow-hidden"} w-screen`}
    >
      <div class={`flex ${isScrollView() ? "h-screen" : "h-screen"}`}>
        {/* Desktop Sidebar - hidden on mobile */}
        <Sidebar
          onToggle={(isOpen) => setIsSidebarOpen(isOpen)}
          isMobile={isMobile()}
        />

        {/* Mobile Navigation */}
        <MobileNav show={isMobile()} />

        {/* Main Content Area - Full width on mobile, adjusted on desktop */}
        <main
          class={`w-full h-full relative ${isMobile() ? "" : isSidebarOpen() ? "md:ml-64" : ""}`}
          style={{ transition: "margin-left 0.3s ease" }}
        >
          <ThreeScene />

          {/* Scroll/3D View Toggle Button - Skies of Arcadia themed */}
          <button
            onClick={toggleView}
            class="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-2 font-bold text-amber-100 transition-transform duration-300 border-2 border-yellow-600 rounded shadow-lg hover:scale-105 bg-gradient-to-b from-blue-800 to-blue-950 z-10"
          >
            {isScrollView()
              ? "Switch to 3D View"
              : "View Traditional Portfolio"}
          </button>
        </main>
      </div>

      {/* Traditional Portfolio Page - Only shown when scrollView is active */}
      {isScrollView() && <PagePortfolio />}
    </div>
  );
};

export default App;

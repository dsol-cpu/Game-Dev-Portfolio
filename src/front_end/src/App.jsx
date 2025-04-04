import { createSignal, createEffect } from "solid-js";
import Sidebar from "./components/UI/Sidebar";
import MobileNav from "./components/UI/MobileNav";
import ThreeScene from "./components/ThreeScene";
import { createThemeManager } from "./stores/theme";

createThemeManager();
const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(
    window.innerWidth >= 768
  );
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);

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

  return (
    <div class="flex h-screen w-screen overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <Sidebar
        onToggle={(isOpen) => setIsSidebarOpen(isOpen)}
        isMobile={isMobile()}
      />

      {/* Mobile Navigation */}
      <MobileNav show={isMobile()} />

      {/* Main Content Area - Full width on mobile, adjusted on desktop */}
      <main
        class={`w-full h-full ${isMobile() ? "" : isSidebarOpen() ? "md:ml-64" : ""}`}
        style={{ transition: "margin-left 0.3s ease" }}
      >
        <ThreeScene />
      </main>
    </div>
  );
};

export default App;

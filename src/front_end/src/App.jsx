import { createEffect, createSignal, onMount } from "solid-js";
import NavBar from "./components/NavBar";
import PagePortfolio from "./components/PagePortfolio";
import { createThemeManager } from "./stores/theme";
import { resumeStore } from "./stores/resume";
import { deviceStore } from "./stores/device";
import ResumeModal from "./components/ResumeModal";
import { SvgSprite } from "./components/icons/SvgSpriteSheet";
import { PORTFOLIO_ITEMS } from "./constants/portfolio";
const SvgSpriteSheet = () => <SvgSprite />;

const App = () => {
  SvgSpriteSheet();
  createThemeManager();

  const { isMobile, registerCleanup } = deviceStore;
  const [modelsPreloaded, setModelsPreloaded] = createSignal(false);

  // Register cleanup for device store events
  registerCleanup();

  // Create local state for active section
  const [activeSection, setActiveSection] = createSignal("about");

  // Create an effect to listen for section changes
  createEffect(() => {
    const handleSectionChange = (event) => {
      if (event.detail && event.detail.section) {
        setActiveSection(event.detail.section);
      }
    };

    window.addEventListener("portfolioSectionChange", handleSectionChange);

    return () => {
      window.removeEventListener("portfolioSectionChange", handleSectionChange);
    };
  });

  // Initial section display
  createEffect(() => {
    // Initial setup to show the home section and hide others
    const portfolioSections = ["about", "experience", "projects", "resume"];
    portfolioSections.forEach((id) => {
      const section = document.getElementById(id);
      if (section) {
        section.style.display = id === "about" ? "block" : "none";
      }
    });
  });

  return (
    <div class="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      {/* Top Navigation bar */}
      <NavBar />

      {/* Main Content Area with top padding for the navbar */}
      <main class="flex-1 pt-16">
        {/* Traditional Portfolio Page */}
        <PagePortfolio
          activeSection={activeSection()}
          modelsPreloaded={modelsPreloaded()}
        />
      </main>

      <ResumeModal
        isOpen={resumeStore.state.isModalOpen}
        onClose={resumeStore.closeResumeModal}
      />
    </div>
  );
};

export default App;

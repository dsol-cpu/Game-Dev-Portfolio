import {
  createSignal,
  onMount,
  createEffect,
  createMemo,
  Show,
} from "solid-js";
import AboutSection from "./AboutSection";
import PortfolioSection from "./PortfolioSection";
import { navigationStore } from "../stores/navigation";
import { createThemeManager } from "../stores/theme";

const GRID_CONFIG = {
  SIZE: "40px",
  LINE_THICKNESS: "2px",
};

// Define sections with proper components
const SECTIONS = {
  about: AboutSection,
  portfolio: PortfolioSection,
};

const PagePortfolio = () => {
  // Use a signal for the active section
  const [activeSection, setActiveSection] = createSignal("about");
  const { navigatingSection, setNavigatingSection, destinationSection } =
    navigationStore;
  const { isDark } = createThemeManager();

  // Simplified styles using createMemo
  const styles = createMemo(() => ({
    container: `relative min-h-screen inset-0 overflow-auto ${isDark() ? "bg-blue-950" : "bg-blue-50"} z-0 pt-16`,
    section: `${isDark() ? "bg-blue-950" : "bg-white"} shadow-lg rounded-lg p-6 border-2 ${isDark() ? "border-blue-800" : "border-blue-200"} relative z-10`,
  }));

  // Background grid styles
  const gridBackgroundStyle = createMemo(() => ({
    "background-color": isDark() ? "#172554" : "#eff6ff",
    "background-image": `
      linear-gradient(${isDark() ? "rgba(255, 255, 255, 0.15)" : "rgba(59, 130, 246, 0.15)"} ${GRID_CONFIG.LINE_THICKNESS}, transparent ${GRID_CONFIG.LINE_THICKNESS}),
      linear-gradient(90deg, ${isDark() ? "rgba(255, 255, 255, 0.15)" : "rgba(59, 130, 246, 0.15)"} ${GRID_CONFIG.LINE_THICKNESS}, transparent ${GRID_CONFIG.LINE_THICKNESS})
    `,
    "background-size": `${GRID_CONFIG.SIZE} ${GRID_CONFIG.SIZE}`,
  }));

  // Gradient overlay style
  const gradientStyle = createMemo(() => ({
    background: isDark()
      ? "radial-gradient(circle at 50% 50%, rgba(23, 37, 84, 0.1) 0%, rgba(23, 37, 84, 0.7) 100%)"
      : "radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 0.1) 0%, rgba(239, 246, 255, 0.7) 100%)",
  }));

  // Listen for portfolio section changes from custom events
  onMount(() => {
    const handleSectionChange = (event) => {
      console.log("PagePortfolio - Event received:", event.type, event.detail);

      if (event.detail?.section) {
        const newSection = event.detail.section;
        console.log("PagePortfolio - Setting section to:", newSection);
        setActiveSection(newSection);
      }
    };

    // Add event listeners
    window.addEventListener("portfolioSectionChange", handleSectionChange);

    // Setup a global handler as a backup approach
    window.setPortfolioSection = (section) => {
      console.log("Global section setter called with:", section);
      setActiveSection(section);
    };

    // Cleanup on component unmount
    return () => {
      window.removeEventListener("portfolioSectionChange", handleSectionChange);
      delete window.setPortfolioSection;
    };
  });

  // Debug section changes
  createEffect(() => {
    const current = activeSection();
    console.log("PagePortfolio - Active section changed to:", current);
    console.log("Available component:", SECTIONS[current] ? "Yes" : "No");
  });

  // Force re-rendering on section change
  const sectionKey = createMemo(
    () => `section-${activeSection()}-${Date.now()}`
  );

  return (
    <div id="portfolio-container" class={styles().container}>
      {/* Grid background */}
      <div
        class="fixed inset-0 pointer-events-none z-0 bg-repeat"
        style={gridBackgroundStyle()}
      />

      {/* Gradient overlay */}
      <div
        class="fixed inset-0 pointer-events-none z-2"
        style={gradientStyle()}
      />

      <div class="container mx-auto px-4 py-8 relative z-10">
        <div key={sectionKey()}>
          <Show
            when={activeSection() === "about"}
            fallback={
              <Show
                when={activeSection() === "portfolio"}
                fallback={<div>Unknown section: {activeSection()}</div>}
              >
                <section id="portfolio" class="mb-16">
                  <div class={styles().section}>
                    <PortfolioSection isDark={isDark} />
                  </div>
                </section>
              </Show>
            }
          >
            <section id="about" class="mb-16">
              <div class={styles().section}>
                <AboutSection isDark={isDark} />
              </div>
            </section>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default PagePortfolio;

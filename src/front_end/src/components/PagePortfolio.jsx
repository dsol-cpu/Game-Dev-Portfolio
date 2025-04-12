import { createSignal, onMount, createEffect, createMemo } from "solid-js";
import AboutSection from "./AboutSection";
import PortfolioSection from "./PortfolioSection";
import ResumeSection from "./ResumeSection";
import { createThemeManager } from "../stores/theme";
import Footer from "./Footer";

const GRID_CONFIG = {
  SIZE: "40px",
  LINE_THICKNESS: "2px",
  DARK_LINE_THICKNESS: "2px",
  CURSOR_GLOW_SIZE: 280,
  CURSOR_INTENSITY: 0.9,
  GLOW_EDGE_SHARPNESS: "95%",
};

const SECTIONS = [
  { id: "about", title: "About", Component: AboutSection },
  { id: "portfolio", title: "Portfolio", Component: PortfolioSection },
  { id: "resume", title: "Resume", Component: ResumeSection },
];

const PagePortfolio = () => {
  // Default to home section
  const [activeSection, setActiveSection] = createSignal("about");
  const [mousePosition, setMousePosition] = createSignal({ x: 0, y: 0 });
  const [isMouseMoving, setIsMouseMoving] = createSignal(false);
  const themeManager = createThemeManager();
  const isDark = themeManager.isDark;

  const styles = createMemo(() => ({
    container: `relative min-h-screen w-full inset-0 overflow-auto ${isDark() ? "bg-blue-950" : "bg-blue-50"} z-0`,
    section: `${isDark() ? "bg-blue-950" : "bg-white"} shadow-lg rounded-lg p-6 border-2 ${isDark() ? "border-blue-800" : "border-blue-200"} relative z-10 h-full`,
    heading: `text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-900"} mb-6 border-b-2 pb-2`,
    sectionContainer: `transition-opacity duration-300 ease-in-out w-full h-full flex flex-col`,
  }));

  const backgroundStyles = createMemo(() => {
    if (isDark()) {
      return {
        backgroundColor: "#0f172a",
        gridColor: "rgba(255, 255, 255, 0.08)",
        highlightColor: "rgba(56, 189, 248, 0.35)",
      };
    } else {
      return {
        backgroundColor: "#dbeafe",
        gridColor: "rgba(59, 130, 246, 0.08)",
        highlightColor: "rgba(37, 99, 235, 0.35)",
      };
    }
  });

  const gradientStyle = createMemo(() => ({
    background: isDark()
      ? "radial-gradient(circle at 50% 50%, rgba(23, 37, 84, 0.1) 0%, rgba(23, 37, 84, 0.7) 100%)"
      : "radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 0.1) 0%, rgba(239, 246, 255, 0.7) 100%)",
  }));

  const gridBackgroundStyle = createMemo(() => ({
    "background-color": backgroundStyles().backgroundColor,
    "background-image": `
      linear-gradient(${backgroundStyles().gridColor} ${GRID_CONFIG.DARK_LINE_THICKNESS}, transparent ${GRID_CONFIG.DARK_LINE_THICKNESS}),
      linear-gradient(90deg, ${backgroundStyles().gridColor} ${GRID_CONFIG.DARK_LINE_THICKNESS}, transparent ${GRID_CONFIG.DARK_LINE_THICKNESS})
    `,
    "background-size": `${GRID_CONFIG.SIZE} ${GRID_CONFIG.SIZE}`,
  }));

  const cursorGlowStyle = createMemo(() => {
    const { x, y } = mousePosition();
    return {
      position: "fixed",
      pointerEvents: "none",
      width: `${GRID_CONFIG.CURSOR_GLOW_SIZE}px`,
      height: `${GRID_CONFIG.CURSOR_GLOW_SIZE}px`,
      borderRadius: "50%",
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
      background: `radial-gradient(circle, ${backgroundStyles().highlightColor} ${GRID_CONFIG.GLOW_EDGE_SHARPNESS}, transparent ${GRID_CONFIG.GLOW_EDGE_SHARPNESS})`,
      opacity: isMouseMoving() ? GRID_CONFIG.CURSOR_INTENSITY : 0,
      transition: "opacity 0.5s ease-out",
      boxShadow: isDark()
        ? `0 0 20px 10px rgba(56, 189, 248, 0.1)`
        : `0 0 20px 10px rgba(37, 99, 235, 0.1)`,
      zIndex: 1,
    };
  });

  const highlightedCellStyle = createMemo(() => {
    const { x, y } = mousePosition();
    const cellSize = parseInt(GRID_CONFIG.SIZE);
    const cellX = Math.floor(x / cellSize) * cellSize;
    const cellY = Math.floor(y / cellSize) * cellSize;

    return {
      position: "fixed",
      pointerEvents: "none",
      left: `${cellX}px`,
      top: `${cellY}px`,
      width: GRID_CONFIG.SIZE,
      height: GRID_CONFIG.SIZE,
      backgroundColor: isDark()
        ? "rgba(56, 189, 248, 0.15)"
        : "rgba(37, 99, 235, 0.15)",
      opacity: isMouseMoving() ? 1 : 0,
      transition: "opacity 0.5s ease-out",
      zIndex: 1,
    };
  });

  onMount(() => {
    // Set up mouse tracking
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      setIsMouseMoving(true);

      clearTimeout(window.mouseTimeout);
      window.mouseTimeout = setTimeout(() => {
        setIsMouseMoving(false);
      }, 1500);
    };

    document.addEventListener("mousemove", handleMouseMove);

    // Listen for section change events from the navbar
    const handleSectionChange = (event) => {
      setActiveSection(event.detail.section);
    };

    window.addEventListener("portfolioSectionChange", handleSectionChange);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("portfolioSectionChange", handleSectionChange);
      clearTimeout(window.mouseTimeout);
    };
  });

  // Render a section with conditional visibility
  const renderSection = (id, title, Component) => (
    <div
      id={id}
      class={styles().sectionContainer}
      style={{
        display: activeSection() === id ? "flex" : "none",
        opacity: activeSection() === id ? 1 : 0,
      }}
    >
      <section class="flex-1 w-full">
        <div class={styles().section}>
          <Component isDark={isDark} />
        </div>
      </section>
    </div>
  );

  return (
    <div id="portfolio-container" class={styles().container}>
      {/* Static grid background */}
      <div
        class="fixed inset-0 pointer-events-none z-0 bg-repeat"
        style={gridBackgroundStyle()}
      />

      {/* Cursor glow effect */}
      <div style={cursorGlowStyle()} />

      {/* Highlighted cell effect */}
      <div style={highlightedCellStyle()} />

      {/* Gradient overlay */}
      <div
        class="fixed inset-0 pointer-events-none z-2"
        style={gradientStyle()}
      />

      <div class="flex flex-col min-h-screen w-full">
        {/* Main content container - full height and width */}
        <div class="flex-1 w-full p-4 relative z-10">
          {/* Render all sections using the toggle pattern */}
          {SECTIONS.map((section) =>
            renderSection(section.id, section.title, section.Component)
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default PagePortfolio;

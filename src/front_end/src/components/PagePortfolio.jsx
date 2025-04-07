import { createSignal, onMount, createEffect, createMemo } from "solid-js";
import ProjectCard from "./UI/ProjectCard";
import AboutSection from "./UI/AboutSection";
import ExperienceSection from "./UI/ExperienceSection";
import { navigationStore } from "../stores/navigation";
import { createThemeManager } from "../stores/theme";

const GRID_CONFIG = {
  SIZE: "40px",
  LINE_THICKNESS: "2px",
};

const PROJECTS = [
  {
    id: 1,
    title: "Portfolio Website",
    description: "A 3D game built with SolidJS and Three.js ",
    technologies: ["SolidJS", "Three.js", "JavaScript"],
    // imageUrl: "/assets/images/projects/space-explorer.jpg",
    githubUrl: "https://github.com/dsol-cpu/Game-Dev-Portfolio",
    demoUrl: "https://dsol-cpu.github.io/Game-Dev-Portfolio/",
  },
];

const SECTIONS = [
  { id: "home", title: "", Component: AboutSection },
  { id: "experience", title: "", Component: ExperienceSection },
];

const PagePortfolio = () => {
  const [activeSection, setActiveSection] = createSignal("about");
  const { navigatingSection, setNavigatingSection } = navigationStore;
  const themeManager = createThemeManager();
  const isDark = themeManager.isDark;

  const styles = createMemo(() => ({
    container: `relative min-h-screen inset-0 overflow-auto ${isDark() ? "bg-blue-950" : "bg-blue-50"} z-0 pt-16`,
    section: `${isDark() ? "bg-blue-950" : "bg-white"} shadow-lg rounded-lg p-6 border-2 ${isDark() ? "border-blue-800" : "border-blue-200"} relative z-10`,
    heading: `text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-900"} mb-6 border-b-2 pb-2`,
  }));

  const backgroundStyles = createMemo(() => {
    if (isDark()) {
      return {
        backgroundColor: "#172554", // dark mode bg (blue-950)
        gridColor: "rgba(255, 255, 255, 0.15)", // White lines for dark mode
      };
    } else {
      return {
        backgroundColor: "#eff6ff", // light mode bg (blue-50)
        gridColor: "rgba(59, 130, 246, 0.15)", // Blue lines for light mode
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
      linear-gradient(${backgroundStyles().gridColor} ${GRID_CONFIG.LINE_THICKNESS}, transparent ${GRID_CONFIG.LINE_THICKNESS}),
      linear-gradient(90deg, ${backgroundStyles().gridColor} ${GRID_CONFIG.LINE_THICKNESS}, transparent ${GRID_CONFIG.LINE_THICKNESS})
    `,
    "background-size": `${GRID_CONFIG.SIZE} ${GRID_CONFIG.SIZE}`,
  }));

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(sectionId);
    }
  };

  onMount(() => {
    // Section observer setup with options
    const observerOptions = { threshold: 0.5, rootMargin: "0px" };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
          window.dispatchEvent(
            new CustomEvent("portfolioSectionChange", {
              detail: { section: entry.target.id },
            })
          );
          break;
        }
      }
    }, observerOptions);

    document
      .querySelectorAll("section[id]")
      .forEach((section) => observer.observe(section));

    // Cleanup
    return () => {
      observer.disconnect();
    };
  });

  // Handle navigation from sidebar
  createEffect(() => {
    const sectionToNavigate = navigatingSection();
    if (sectionToNavigate) {
      scrollToSection(sectionToNavigate);
      setNavigatingSection(null);
    }
  });

  const renderSection = (id, title, Component) => (
    <section id={id} class="mb-16 scroll-mt-16">
      <div class={styles().section}>
        {title && <h2 class={styles().heading}>{title}</h2>}
        <Component />
      </div>
    </section>
  );

  return (
    <div id="portfolio-container" class={styles().container}>
      {/* Static grid background */}
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
        {/* Render predefined sections */}
        {SECTIONS.map((section) =>
          renderSection(section.id, section.title, section.Component)
        )}

        {/* Projects section with special rendering for the grid */}
        <section id="projects" class="mb-16 scroll-mt-16">
          <div class={styles().section}>
            <h2 class={styles().heading}>Projects</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROJECTS.map((project) => (
                <ProjectCard project={project} key={project.id} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PagePortfolio;

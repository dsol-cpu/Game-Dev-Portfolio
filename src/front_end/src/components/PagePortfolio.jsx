import { createSignal, onMount, createEffect } from "solid-js";
import ProjectCard from "./UI/ProjectCard";
import AboutSection from "./UI/AboutSection";
import ExperienceSection from "./UI/ExperienceSection";
import { navigationStore } from "../stores/navigation";
import { createThemeManager } from "../stores/theme";

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

const PagePortfolio = () => {
  const [activeSection, setActiveSection] = createSignal("about");
  const { navigatingSection, setNavigatingSection } = navigationStore;
  const themeManager = createThemeManager();
  const isDark = themeManager.isDark;

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    setActiveSection(sectionId);
  };

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            window.dispatchEvent(
              new CustomEvent("portfolioSectionChange", {
                detail: { section: entry.target.id },
              })
            );
          }
        });
      },
      { threshold: 0.5 }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
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
      <div
        class={`${isDark() ? "bg-blue-950" : "bg-white"} shadow-lg rounded-lg p-6 border-2 ${isDark() ? "border-blue-800" : "border-blue-200"}`}
      >
        <h2
          class={`text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-900"} mb-6 border-b-2 border-yellow-500 pb-2`}
        >
          {title}
        </h2>
        <Component />
      </div>
    </section>
  );

  const currentYear = new Date().getFullYear();

  return (
    <div
      class={`relative h-screen inset-0 overflow-auto ${isDark() ? "bg-blue-950" : "bg-blue-50"} z-0 pt-16`}
    >
      <div class="container mx-auto px-4 py-8">
        {renderSection("home", "", AboutSection)}
        {renderSection("experience", "", ExperienceSection)}

        <section id="projects" class="mb-16 scroll-mt-16">
          <div
            class={`${isDark() ? "bg-blue-950" : "bg-white"} shadow-lg rounded-lg p-6 border-2 ${isDark() ? "border-blue-800" : "border-blue-200"}`}
          >
            <h2
              class={`text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-900"} mb-6 border-b-2 border-yellow-500 pb-2`}
            >
              Projects
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROJECTS.map((project) => (
                <ProjectCard project={project} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PagePortfolio;

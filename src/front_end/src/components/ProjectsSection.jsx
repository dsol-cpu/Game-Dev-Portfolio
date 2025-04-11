import ProjectCard from "./UI/ProjectCard";
import { createMemo } from "solid-js";
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

const ProjectsSection = () => {
  const { isDark } = createThemeManager();

  const styles = createMemo(() => ({
    heading: `text-3xl font-bold ${isDark() ? "text-blue-300" : "text-blue-900"} mb-6 border-b-2 pb-2`,
  }));

  return (
    <>
      <h2 class={styles().heading}>Projects</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROJECTS.map((project) => (
          <ProjectCard project={project} key={project.id} />
        ))}
      </div>
    </>
  );
};

export default ProjectsSection;

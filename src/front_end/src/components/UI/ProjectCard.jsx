import { Show, createMemo } from "solid-js";
import { createThemeManager } from "../../stores/theme";
import { Icon } from "../icons/Icon";

const ProjectCard = (props) => {
  const themeManager = createThemeManager();
  const isDark = themeManager.isDark;

  const styles = createMemo(() => ({
    card: `rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border ${isDark() ? "bg-blue-900 border-blue-800" : "bg-blue-50 border-blue-100"}`,
    header: `relative h-48 ${isDark() ? "bg-blue-800" : "bg-blue-200"}`,
    placeholderBg: `flex items-center justify-center h-full ${isDark() ? "bg-gradient-to-br from-blue-900 to-blue-800" : "bg-gradient-to-br from-blue-300 to-blue-200"}`,
    placeholderText: `font-bold text-xl ${isDark() ? "text-blue-100" : "text-blue-900"}`,
    title: `text-xl font-bold mb-2 ${isDark() ? "text-blue-100" : "text-blue-900"}`,
    description: `mb-4 ${isDark() ? "text-gray-300" : "text-gray-700"}`,
    techBadge: `text-xs px-2 py-1 rounded ${isDark() ? "bg-blue-800 text-blue-200" : "bg-blue-100 text-blue-800"}`,
    iconLink: `flex items-center justify-center p-2 rounded-full transition-colors ${isDark() ? "text-blue-300 hover:text-blue-200 hover:bg-blue-800" : "text-blue-700 hover:text-blue-900 hover:bg-blue-100"}`,
    demoLink: `bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-sm font-medium text-blue-900`,
  }));
  const GithubIcon = <Icon name="github" size="24px" />;
  return (
    <div class={styles().card}>
      <div class={styles().header}>
        <Show
          when={props.project.imageUrl}
          fallback={
            <div class={styles().placeholderBg}>
              <span class={styles().placeholderText}>
                {props.project.title}
              </span>
            </div>
          }
        >
          <img
            src={props.project.imageUrl}
            alt={props.project.title}
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </Show>
      </div>

      <div class="p-4">
        <h3 class={styles().title}>{props.project.title}</h3>
        <p class={styles().description}>{props.project.description}</p>

        <div class="mb-4">
          <div class="flex flex-wrap gap-2">
            {props.project.technologies.map((tech) => (
              <span class={styles().techBadge}>{tech}</span>
            ))}
          </div>
        </div>

        <div class="flex justify-between items-center">
          <a
            name="github"
            href={props.project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            class={styles().iconLink}
            aria-label={`GitHub repository for ${props.project.title}`}
          >
            <GithubIcon />
          </a>
          <a
            href={props.project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            class={styles().demoLink}
            aria-label={`Live demo for ${props.project.title}`}
          >
            Live Demo
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;

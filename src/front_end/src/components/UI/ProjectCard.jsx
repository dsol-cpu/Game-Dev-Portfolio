import { Show } from "solid-js";
import { createThemeManager } from "../../stores/theme"; // Adjust path as needed

const ProjectCard = (props) => {
  const themeManager = createThemeManager();
  const isDark = themeManager.isDark;

  return (
    <div
      class={`${isDark() ? "bg-blue-900 border-blue-800" : "bg-blue-50 border-blue-100"} rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border`}
    >
      <div class={`relative h-48 ${isDark() ? "bg-blue-800" : "bg-blue-200"}`}>
        <Show
          when={props.project.imageUrl}
          fallback={
            <div
              class={`flex items-center justify-center h-full ${isDark() ? "bg-gradient-to-br from-blue-900 to-blue-800" : "bg-gradient-to-br from-blue-300 to-blue-200"}`}
            >
              <span
                class={`${isDark() ? "text-blue-100" : "text-blue-900"} font-bold text-xl`}
              >
                {props.project.title}
              </span>
            </div>
          }
        >
          <img
            src={props.project.imageUrl}
            alt={props.project.title}
            class="w-full h-full object-cover"
          />
        </Show>
      </div>

      <div class="p-4">
        <h3
          class={`text-xl font-bold ${isDark() ? "text-blue-100" : "text-blue-900"} mb-2`}
        >
          {props.project.title}
        </h3>
        <p class={`${isDark() ? "text-gray-300" : "text-gray-700"} mb-4`}>
          {props.project.description}
        </p>

        <div class="mb-4">
          <div class="flex flex-wrap gap-2">
            {props.project.technologies.map((tech) => (
              <span
                class={`${isDark() ? "bg-blue-800 text-blue-200" : "bg-blue-100 text-blue-800"} text-xs px-2 py-1 rounded`}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div class="flex justify-between">
          <a
            href={props.project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            class={`${isDark() ? "text-blue-300 hover:text-blue-200" : "text-blue-700 hover:text-blue-900"} font-medium`}
          >
            GitHub
          </a>
          <a
            href={props.project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            class={`bg-yellow-500 hover:bg-yellow-600 ${isDark() ? "text-blue-900" : "text-blue-900"} px-3 py-1 rounded text-sm font-medium`}
          >
            Live Demo
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;

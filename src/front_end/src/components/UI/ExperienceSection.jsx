import { createSignal, For, Show } from "solid-js";
import { createThemeManager } from "../../stores/theme";

const ExperienceSection = () => {
  const [selectedCategory, setSelectedCategory] = createSignal("all");
  const [expandedProject, setExpandedProject] = createSignal(null);
  const { isDark } = createThemeManager();

  const categories = [
    { id: "all", label: "All Projects" },
    { id: "shipped", label: "Shipped Games" },
    { id: "professional", label: "Professional Work" },
  ];

  const experiences = [
    {
      id: 1,
      title: "Gameplay Programmer",
      project: "Quick Quisine",
      company: "",
      period: "2021",
      description: "WarioWare-like Cooking game.",
      category: "shipped",
      responsibilities: ["Made the art", "Made DDR-like minigame"],
      technologies: ["SFML", "C++", "Git"],
    },
  ];

  const filteredExperiences = () =>
    selectedCategory() === "all"
      ? experiences
      : experiences.filter((exp) => exp.category === selectedCategory());

  const toggleProject = (id) =>
    setExpandedProject(expandedProject() === id ? null : id);

  const categoryLabel = (category) =>
    category === "shipped"
      ? "Shipped Game"
      : category === "professional"
        ? "Professional Work"
        : "Personal Project";

  return (
    <div class="space-y-12">
      <div class="flex items-center justify-between">
        <h2
          class={`text-3xl font-bold ${isDark() ? "text-blue-100" : "text-blue-900"}`}
        >
          Game Development Portfolio
        </h2>

        <div class="flex flex-wrap gap-2">
          <For each={categories}>
            {(category) => (
              <button
                onClick={() => setSelectedCategory(category.id)}
                class={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory() === category.id
                    ? "bg-blue-600 text-white shadow-md scale-105"
                    : isDark()
                      ? "bg-blue-900/60 text-blue-200 hover:bg-blue-800 hover:scale-105"
                      : "bg-blue-100/80 text-blue-800 hover:bg-blue-200 hover:scale-105"
                }`}
              >
                {category.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <For each={filteredExperiences()}>
          {(exp) => (
            <div
              class={`rounded-xl overflow-hidden transition-all duration-300 ${
                isDark()
                  ? "bg-gray-800/50 hover:bg-gray-800"
                  : "bg-white hover:bg-blue-50"
              } shadow-lg hover:shadow-xl transform hover:-translate-y-1`}
            >
              <div class="relative h-48 overflow-hidden">
                <img
                  src={exp.imageUrl}
                  alt={exp.project}
                  class="w-full h-full object-cover"
                />
                <div
                  class={`absolute inset-0 bg-gradient-to-t ${
                    isDark()
                      ? "from-gray-900/90 to-transparent"
                      : "from-blue-900/70 to-transparent"
                  }`}
                ></div>
                <div class="absolute bottom-0 left-0 p-4 w-full">
                  <span class="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-600/90 text-white mb-2">
                    {categoryLabel(exp.category)}
                  </span>
                  <h3 class="text-xl font-bold text-white">{exp.project}</h3>
                  <p class="text-sm text-gray-200">
                    {exp.company} {exp.company && "•"} {exp.period}
                  </p>
                </div>
              </div>

              <div class="p-5">
                <h4
                  class={`font-medium mb-3 ${isDark() ? "text-blue-300" : "text-blue-700"}`}
                >
                  {exp.title}
                </h4>

                <p
                  class={`text-sm mb-4 ${isDark() ? "text-gray-300" : "text-gray-600"}`}
                >
                  {exp.description}
                </p>

                <div class="flex flex-wrap gap-2 mb-4">
                  <For each={exp.technologies.slice(0, 3)}>
                    {(tech) => (
                      <span
                        class={`px-3 py-1 rounded-full text-xs font-medium ${
                          isDark()
                            ? "bg-blue-900/60 text-blue-200"
                            : "bg-blue-100/80 text-blue-800"
                        }`}
                      >
                        {tech}
                      </span>
                    )}
                  </For>
                  <Show when={exp.technologies.length > 3}>
                    <span
                      class={`px-3 py-1 rounded-full text-xs font-medium ${
                        isDark()
                          ? "bg-gray-700 text-gray-300"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      +{exp.technologies.length - 3} more
                    </span>
                  </Show>
                </div>

                <div class="flex items-center justify-between pt-2">
                  <button
                    onClick={() => toggleProject(exp.id)}
                    class={`text-sm font-medium ${
                      isDark()
                        ? "text-blue-300 hover:text-blue-200"
                        : "text-blue-600 hover:text-blue-800"
                    } flex items-center`}
                  >
                    {expandedProject() === exp.id
                      ? "Hide details"
                      : "View details"}
                    <svg
                      class={`w-4 h-4 ml-1 transform transition-transform ${expandedProject() === exp.id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      ></path>
                    </svg>
                  </button>

                  <div class="flex gap-2">
                    <Show when={exp.videoLink}>
                      <a
                        href={exp.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={`p-2 rounded-full ${
                          isDark()
                            ? "text-red-300 hover:bg-gray-700"
                            : "text-red-500 hover:bg-gray-100"
                        }`}
                        title="Demo Video"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path>
                        </svg>
                      </a>
                    </Show>
                    <Show when={exp.storeLink}>
                      <a
                        href={exp.storeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={`p-2 rounded-full ${
                          isDark()
                            ? "text-green-300 hover:bg-gray-700"
                            : "text-green-600 hover:bg-gray-100"
                        }`}
                        title="Store Page"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M4.06 13a8 8 0 0 0 5.18 6.51A18.5 18.5 0 0 1 8.02 13zm15.88 0a18.5 18.5 0 0 1-1.22 6.51A8 8 0 0 0 19.94 13zm-4.12 0a18.5 18.5 0 0 1-3.82 6.51A8 8 0 0 0 12 20a8 8 0 0 0 .18-7zm-8.12 0a18.5 18.5 0 0 1 3.82 6.51A8 8 0 0 0 12 20a8 8 0 0 0-.18-7zm4.3-11C16.84 2 20 5.16 20 9.29V10h-2v-.71C18 6.37 15.63 4 12.8 4H8a2 2 0 0 0-2 2v4h2V6h4.8c.46 0 .9.1 1.3.29A5.91 5.91 0 0 0 12 13v7h2v-7a5.91 5.91 0 0 0-2.1-4.71c-.4-.19-.84-.29-1.3-.29H8v10.93A8.03 8.03 0 0 1 4.07 10H4v-.71C4 5.16 7.16 2 11.1 2z"></path>
                        </svg>
                      </a>
                    </Show>
                    <Show when={exp.githubLink}>
                      <a
                        href={exp.githubLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={`p-2 rounded-full ${
                          isDark()
                            ? "text-gray-300 hover:bg-gray-700"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                        title="GitHub"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
                        </svg>
                      </a>
                    </Show>
                  </div>
                </div>

                <Show when={expandedProject() === exp.id}>
                  <div
                    class={`mt-4 pt-4 border-t ${isDark() ? "border-gray-700" : "border-gray-200"}`}
                  >
                    <h5
                      class={`text-sm font-medium mb-2 ${isDark() ? "text-blue-300" : "text-blue-700"}`}
                    >
                      Key Contributions:
                    </h5>
                    <ul
                      class={`list-disc pl-5 mb-4 text-sm ${isDark() ? "text-gray-300" : "text-gray-600"}`}
                    >
                      <For each={exp.responsibilities}>
                        {(item) => <li class="mb-1">{item}</li>}
                      </For>
                    </ul>

                    <h5
                      class={`text-sm font-medium mb-2 ${isDark() ? "text-blue-300" : "text-blue-700"}`}
                    >
                      All Technologies:
                    </h5>
                    <div class="flex flex-wrap gap-2">
                      <For each={exp.technologies}>
                        {(tech) => (
                          <span
                            class={`px-2 py-1 rounded-full text-xs ${
                              isDark()
                                ? "bg-blue-900/60 text-blue-200"
                                : "bg-blue-100/80 text-blue-800"
                            }`}
                          >
                            {tech}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      <div
        class={`${isDark() ? "bg-gray-800/80" : "bg-white"} rounded-xl p-8 shadow-lg`}
      >
        <h3
          class={`text-xl font-bold ${isDark() ? "text-blue-200" : "text-blue-800"} mb-6`}
        >
          Career Highlights
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "4", label: "Shipped Games" },
            { value: "1.2M+", label: "Total Downloads" },
            { value: "6+", label: "Years Experience" },
            { value: "8", label: "Team Projects" },
          ].map((stat) => (
            <div
              class={`rounded-lg p-6 text-center ${isDark() ? "bg-blue-900/40" : "bg-blue-50"}`}
            >
              <div
                class={`text-4xl font-bold mb-2 ${isDark() ? "text-blue-300" : "text-blue-600"}`}
              >
                {stat.value}
              </div>
              <p
                class={`text-sm ${isDark() ? "text-gray-300" : "text-gray-600"}`}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExperienceSection;
